<script setup lang="ts">
/*
 * Command palette (⌘K). A centered dialog with a filter box and a keyboard-
 * navigable, grouped command list. Built on reka Dialog (focus trap + overlay);
 * the list nav (↑/↓/Enter) is owned here so the query input keeps focus while
 * arrows move the highlight — the pattern the LeavePulse frontend palette uses.
 *
 * Presentation-only and data-agnostic: the consumer supplies `commands` (a
 * composable can assemble them from routes/docs/API). Scoring ranks label >
 * keywords > description; matches are highlighted; the active row scrolls into
 * view. Open state is v-model:open; a global ⌘K/Ctrl-K toggle is on by default.
 */
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"

export interface Command {
  id: string
  label: string
  /** Second line under the label. */
  description?: string
  icon?: string
  /** Right-aligned hint, e.g. "⌘P". */
  shortcut?: string
  /** Extra search terms not shown but matched against the query. */
  keywords?: string[]
  /** Section heading this command sits under. */
  group?: string
  disabled?: boolean
  /**
   * Hidden from the default (empty-query) list — only surfaces once the user
   * types something it matches. For rarely-used or destructive actions (prune,
   * decommission, …) that shouldn't clutter the palette but stay reachable.
   */
  hidden?: boolean
  onSelect?: () => void
}

const props = withDefaults(
  defineProps<{
    open?: boolean
    commands: Command[]
    placeholder?: string
    emptyText?: string
    /** Bind a global ⌘K / Ctrl-K toggle. */
    hotkey?: boolean
  }>(),
  { placeholder: "Type a command or search…", emptyText: "No results", hotkey: true },
)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "select", command: Command): void
}>()

const query = ref("")
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const scrollRef = ref<{ viewportEl: HTMLElement | null } | null>(null)

// ── filtering + scoring ──────────────────────────────────────
// No query → everything (grouped). With a query, score by where it hits:
// label > keywords > description, then alphabetical. Mirrors the app palette.
const ranked = computed<Command[]>(() => {
  const q = query.value.trim().toLowerCase()
  // Empty query: show everything EXCEPT hidden commands (they only surface once
  // typed). With a query, hidden commands rank like any other.
  if (!q) return props.commands.filter((c) => !c.hidden)
  return props.commands
    .map((c) => {
      const label = c.label.toLowerCase().includes(q)
      const kw = (c.keywords ?? []).some((k) => k.toLowerCase().includes(q))
      const desc = c.description?.toLowerCase().includes(q) ?? false
      const score = (label ? 4 : 0) + (kw ? 3 : 0) + (desc ? 2 : 0)
      return { c, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.c.label.localeCompare(b.c.label))
    .map((e) => e.c)
})

// Group preserving first-seen order; ungrouped commands sit under "".
const grouped = computed<{ name: string; items: Command[] }[]>(() => {
  const order: string[] = []
  const map = new Map<string, Command[]>()
  for (const c of ranked.value) {
    const g = c.group ?? ""
    if (!map.has(g)) {
      map.set(g, [])
      order.push(g)
    }
    map.get(g)!.push(c)
  }
  return order.map((name) => ({ name, items: map.get(name)! }))
})

// Flat list in render order — what arrow keys walk through.
const flat = computed(() => grouped.value.flatMap((g) => g.items))
function flatIndexOf(c: Command): number {
  return flat.value.indexOf(c)
}

// ── highlight ────────────────────────────────────────────────
// Split text around query terms (≥2 chars, longest-first) for <mark> wrapping,
// without v-html. Multi-word queries highlight each term.
interface Part {
  text: string
  hit: boolean
}
function highlight(value: string): Part[] {
  const terms = [...new Set(query.value.toLowerCase().trim().split(/\s+/).filter((t) => t.length >= 2))].sort(
    (a, b) => b.length - a.length,
  )
  if (!value || terms.length === 0) return value ? [{ text: value, hit: false }] : []
  const lower = value.toLowerCase()
  const parts: Part[] = []
  let i = 0
  while (i < value.length) {
    let at = -1
    let term = ""
    for (const t of terms) {
      const found = lower.indexOf(t, i)
      if (found !== -1 && (at === -1 || found < at || (found === at && t.length > term.length))) {
        at = found
        term = t
      }
    }
    if (at === -1) {
      parts.push({ text: value.slice(i), hit: false })
      break
    }
    if (at > i) parts.push({ text: value.slice(i, at), hit: false })
    parts.push({ text: value.slice(at, at + term.length), hit: true })
    i = at + term.length
  }
  return parts
}

// ── selection + keyboard ─────────────────────────────────────
watch(query, () => (selectedIndex.value = 0))
watch(
  () => flat.value.length,
  (len) => {
    if (selectedIndex.value >= len) selectedIndex.value = Math.max(0, len - 1)
  },
)
watch([selectedIndex, () => flat.value.map((c) => c.id).join("|")], async () => {
  await nextTick()
  scrollSelectedIntoView()
})

function scrollSelectedIntoView() {
  const el = scrollRef.value?.viewportEl?.querySelector<HTMLElement>(
    `[data-cmd-index="${selectedIndex.value}"]`,
  )
  el?.scrollIntoView({ block: "nearest" })
}

function moveDown() {
  const len = flat.value.length
  if (len) selectedIndex.value = (selectedIndex.value + 1) % len
}
function moveUp() {
  const len = flat.value.length
  if (len) selectedIndex.value = (selectedIndex.value - 1 + len) % len
}
function runSelected() {
  run(flat.value[selectedIndex.value])
}

function run(c: Command | undefined) {
  if (!c || c.disabled) return
  emit("select", c)
  c.onSelect?.()
  emit("update:open", false)
}

// Reset + focus when opening; clear on close.
watch(
  () => props.open,
  async (o) => {
    if (o) {
      query.value = ""
      selectedIndex.value = 0
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

function onHotkey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault()
    emit("update:open", !props.open)
  }
}
onMounted(() => {
  if (props.hotkey) window.addEventListener("keydown", onHotkey)
})
onBeforeUnmount(() => window.removeEventListener("keydown", onHotkey))
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-(--z-overlay) bg-black/50 backdrop-blur-sm data-[state=open]:animate-[fade-in_150ms_ease] data-[state=closed]:animate-[fade-out_130ms_ease]"
      />
      <DialogContent
        class="fixed left-1/2 top-[12vh] z-(--z-modal) flex max-h-[76vh] w-[min(92vw,40rem)] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-emphasized)] data-[state=closed]:animate-[pop-out_130ms_ease]"
        @open-auto-focus.prevent
      >
        <DialogTitle class="sr-only">Command palette</DialogTitle>
        <DialogDescription class="sr-only">Search and run a command.</DialogDescription>

        <!-- Filter -->
        <div class="flex shrink-0 items-center gap-2.5 border-b border-line px-4">
          <LpIcon name="lucide:search" :size="18" class="shrink-0 text-muted" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="placeholder"
            class="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            @keydown.down.prevent="moveDown"
            @keydown.up.prevent="moveUp"
            @keydown.enter.prevent="runSelected"
          />
          <kbd class="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>

        <!-- Results -->
        <LpScrollArea ref="scrollRef" class="min-h-0 flex-1" content-class="p-2">
          <p v-if="flat.length === 0" class="px-2 py-10 text-center text-sm text-muted">
            {{ emptyText }}
          </p>

          <template v-for="group in grouped" :key="group.name">
            <div
              v-if="group.name"
              class="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
            >
              {{ group.name }}
            </div>
            <button
              v-for="c in group.items"
              :key="c.id"
              type="button"
              :data-cmd-index="flatIndexOf(c)"
              :disabled="c.disabled"
              class="lp-cmd-item flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors duration-[var(--duration-fast)] disabled:pointer-events-none disabled:opacity-45"
              :class="flatIndexOf(c) === selectedIndex ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-surface-soft/60'"
              @click="run(c)"
              @pointerenter="selectedIndex = flatIndexOf(c)"
            >
              <LpIcon v-if="c.icon" :name="c.icon" :size="16" class="shrink-0" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">
                  <template v-for="(p, pi) in highlight(c.label)" :key="`l${pi}`">
                    <mark v-if="p.hit" class="rounded-xs bg-brand/25 text-ink">{{ p.text }}</mark>
                    <template v-else>{{ p.text }}</template>
                  </template>
                </span>
                <span v-if="c.description" class="mt-0.5 block truncate text-xs text-muted">
                  <template v-for="(p, pi) in highlight(c.description)" :key="`d${pi}`">
                    <mark v-if="p.hit" class="rounded-xs bg-brand/20 text-ink">{{ p.text }}</mark>
                    <template v-else>{{ p.text }}</template>
                  </template>
                </span>
              </span>
              <kbd v-if="c.shortcut" class="shrink-0 text-xs text-muted">{{ c.shortcut }}</kbd>
            </button>
          </template>
        </LpScrollArea>

        <!-- Footer hints -->
        <div
          class="flex shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted"
        >
          <span class="flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">↑</kbd>
            <kbd class="rounded border border-line px-1 text-[10px]">↓</kbd>
            navigate
          </span>
          <span class="flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">↵</kbd>
            select
          </span>
          <span class="ml-auto flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Each result eases in; honours reduced motion. */
.lp-cmd-item {
  animation: lp-cmd-in 140ms ease-out both;
}
@keyframes lp-cmd-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lp-cmd-item {
    animation: none;
  }
}
</style>
