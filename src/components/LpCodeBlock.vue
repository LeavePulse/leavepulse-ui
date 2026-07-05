<script setup lang="ts">
/*
 * Code block with lightweight, theme-aware syntax highlighting (codeHighlight.ts
 * — zero deps, synchronous). Monospace, optional line numbers + wrapping, a copy
 * button, and an optional language label.
 *
 * Lock: `locked` (default true) is read-only. Set `:locked="false"` to make it an
 * editable code field — v-model writes back the text, highlighting stays in sync,
 * and a header toggle flips lock/unlock. Useful for editable config snippets.
 *
 * Folding: wrap a range in `// #region label` … `// #endregion` markers (or `#`
 * for shell/python/yaml/toml) to make it collapsible — handy for boilerplate that
 * is useful but not essential to the point. The marker lines are removed from the
 * output and from copied text. `foldImports` additionally collapses a leading
 * import/package block automatically without markers. Regions collapse by default;
 * set `region:open` (e.g. `// #region label open`) to start expanded.
 */
import { computed, reactive, ref, watch } from "vue"
import { type CodeLang, tokenizeLine } from "./codeHighlight"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** The code (v-model when editable). */
    modelValue?: string
    lang?: CodeLang
    /** Show 1-based gutter line numbers. */
    lineNumbers?: boolean
    /** Wrap long lines instead of scrolling horizontally. */
    wrap?: boolean
    /** Read-only. Set false for an editable field with a lock toggle. */
    locked?: boolean
    /** Show the lock/unlock toggle in the header (opt-in editability). */
    lockToggle?: boolean
    /** Show the copy button. */
    copyable?: boolean
    /** Caption shown in the header (e.g. a filename). */
    title?: string
    /** Fixed height; defaults to content height. */
    height?: string
    /** Auto-collapse a leading import/package block (no markers needed). */
    foldImports?: boolean
  }>(),
  {
    lang: "plain",
    locked: true,
    lockToggle: false,
    copyable: true,
    lineNumbers: false,
    wrap: false,
    foldImports: false,
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "update:locked", value: boolean): void
}>()

const code = computed(() => props.modelValue ?? "")
const rawLines = computed(() => code.value.replace(/\n$/, "").split("\n"))

// ── fold parsing ─────────────────────────────────────────────
// A segment is either a run of plain lines or a collapsible region. Line objects
// carry their original 1-based number so the gutter stays truthful after markers
// are stripped.
type NumberedLine = { n: number; text: string }
type Segment =
  | { kind: "lines"; lines: NumberedLine[] }
  | { kind: "fold"; id: number; label: string; defaultOpen: boolean; lines: NumberedLine[] }

const REGION_START = /^\s*(?:\/\/|#|--)\s*#region\b\s*(.*?)\s*$/
const REGION_END = /^\s*(?:\/\/|#|--)\s*#endregion\b/
const IMPORT_LINE = /^\s*(?:import|package|use|from|#include|using)\b/

/** Split raw lines into plain/fold segments, dropping the marker lines. */
const segments = computed<Segment[]>(() => {
  const out: Segment[] = []
  const src = rawLines.value
  let plain: NumberedLine[] = []
  let foldId = 0

  const flushPlain = () => {
    if (plain.length) {
      out.push({ kind: "lines", lines: plain })
      plain = []
    }
  }

  // Optional automatic import fold: a leading block of import/package lines that
  // isn't already inside an explicit region.
  let i = 0
  if (props.foldImports && !REGION_START.test(src[0] ?? "")) {
    // Skip a leading blank line or two (rare), then collect the import run.
    let start = 0
    while (start < src.length && src[start].trim() === "") start++
    let end = start
    while (end < src.length && (IMPORT_LINE.test(src[end]) || src[end].trim() === "")) end++
    // Trim trailing blank lines back out of the region.
    let realEnd = end
    while (realEnd > start && src[realEnd - 1].trim() === "") realEnd--
    if (realEnd - start >= 1) {
      // Keep any lines before `start` as plain (e.g. a leading blank).
      for (let k = 0; k < start; k++) plain.push({ n: k + 1, text: src[k] })
      flushPlain()
      const lines: NumberedLine[] = []
      for (let k = start; k < realEnd; k++) lines.push({ n: k + 1, text: src[k] })
      out.push({ kind: "fold", id: foldId++, label: "imports", defaultOpen: false, lines })
      i = realEnd
    }
  }

  for (; i < src.length; i++) {
    const line = src[i]
    const startMatch = line.match(REGION_START)
    if (startMatch) {
      flushPlain()
      const rest = startMatch[1] ?? ""
      const defaultOpen = /\bopen\b/.test(rest)
      const label = rest.replace(/\bopen\b/, "").trim() || "details"
      const lines: NumberedLine[] = []
      i++
      for (; i < src.length; i++) {
        if (REGION_END.test(src[i])) break
        lines.push({ n: i + 1, text: src[i] })
      }
      out.push({ kind: "fold", id: foldId++, label, defaultOpen, lines })
      continue
    }
    plain.push({ n: i + 1, text: line })
  }
  flushPlain()
  return out
})

const hasFolds = computed(() => segments.value.some((s) => s.kind === "fold"))

// Per-region open state, keyed by fold id, defaulting to each region's declared
// open flag. Reset when the set of folds changes.
const openState = reactive<Record<number, boolean>>({})
watch(
  segments,
  (segs) => {
    for (const key of Object.keys(openState)) delete openState[Number(key)]
    for (const s of segs) if (s.kind === "fold") openState[s.id] = s.defaultOpen
  },
  { immediate: true },
)
function toggleFold(id: number) {
  openState[id] = !openState[id]
}

/** Highlight one line's text into tokens. */
function tokens(text: string) {
  return tokenizeLine(text, props.lang)
}

// Copied text is the real code with marker lines removed (so it pastes clean),
// regardless of what's currently collapsed.
const copyText = computed(() =>
  segments.value
    .flatMap((s) => s.lines.map((l) => l.text))
    .join("\n"),
)

const showHeader = computed(
  () => Boolean(props.title || props.lang !== "plain" || props.copyable || props.lockToggle),
)

// ── copy ─────────────────────────────────────────────────────
const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(copyText.value)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1400)
  } catch {
    /* clipboard blocked — no-op */
  }
}

function toggleLock() {
  emit("update:locked", !props.locked)
}

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="overflow-hidden rounded-card border border-line bg-surface font-mono text-xs">
    <!-- Header -->
    <div
      v-if="showHeader"
      class="flex items-center gap-2 border-b border-line bg-surface-soft px-3 py-1.5 text-muted"
    >
      <span v-if="title" class="truncate text-ink">{{ title }}</span>
      <span v-if="lang !== 'plain'" class="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
        {{ lang }}
      </span>
      <div class="ml-auto flex items-center gap-1">
        <button
          v-if="lockToggle"
          type="button"
          class="group/lock flex items-center gap-1 rounded px-1.5 py-1 outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="locked ? 'Unlock to edit' : 'Lock (read-only)'"
          @click="toggleLock"
        >
          <LpIcon
            :name="locked ? 'lucide:lock' : 'lucide:lock-open'"
            :size="13"
            class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active/lock:scale-90"
          />
        </button>
        <button
          v-if="copyable"
          type="button"
          class="group/copy flex items-center gap-1 rounded px-1.5 py-1 outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="copied ? 'Copied' : 'Copy code'"
          @click="copy"
        >
          <LpIcon
            :name="copied ? 'lucide:check' : 'lucide:copy'"
            :size="13"
            :class="copied ? 'text-action' : ''"
          />
        </button>
      </div>
    </div>

    <!-- Body. When there are no folds this stays a plain overlay editor; with
         folds we render segments (the textarea editor is folding-agnostic and is
         only used when unlocked, which authored docs never combine with folds). -->
    <div
      class="lp-scrollbar-none relative"
      :style="height ? { height } : undefined"
      :class="height ? 'overflow-auto' : ''"
    >
      <!-- Editable overlay: only when unlocked and there are no folds. -->
      <textarea
        v-if="!locked && !hasFolds"
        :value="code"
        spellcheck="false"
        class="lp-scrollbar-none absolute inset-0 size-full resize-none overflow-auto whitespace-pre bg-transparent p-3 leading-relaxed text-transparent caret-brand outline-none"
        :class="[wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre', lineNumbers ? 'pl-12' : '']"
        @input="onInput"
      />
      <pre
        class="lp-scrollbar-none m-0 overflow-auto p-3 leading-relaxed"
        :class="[wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre', !locked && !hasFolds ? 'pointer-events-none' : '']"
      ><code class="block"><template
          v-for="(seg, s) in segments"
          :key="s"
        ><!-- Plain lines --><template v-if="seg.kind === 'lines'"><span
              v-for="ln in seg.lines"
              :key="'l' + ln.n"
              class="block min-h-[1.4em]"
            ><span
                v-if="lineNumbers"
                class="mr-3 inline-block w-7 select-none text-right text-muted/60"
                aria-hidden="true"
              >{{ ln.n }}</span><span
                v-for="(tok, j) in tokens(ln.text)"
                :key="j"
                :class="tok.cls"
              >{{ tok.text }}</span></span></template><!-- Fold region --><template
            v-else
          ><button
              type="button"
              class="lp-fold-toggle flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              :aria-expanded="openState[seg.id]"
              @click="toggleFold(seg.id)"
            ><LpIcon
                :name="openState[seg.id] ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                :size="12"
                class="shrink-0"
              /><span class="select-none">{{ openState[seg.id] ? seg.label : seg.label + ' …' }}</span><span
                v-if="!openState[seg.id]"
                class="select-none text-muted/50"
              >({{ seg.lines.length }} lines)</span></button><template
              v-if="openState[seg.id]"
            ><span
                v-for="ln in seg.lines"
                :key="'f' + ln.n"
                class="block min-h-[1.4em]"
              ><span
                  v-if="lineNumbers"
                  class="mr-3 inline-block w-7 select-none text-right text-muted/60"
                  aria-hidden="true"
                >{{ ln.n }}</span><span
                  v-for="(tok, j) in tokens(ln.text)"
                  :key="j"
                  :class="tok.cls"
                >{{ tok.text }}</span></span></template></template></template></code></pre>
    </div>
  </div>
</template>
