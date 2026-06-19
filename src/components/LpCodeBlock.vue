<script setup lang="ts">
/*
 * Code block with lightweight, theme-aware syntax highlighting (codeHighlight.ts
 * — zero deps, synchronous). Monospace, optional line numbers + wrapping, a copy
 * button, and an optional language label.
 *
 * Lock: `locked` (default true) is read-only. Set `:locked="false"` to make it an
 * editable code field — v-model writes back the text, highlighting stays in sync,
 * and a header toggle flips lock/unlock. Useful for editable config snippets.
 */
import { computed, ref } from "vue"
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
  }>(),
  { lang: "plain", locked: true, lockToggle: false, copyable: true, lineNumbers: false, wrap: false },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "update:locked", value: boolean): void
}>()

const code = computed(() => props.modelValue ?? "")
const lines = computed(() => code.value.replace(/\n$/, "").split("\n"))
const highlighted = computed(() => lines.value.map((l) => tokenizeLine(l, props.lang)))

const showHeader = computed(
  () => Boolean(props.title || props.lang !== "plain" || props.copyable || props.lockToggle),
)

// ── copy ─────────────────────────────────────────────────────
const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(code.value)
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

    <!-- Body. This is an overlay editor (transparent <textarea> pixel-aligned
         over the highlighted <pre>) — both layers MUST keep their native,
         synchronised scroll, so we can't wrap it in LpScrollArea. Instead we hide
         the native bar from layout flow via .lp-scrollbar-none; scrolling stays. -->
    <div
      class="lp-scrollbar-none relative"
      :style="height ? { height } : undefined"
      :class="height ? 'overflow-auto' : ''"
    >
      <!-- Editable: a transparent textarea over the highlighted layer so typing
           shows live colours (classic overlay editor). Scroll/size are shared. -->
      <textarea
        v-if="!locked"
        :value="code"
        spellcheck="false"
        class="lp-scrollbar-none absolute inset-0 size-full resize-none overflow-auto whitespace-pre bg-transparent p-3 leading-relaxed text-transparent caret-brand outline-none"
        :class="[wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre', lineNumbers ? 'pl-12' : '']"
        @input="onInput"
      />
      <pre
        class="lp-scrollbar-none m-0 overflow-auto p-3 leading-relaxed"
        :class="[wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre', !locked ? 'pointer-events-none' : '']"
      ><code class="block"><span
          v-for="(line, i) in highlighted"
          :key="i"
          class="block min-h-[1.4em]"
        ><span
            v-if="lineNumbers"
            class="mr-3 inline-block w-7 select-none text-right text-muted/60"
            aria-hidden="true"
          >{{ i + 1 }}</span><template
            v-for="(tok, j) in line"
            :key="j"
          ><span :class="tok.cls">{{ tok.text }}</span></template></span></code></pre>
    </div>
  </div>
</template>
