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
 *
 * Three things a palette outgrows the moment it stops being a list of routes,
 * all of them here rather than in each app that hit the wall:
 *
 *   search — `commands` is everything the palette knows, so anything living
 *     behind an API (people, files, tickets) had no way in. `search` is an
 *     async provider: it runs on the typed query, debounced, with the previous
 *     request aborted, and its results join the static ones.
 *
 *   modes — a flat list cannot ask a second question. A command returning
 *     `children` (or a provider of them) pushes a mode: the query resets, a
 *     chip names where you are, and Backspace on an empty query pops back out.
 *
 *   recency — the list is ordered the same on every open, so the command
 *     someone runs hourly sits wherever the alphabet put it. With `recent`
 *     bound, picks float to a group of their own.
 */
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui"
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"
import { useHotkeys } from "../composables/useHotkeys"

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
  /**
   * Picking this opens a mode instead of closing: a nested list, either given
   * outright or fetched from the query typed inside it. This is what keeps a
   * palette from flattening "restart <service>" into one row per service —
   * and what lets the second step search a list too big to enumerate.
   *
   * `onSelect` still runs when the mode opens, so a command can both act and
   * drill in.
   */
  children?: Command[] | ((query: string) => Command[] | Promise<Command[]>)
  /** Placeholder while inside this command's mode. */
  childPlaceholder?: string
  /**
   * Keep the palette open after this runs. For a command that toggles
   * something the user may want to toggle again (a theme, a filter) without
   * reopening and retyping.
   */
  keepOpen?: boolean
  onSelect?: () => void
}

/** Footer hints and the mode chip, spelled out so an app can translate them. */
export interface PaletteLabels {
  navigate: string
  select: string
  close: string
  /** Hint for leaving a mode, shown only while inside one. */
  back: string
  searching: string
}

const props = withDefaults(
  defineProps<{
    open?: boolean
    commands: Command[]
    placeholder?: string
    emptyText?: string
    /** Bind a global ⌘K / Ctrl-K toggle. */
    hotkey?: boolean
    /**
     * Commands fetched from the typed query — what reaches the things too many
     * (or too remote) to hand over as a list: people, files, tickets. Called
     * debounced, never for a query shorter than `minChars`, and only its
     * newest call counts: an earlier one that lands late is dropped, so a slow
     * response can't overwrite a fresher list.
     *
     * Results join the static commands, so a palette can do both.
     */
    search?: (query: string, signal: AbortSignal) => Command[] | Promise<Command[]>
    /** Wait after the last keystroke before `search` runs. */
    debounce?: number
    /** Shortest query `search` runs for. */
    minChars?: number
    /**
     * Ids of recently picked commands, newest first — bind it to storage and
     * the palette opens on what this person actually uses. It only reorders
     * commands already in the list; an id that no longer resolves is skipped,
     * so a stored history never resurrects a command that has gone away.
     */
    recent?: string[]
    /** How many recent commands to surface. */
    recentLimit?: number
    /** Headings the palette adds itself. */
    recentLabel?: string
    resultsLabel?: string
    /** Footer hints and the mode chip, spelled out for translation. */
    labels?: Partial<PaletteLabels>
  }>(),
  {
    placeholder: "Type a command or search…",
    emptyText: "No results",
    hotkey: true,
    debounce: 250,
    minChars: 1,
    recentLimit: 5,
    recentLabel: "Recent",
    resultsLabel: "Results",
  },
)

const DEFAULT_LABELS: PaletteLabels = {
  navigate: "navigate",
  select: "select",
  close: "close",
  back: "back",
  searching: "Searching…",
}

const text = computed<PaletteLabels>(() => ({ ...DEFAULT_LABELS, ...props.labels }))

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "select", command: Command): void
  /**
   * A command ran — id first, because the common use is appending it to a
   * stored recency list. Fires for leaf commands only: opening a mode is
   * navigation, not a pick.
   */
  (e: "run", id: string, command: Command): void
}>()

const query = ref("")
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const scrollRef = ref<{ viewportEl: HTMLElement | null } | null>(null)

// ── modes ────────────────────────────────────────────────────
/*
 * The trail of commands drilled into, outermost first. Empty is the root list.
 * A stack rather than one level because nesting costs nothing here and a
 * two-step action ("container → restart → confirm") is the shape that shows up
 * as soon as a palette does more than navigate.
 *
 * shallowRef: entries are consumer objects that may carry anything (a fetcher,
 * a row of data), and deep-tracking them would walk it on every keystroke.
 */
const trail = shallowRef<Command[]>([])
const mode = computed<Command | null>(() => trail.value[trail.value.length - 1] ?? null)

/*
 * Commands of the open mode. A static `children` array is used as given; a
 * function is a fetcher and goes through the same async path as `search`,
 * which is what lets the second step be a lookup rather than a list.
 */
const modeItems = shallowRef<Command[]>([])

function enter(c: Command) {
  trail.value = [...trail.value, c]
  query.value = ""
  selectedIndex.value = 0
  modeItems.value = Array.isArray(c.children) ? c.children : []
  refresh()
  // Entering by click leaves the focus on the button that no longer exists,
  // and the dialog takes it — from there the next keystroke goes nowhere. The
  // mode exists to be typed into, so the caret goes back in the box.
  inputRef.value?.focus()
}

/** Unwind the trail to `depth` entries — 0 is the root. */
function popTo(depth: number) {
  const next = trail.value.slice(0, Math.max(0, depth))
  trail.value = next
  query.value = ""
  selectedIndex.value = 0
  const parent = next[next.length - 1]
  modeItems.value = parent && Array.isArray(parent.children) ? parent.children : []
  refresh()
  inputRef.value?.focus()
}

/** Leave the innermost mode. Returns false at the root, so Escape can close. */
function back(): boolean {
  if (!trail.value.length) return false
  popTo(trail.value.length - 1)
  return true
}

// ── async results ────────────────────────────────────────────
/*
 * One in-flight request, shared by `search` at the root and by a fetching
 * `children` inside a mode — they differ only in which function to call.
 *
 * Two races to lose here, and both are lost silently: a stale response
 * overwriting a fresher one, and a response arriving after the palette moved
 * on (closed, or into another mode). The token guards both — the abort signal
 * only asks the consumer to stop, it cannot promise they did.
 */
const found = shallowRef<Command[]>([])
const searching = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
let token = 0

function fetcher(): ((q: string, signal: AbortSignal) => Command[] | Promise<Command[]>) | null {
  const current = mode.value
  if (current) {
    return typeof current.children === "function"
      ? (q: string) => (current.children as (q: string) => Command[] | Promise<Command[]>)(q)
      : null
  }
  return props.search ?? null
}

function cancel() {
  if (timer) clearTimeout(timer)
  timer = undefined
  controller?.abort()
  controller = undefined
  token += 1
  searching.value = false
}

function refresh() {
  cancel()
  found.value = []
  const run = fetcher()
  if (!run) return
  const q = query.value.trim()
  // A fetching mode runs on an empty query too: opening it should show the
  // first page, not an empty screen waiting for a keystroke. Root search does
  // not — ⌘K would fire a request at every open.
  const inMode = mode.value !== null
  if (!inMode && q.length < Math.max(1, props.minChars)) return
  searching.value = true
  const mine = ++token
  timer = setTimeout(async () => {
    controller = new AbortController()
    try {
      const hits = await run(q, controller.signal)
      if (mine !== token) return
      found.value = hits
    } catch {
      // Abort or a failing provider: the static commands still stand.
      if (mine === token) found.value = []
    } finally {
      if (mine === token) searching.value = false
    }
  }, props.debounce)
}

onBeforeUnmount(cancel)

// ── filtering + scoring ──────────────────────────────────────
/*
 * What the query filters: the open mode's own children, or the root commands.
 * A mode is a context, not a filter over the parent list — showing the root
 * next to "which service?" is how a palette gets someone to restart the wrong
 * thing.
 */
const source = computed<Command[]>(() => (mode.value ? modeItems.value : props.commands))

// No query → everything (grouped). With a query, score by where it hits:
// label > keywords > description, then alphabetical. Mirrors the app palette.
const ranked = computed<Command[]>(() => {
  const q = query.value.trim().toLowerCase()
  // Empty query: show everything EXCEPT hidden commands (they only surface once
  // typed). With a query, hidden commands rank like any other.
  if (!q) return source.value.filter((c) => !c.hidden)
  return source.value
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

/*
 * Fetched results sit under their own heading unless they brought a group of
 * their own, so they never look like they were part of the static list. An id
 * already matched locally is dropped: the same command listed twice is a
 * misclick waiting to happen.
 */
const fetched = computed<Command[]>(() => {
  if (!found.value.length) return []
  const seen = new Set(ranked.value.map((c) => c.id))
  return found.value
    .filter((c) => !seen.has(c.id))
    .map((c) => (c.group ? c : { ...c, group: props.resultsLabel }))
})

/*
 * Recent picks, newest first, lifted out of the list they already belong to.
 * Only on the root's empty query: once someone types, or drills into a mode,
 * relevance is the better order and a duplicated row is just noise.
 */
const recentItems = computed<Command[]>(() => {
  if (mode.value || query.value.trim() || !props.recent?.length) return []
  const byId = new Map(props.commands.map((c) => [c.id, c]))
  const out: Command[] = []
  for (const id of props.recent) {
    const c = byId.get(id)
    if (c && !c.disabled && !out.includes(c)) out.push(c)
    if (out.length >= props.recentLimit) break
  }
  return out
})

// Group preserving first-seen order; ungrouped commands sit under "".
// Recent first (it answers "the thing I always run"), then the matched list,
// then whatever the provider found.
const grouped = computed<{ name: string; items: Command[] }[]>(() => {
  const order: string[] = []
  const map = new Map<string, Command[]>()
  const push = (c: Command, group: string) => {
    if (!map.has(group)) {
      map.set(group, [])
      order.push(group)
    }
    map.get(group)!.push(c)
  }
  const recent = recentItems.value
  for (const c of recent) push(c, props.recentLabel)
  // A recent entry is shown once: leaving the copy in its own group would put
  // the same row on screen twice with nothing to tell them apart.
  for (const c of ranked.value) if (!recent.includes(c)) push(c, c.group ?? "")
  for (const c of fetched.value) push(c, c.group ?? "")
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
watch(query, () => {
  selectedIndex.value = 0
  refresh()
})
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
  // A command with children drills in instead of closing, and is navigation
  // rather than a pick — so it stays out of the recency history.
  if (c.children) {
    enter(c)
    return
  }
  emit("run", c.id, c)
  if (c.keepOpen) {
    // Back to the top of a fresh list: the query that found this command is
    // spent, and leaving it would hide whatever the action just changed.
    query.value = ""
    selectedIndex.value = 0
    inputRef.value?.focus()
    return
  }
  emit("update:open", false)
}

/*
 * Backspace on an empty query leaves the mode. Mirrors how the Slack and
 * Linear palettes behave, and means the way out is the key already under the
 * finger — Escape stays the way out of the palette itself.
 */
function onBackspace(event: KeyboardEvent) {
  if (query.value) return
  if (back()) event.preventDefault()
}

/*
 * Escape unwinds one mode at a time and only closes at the root, so drilling
 * in three levels does not make leaving one an all-or-nothing choice. reka's
 * Dialog would close on its own, so the key is handled here and declined
 * (stopPropagation) only while there is a mode to pop.
 */
function onEscape(event: KeyboardEvent) {
  if (!trail.value.length) return
  event.preventDefault()
  event.stopPropagation()
  back()
}

// Reset + focus when opening; clear on close. The trail resets too: reopening
// into the mode someone left three screens deep is never what they meant by
// ⌘K, and a pending request from last time is dropped rather than landing in
// the new list.
watch(
  () => props.open,
  async (o) => {
    cancel()
    query.value = ""
    selectedIndex.value = 0
    trail.value = []
    modeItems.value = []
    found.value = []
    if (o) {
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

// Through useHotkeys rather than a listener of its own: the palette is the one
// shortcut that has to work from inside a text field, and `code` is what makes
// it fire on a layout where Ctrl-K arrives as "л".
useHotkeys(() =>
  props.hotkey
    ? [
        {
          key: "k",
          code: "KeyK",
          ctrl: true,
          allowInInput: true,
          handler: () => emit("update:open", !props.open),
        },
      ]
    : [],
)
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay
        class="lp-scrim fixed inset-0 z-(--z-overlay) data-[state=open]:animate-[fade-in_150ms_ease] data-[state=closed]:animate-[fade-out_130ms_ease]"
      />
      <DialogContent
        class="fixed left-1/2 top-[12vh] z-(--z-modal) flex max-h-[76vh] w-[min(92vw,40rem)] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-panel outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-emphasized)] data-[state=closed]:animate-[pop-out_130ms_ease]"
        @open-auto-focus.prevent
      >
        <DialogTitle class="sr-only">Command palette</DialogTitle>
        <DialogDescription class="sr-only">Search and run a command.</DialogDescription>

        <!-- Filter. The trail sits inside the box as chips, the way a scoped
             search reads everywhere else: what you type is filtered by what is
             to its left. -->
        <div class="flex shrink-0 items-center gap-2.5 border-b border-line px-4">
          <LpIcon
            v-if="!searching"
            name="lucide:search"
            :size="18"
            class="shrink-0 text-muted"
          />
          <LpIcon v-else name="lucide:loader-circle" :size="18" class="shrink-0 animate-spin text-muted" />

          <button
            v-for="(step, i) in trail"
            :key="step.id"
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand transition-opacity hover:opacity-80"
            :title="text.back"
            @click="popTo(i)"
          >
            <LpIcon v-if="step.icon" :name="step.icon" :size="13" />
            {{ step.label }}
            <LpIcon name="lucide:x" :size="12" class="opacity-60" />
          </button>

          <input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="mode?.childPlaceholder ?? placeholder"
            class="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            @keydown.down.prevent="moveDown"
            @keydown.up.prevent="moveUp"
            @keydown.enter.prevent="runSelected"
            @keydown.backspace="onBackspace"
            @keydown.esc="onEscape"
          />
          <kbd class="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>

        <!-- Results -->
        <LpScrollArea ref="scrollRef" class="min-h-0 flex-1" content-class="p-2">
          <!-- While a request is out there is nothing to say yet: "no results"
               under a spinner reads as an answer, and it is not one. -->
          <p v-if="flat.length === 0" class="px-2 py-10 text-center text-sm text-muted">
            {{ searching ? text.searching : emptyText }}
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
              <!-- Drills in rather than runs: worth saying before the click,
                   since the two look identical otherwise. -->
              <LpIcon
                v-else-if="c.children"
                name="lucide:chevron-right"
                :size="14"
                class="shrink-0 text-muted"
              />
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
            {{ text.navigate }}
          </span>
          <span class="flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">↵</kbd>
            {{ text.select }}
          </span>
          <!-- Only inside a mode: at the root Backspace just edits the query,
               and advertising it there would be a lie. -->
          <span v-if="trail.length" class="flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">⌫</kbd>
            {{ text.back }}
          </span>
          <span class="ml-auto flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">esc</kbd>
            {{ text.close }}
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
