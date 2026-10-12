<script setup lang="ts">
/*
 * Command palette (⌘K). A centered dialog with a filter box and a keyboard-
 * navigable, grouped command list. Built on reka Dialog (focus trap + overlay);
 * the list nav (↑/↓/Enter) is owned here so the query input keeps focus while
 * arrows move the highlight — the pattern the LeavePulse frontend palette uses.
 *
 * Presentation-only and data-agnostic: the consumer supplies `commands` (a
 * composable can assemble them from routes/docs/API). Every query word must
 * hit, in any order; scoring ranks label > keywords > description > a typo in
 * the label, with a keyboard-layout retry when nothing matches; matches are
 * highlighted; the active row scrolls into view. Open state is v-model:open;
 * a global ⌘K/Ctrl-K toggle is on by default.
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
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from "vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"
import { useAsyncTask } from "../composables/useAsyncTask"
import { useGlass } from "../composables/useGlass"
import { useClipboard } from "../composables/useClipboard"
import { useHotkeys } from "../composables/useHotkeys"
import { useModalLayer } from "./modalDepth"
import { useLabels } from "../composables/useLpConfig"
import { parseCommandQuery, rankCommandItems } from "./commandSearch"

export interface Command {
  id: string
  label: string
  /** Second line under the label. */
  description?: string
  /**
   * A passage of the matched text, wrapped over several lines (clamped by
   * `excerptLines`) instead of truncated to one. For results a server found
   * inside long text — a docs section, a ticket, a message — where the reason
   * the row matched is the part worth reading before opening it.
   */
  excerpt?: string
  /**
   * Extra words to highlight besides the typed query. A server that matches
   * word forms or typos knows which words actually matched; the query alone
   * would leave those unmarked.
   */
  highlight?: string[]
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
  children?: Command[] | ((query: string, signal: AbortSignal) => Command[] | Promise<Command[]>)
  /** Placeholder while inside this command's mode. */
  childPlaceholder?: string
  /**
   * Keep the palette open after this runs. For a command that toggles
   * something the user may want to toggle again (a theme, a filter) without
   * reopening and retyping.
   */
  keepOpen?: boolean
  /**
   * Where the command leads. The row renders as a real link, so Ctrl/⌘-click,
   * Shift-click and middle-click open it the way the browser opens any link,
   * and Ctrl/⌘+Enter opens it in a new tab from the keyboard. A plain pick
   * still runs `onSelect` (a router push, say); without one it follows the
   * link.
   */
  href?: string
  /**
   * Further things to do with this result besides opening it — copy its id,
   * open it elsewhere, share it. Tab on the highlighted row lists them as a
   * mode named after the row. A command with `href` gets "open in new tab"
   * and "copy link" after its own.
   */
  actions?: Command[]
  /**
   * The whole text behind this result, for the preview pane (`previewPane`):
   * the section a docs hit points into, the ticket body, the message. Line
   * breaks are kept. Without it the pane shows the `excerpt`.
   */
  preview?: string
  onSelect?: () => void
}

/** Footer hints and the mode chip, spelled out so an app can translate them. */
export type PaletteLabels = {
  navigate: string
  select: string
  close: string
  /** Hint for leaving a mode, shown only while inside one. */
  back: string
  searching: string
  /** Shown when `search` (or a fetching mode) threw. */
  searchFailed: string
  retry: string
  /** The row that unfolds a group cut by `groupLimit`; `{count}` is how many are hidden. */
  showMore: string
  /** Footer hint for Tab while the highlighted row has actions. */
  actions: string
  openInNewTab: string
  copyLink: string
  /** Toast after "copy link"; empty for none. */
  linkCopied: string
  /**
   * @deprecated The pane now closes for a row with nothing to show, so this
   * text is never displayed. Kept so existing `labels` objects still type-check.
   */
  noPreview?: string
  /** Accessible name and description of the dialog, read by screen readers only. */
  title?: string
  description?: string
  /** The key hint printed beside the box and in the footer. */
  esc?: string
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
    /**
     * Let the palette keep the history itself, in localStorage under this key:
     * every top-level command run is remembered, newest first. Ignored while
     * `recent` is bound, which stays the way to store it somewhere else.
     */
    recentKey?: string
    /** How many recent commands to surface. */
    recentLimit?: number
    /** Headings the palette adds itself. */
    recentLabel?: string
    resultsLabel?: string
    /** Footer hints and the mode chip, spelled out for translation. */
    labels?: Partial<PaletteLabels>
    /** Lines an `excerpt` may wrap to before it is clamped. */
    excerptLines?: number
    /**
     * Rows a group shows before folding the rest behind a "Show N more" row.
     * One provider answering with thirty people would otherwise push every
     * other group off the screen. 0 shows everything.
     */
    groupLimit?: number
    /**
     * A pane beside the list showing the highlighted result in full — its
     * `preview` text, or the `preview` slot. For palettes that search
     * content rather than commands: the excerpt says why a row matched, the
     * pane lets it be read without leaving the page. It opens only for a row
     * with `preview` or `excerpt` (any row, with the slot): the dialog eases
     * wider, the pane slides in, and the text arrives paragraph by paragraph.
     * Hidden below the md breakpoint, where there is no room beside the list.
     *
     * The width is an inline style rather than a pair of classes: a base
     * width plus an `md:` override could be emitted by a consumer's Tailwind
     * build in an order where the base won, and the pane opened squeezed.
     */
    previewPane?: boolean
    /**
     * Frosted glass instead of a solid panel: the page shows through,
     * blurred, under a lighter scrim (.lp-glass-overlay, .lp-scrim--light).
     * A look, not a behaviour, so it is the app's call: unset follows
     * `provideGlass`, and without one it is off.
     */
    glass?: boolean
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
    excerptLines: 4,
    groupLimit: 0,
    previewPane: false,
    glass: undefined,
  },
)

const frosted = useGlass(() => props.glass)
const contentRef = ref<{ $el: HTMLElement } | null>(null)
const { claim, release, layer } = useModalLayer({ element: () => contentRef.value?.$el })

const DEFAULT_LABELS: Required<PaletteLabels> = {
  navigate: "navigate",
  select: "select",
  close: "close",
  back: "back",
  searching: "Searching…",
  searchFailed: "Search is unavailable right now.",
  retry: "Retry",
  showMore: "Show {count} more",
  actions: "actions",
  openInNewTab: "Open in new tab",
  copyLink: "Copy link",
  linkCopied: "Link copied",
  noPreview: "No preview",
  title: "Command palette",
  description: "Search and run a command.",
  esc: "esc",
}

const text = useLabels("palette", DEFAULT_LABELS, () => props.labels)

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
/*
 * The input is a combobox over a listbox: focus never leaves the box, so the
 * highlighted row has to be announced through aria-activedescendant — without
 * it a screen reader hears the query and nothing as the arrows move.
 */
const listId = `lp-cmd-${useId()}`
function optionId(index: number): string {
  return `${listId}-${index}`
}
const activeId = computed(() => (flat.value.length ? optionId(selectedIndex.value) : undefined))
const selectedIndex = ref(0)
const selectedId = ref<string | null>(null)
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
const trailState = shallowRef<{ query: string; selectedId: string | null }[]>([])
const mode = computed<Command | null>(() => trail.value[trail.value.length - 1] ?? null)

/*
 * Commands of the open mode. A static `children` array is used as given; a
 * function is a fetcher and goes through the same async path as `search`,
 * which is what lets the second step be a lookup rather than a list.
 */
const modeItems = shallowRef<Command[]>([])

const { copy } = useClipboard()

function actionsOf(c: Command | undefined): Command[] {
  if (!c || c.disabled || moreOf.has(c)) return []
  const own = c.actions ?? []
  const href = c.href
  if (!href) return own
  const link = new URL(href, window.location.href).href
  return [
    ...own,
    {
      id: `${c.id}:open-in-new-tab`,
      label: text.value.openInNewTab,
      icon: "lucide:external-link",
      onSelect: () => window.open(href, "_blank", "noopener"),
    },
    {
      id: `${c.id}:copy-link`,
      label: text.value.copyLink,
      icon: "lucide:link",
      onSelect: () => void copy(link, { toast: text.value.linkCopied || false }),
    },
  ]
}

const selectedActions = computed(() => actionsOf(flat.value[selectedIndex.value]))

/*
 * Tab is free for this: the rows are out of the tab order and the box is the
 * only field, so Tab otherwise just walks off to the dialog's edge. Without
 * actions it keeps that default.
 */
function onTab(event: KeyboardEvent) {
  // Without actions Tab stays Tab, so the trail chips and a Retry button are
  // still reachable from the keyboard.
  if (event.shiftKey) return
  const c = flat.value[selectedIndex.value]
  const actions = selectedActions.value
  if (!c || !actions.length) return
  event.preventDefault()
  event.stopPropagation()
  enter({ id: `${c.id}:actions`, label: c.label, icon: c.icon, children: actions })
}

/*
 * A mode holds the command it was entered through, and a static `children`
 * list is a snapshot of that moment. When the app rebuilds its commands (a
 * theme list whose tick follows the active theme), the open mode is matched
 * to the new commands by id along its path and takes their children, so a
 * `keepOpen` pick inside it shows its own effect.
 */
watch(
  () => props.commands,
  (commands) => {
    if (!trail.value.length) return
    let level: Command[] = commands
    const next: Command[] = []
    for (const step of trail.value) {
      const fresh = level.find((c) => c.id === step.id)
      if (!fresh) return
      next.push(fresh)
      level = Array.isArray(fresh.children) ? fresh.children : []
    }
    trail.value = next
    const last = next[next.length - 1]
    if (last && Array.isArray(last.children)) modeItems.value = last.children
  },
)

function enter(c: Command) {
  trailState.value = [...trailState.value, { query: query.value, selectedId: selectedId.value }]
  trail.value = [...trail.value, c]
  query.value = ""
  select(0)
  modeItems.value = Array.isArray(c.children) ? c.children : []
  refresh()
  // Entering by click leaves the focus on the button that no longer exists,
  // and the dialog takes it — from there the next keystroke goes nowhere. The
  // mode exists to be typed into, so the caret goes back in the box.
  inputRef.value?.focus()
}

/** Unwind the trail to `depth` entries — 0 is the root. */
function popTo(depth: number) {
  const state = trailState.value[depth] || { query: "", selectedId: null }
  const next = trail.value.slice(0, Math.max(0, depth))
  trailState.value = trailState.value.slice(0, Math.max(0, depth))
  trail.value = next
  const parent = next[next.length - 1]
  modeItems.value = parent && Array.isArray(parent.children) ? parent.children : []
  query.value = state.query
  select(0)
  refresh()
  void nextTick(() => {
    const index = state.selectedId ? flat.value.findIndex((c) => c.id === state.selectedId) : -1
    select(index >= 0 ? index : 0)
  })
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
 * `children` inside a mode — they differ only in which function to call. The
 * debounce, the abort and the stale-response guard live in `useAsyncTask`,
 * which the table's `load` uses too.
 */
const found = shallowRef<Command[]>([])
const task = useAsyncTask<Command[]>()
const searching = task.pending

function fetcher(): ((q: string, signal: AbortSignal) => Command[] | Promise<Command[]>) | null {
  const current = mode.value
  if (current) {
    return typeof current.children === "function"
      ? current.children
      : null
  }
  return props.search ?? null
}

function cancel() {
  task.cancel()
}

/*
 * A provider that threw used to leave the list as if it had answered "nothing
 * matches", which is a claim about the data the palette cannot make. A failure
 * says so and offers the same request again. Aborts never land here: the task
 * drops a superseded request before `fail` runs.
 */
const failed = ref(false)

function refresh() {
  cancel()
  found.value = []
  failed.value = false
  const run = fetcher()
  if (!run) return
  const q = query.value.trim()
  // A fetching mode runs on an empty query too: opening it should show the
  // first page, not an empty screen waiting for a keystroke. Root search does
  // not — ⌘K would fire a request at every open.
  const inMode = mode.value !== null
  if (!inMode && q.length < Math.max(1, props.minChars)) return
  // A failing provider: the static commands still stand, with a line saying
  // that the rest could not be fetched.
  task.run((signal) => run(q, signal), {
    delay: props.debounce,
    apply: (hits) => (found.value = hits),
    fail: () => {
      found.value = []
      failed.value = true
    },
  })
}

// ── filtering + scoring ──────────────────────────────────────
/*
 * What the query filters: the open mode's own children, or the root commands.
 * A mode is a context, not a filter over the parent list — showing the root
 * next to "which service?" is how a palette gets someone to restart the wrong
 * thing.
 */
const source = computed<Command[]>(() => (mode.value ? modeItems.value : props.commands))

/*
 * Keyboard layouts typed through each other use a QWERTY ↔ Cyrillic map.
 * Only that pair is mapped —
 * the one bilingual setup common enough to be worth a table — and it is a
 * fallback, tried only when the query as typed matches nothing.
 */
/*
 * The local match and the terms it matched with — the swapped ones when the
 * layout fallback is what found it, so the highlight marks what actually hit.
 */
const local = computed<{ items: Command[]; terms: string[] }>(() => {
  const terms = parseCommandQuery(query.value)
  const filtered = query.value.trim()
    ? source.value
    : source.value.filter((c) => !c.hidden)
  // Empty query: show everything EXCEPT hidden commands (they only surface once
  // typed). With a query, hidden commands rank like any other.
  if (!terms.include.length && !terms.exclude.length && !terms.groups.length) return { items: filtered, terms: [] }
  const items = rankCommandItems(filtered, terms)
  return { items, terms: terms.include }
})

const ranked = computed<Command[]>(() => local.value.items)

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
const RECENT_KEEP = 20
const ownRecent = ref<string[]>([])
watch(
  () => props.recentKey,
  (key) => {
    if (!key || typeof localStorage === "undefined") return
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]")
      ownRecent.value = Array.isArray(stored) ? stored.filter((v): v is string => typeof v === "string") : []
    } catch {
      ownRecent.value = []
    }
  },
  { immediate: true },
)
function remember(id: string) {
  const key = props.recentKey
  if (!key || props.recent) return
  ownRecent.value = [id, ...ownRecent.value.filter((v) => v !== id)].slice(0, RECENT_KEEP)
  try {
    localStorage.setItem(key, JSON.stringify(ownRecent.value))
  } catch {}
}
const recentIds = computed(() => props.recent ?? (props.recentKey ? ownRecent.value : []))

const recentItems = computed<Command[]>(() => {
  if (mode.value || query.value.trim() || !recentIds.value.length) return []
  const byId = new Map(props.commands.map((c) => [c.id, c]))
  const out: Command[] = []
  for (const id of recentIds.value) {
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
  return order.map((name) => ({ name, items: folded(name, map.get(name)!) }))
})

/*
 * Groups unfolded by their "Show more" row. Reset with the list it applies
 * to: a new query or another mode is a new list, and its groups start folded.
 */
const expanded = ref(new Set<string>())
const moreOf = new WeakMap<Command, string>()

/*
 * Folding hides at least two rows: a "Show 1 more" row takes the same space
 * as the row it hides.
 */
function folded(name: string, items: Command[]): Command[] {
  const limit = props.groupLimit
  if (!limit || items.length <= limit + 1 || expanded.value.has(name)) return items
  const more: Command = {
    id: `lp-cmd-more:${name}`,
    label: text.value.showMore.replace("{count}", String(items.length - limit)),
    icon: "lucide:chevron-down",
    keepOpen: true,
  }
  moreOf.set(more, name)
  return [...items.slice(0, limit), more]
}

// Flat list in render order — what arrow keys walk through.
const flat = computed(() => grouped.value.flatMap((g) => g.items))

const slots = defineSlots<{
  /** Body of the preview pane for the highlighted command. */
  preview?: (props: { command: Command }) => unknown
}>()

const active = computed<Command | undefined>(() => {
  const c = flat.value[selectedIndex.value]
  return c && !moreOf.has(c) ? c : undefined
})
const previewRef = ref<{ viewportEl: HTMLElement | null } | null>(null)

/*
 * The pane opens only for a row that has something to show: an empty pane
 * beside a list of commands is a column of dead space. With the slot the app
 * decides what to show, so any highlighted row opens it.
 */
const paneOpen = computed(
  () => props.previewPane && !!active.value && (!!slots.preview || !!(active.value.preview || active.value.excerpt)),
)

/*
 * The text in paragraphs, so they can arrive one after another. A blank line
 * separates them, as in the `preview` the consumer wrote.
 */
const paragraphs = computed(() =>
  (active.value?.preview ?? active.value?.excerpt ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean),
)

/*
 * The row's description heads the pane only when it says something the body
 * does not: a command whose full text opens with its description (or is it)
 * would otherwise print the same sentences twice, once small and once large.
 */
const paneDescription = computed(() => {
  const description = active.value?.description?.trim()
  if (!description) return undefined
  const body = paragraphs.value.join(" ")
  return body.startsWith(description) ? undefined : description
})

/** Stagger between paragraphs, capped so a long section does not trickle in. */
const STAGGER_MS = 45
const STAGGER_MAX = 10

/*
 * A preview is opened for the match, so the pane lands on it: the first
 * highlighted word is brought into view, and a result without one starts
 * from the top rather than wherever the previous result was scrolled to.
 */
watch(
  () => active.value?.id,
  async () => {
    if (!paneOpen.value) return
    await nextTick()
    const viewport = previewRef.value?.viewportEl
    if (!viewport) return
    const mark = viewport.querySelector("mark")
    if (mark) mark.scrollIntoView({ block: "center" })
    else viewport.scrollTop = 0
  },
)
// Rows ask for their index several times per render; a lookup keeps that O(1)
// instead of a scan of the whole list per row.
const flatIndex = computed(() => new Map(flat.value.map((c, i) => [c, i])))
function flatIndexOf(c: Command): number {
  return flatIndex.value.get(c) ?? -1
}

// ── highlight ────────────────────────────────────────────────
// Split text around query terms (≥2 chars, longest-first) for <mark> wrapping,
// without v-html. Multi-word queries highlight each term.
interface Part {
  text: string
  hit: boolean
}
function highlight(value: string, extra: string[] = []): Part[] {
  const terms = [...new Set([...local.value.terms, ...extra.map((t) => t.toLowerCase())].filter((t) => t.length >= 2))].sort(
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
  select(0)
  refresh()
})
watch([query, trail, () => props.open], () => {
  expanded.value = new Set()
})
watch(
  () => flat.value.map((c) => c.id).join("|"),
  () => {
    const index = selectedId.value ? flat.value.findIndex((c) => c.id === selectedId.value) : -1
    select(index >= 0 ? index : 0)
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

const keyboardSelection = ref(false)

function select(index: number, keyboard = false) {
  const len = flat.value.length
  selectedIndex.value = len ? Math.max(0, Math.min(index, len - 1)) : 0
  selectedId.value = flat.value[selectedIndex.value]?.id ?? null
  if (keyboard) keyboardSelection.value = true
}

function moveDown() {
  const len = flat.value.length
  if (len) select((selectedIndex.value + 1) % len, true)
}
function moveUp() {
  const len = flat.value.length
  if (len) select((selectedIndex.value - 1 + len) % len, true)
}
function movePage(direction: -1 | 1) {
  select(selectedIndex.value + direction * 8, true)
}
function onPaletteKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (!(["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"] as string[]).includes(event.key)) return
  // Home and End belong to the caret while there is text to move it through.
  const typing = event.target instanceof HTMLInputElement && event.target.value !== ""
  if (typing && (event.key === "Home" || event.key === "End")) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === "ArrowDown") moveDown()
  else if (event.key === "ArrowUp") moveUp()
  else if (event.key === "Home") select(0, true)
  else if (event.key === "End") select(flat.value.length - 1, true)
  else movePage(event.key === "PageDown" ? 1 : -1)
}
function onPointerMove() {
  keyboardSelection.value = false
}
function onPointerEnter(c: Command) {
  if (!keyboardSelection.value) select(flatIndexOf(c))
}
function runSelected(event?: KeyboardEvent) {
  const c = flat.value[selectedIndex.value]
  if (c?.href && !c.disabled && (event?.ctrlKey || event?.metaKey)) {
    openInNewTab(c)
    return
  }
  run(c)
}

function openInNewTab(c: Command) {
  if (!c.href) return
  window.open(c.href, "_blank", "noopener")
  emit("run", c.id, c)
  emit("update:open", false)
}

/*
 * A modified click on a link is the browser's to handle: it opens a tab or a
 * window and this page stays where it is, so the palette neither runs the
 * command nor closes. Only the plain click is taken over.
 */
function onRowClick(event: MouseEvent, c: Command) {
  if (c.href && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return
  event.preventDefault()
  run(c)
}

function run(c: Command | undefined) {
  if (!c || c.disabled) return
  // The highlight stays on the same index, which is now the first row that
  // was hidden: the arrows carry on from where the fold was.
  const group = moreOf.get(c)
  if (group !== undefined) {
    expanded.value = new Set([...expanded.value, group])
    inputRef.value?.focus()
    return
  }
  emit("select", c)
  c.onSelect?.()
  if (!c.onSelect && c.href && !c.children) window.location.assign(c.href)
  // A command with children drills in instead of closing, and is navigation
  // rather than a pick — so it stays out of the recency history.
  if (c.children) {
    enter(c)
    return
  }
  emit("run", c.id, c)
  if (!mode.value) remember(c.id)
  if (c.keepOpen) {
    // Back to the top of a fresh list: the query that found this command is
    // spent, and leaving it would hide whatever the action just changed.
    query.value = ""
    // Inside a mode the highlight stays on what was just picked, so trying
    // themes one after another is a matter of the arrow keys; at the root the
    // list it came from is gone and the top is the honest place to land.
    if (mode.value) void nextTick(() => select(Math.max(0, flat.value.findIndex((x) => x.id === c.id))))
    else select(0)
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
//
// Immediate, because a palette mounted already open — lazily, on the first
// ⌘K — never sees `open` change, and reka's own auto-focus is turned off
// below: without this the first open left focus on the page and the first
// keystrokes went nowhere.
watch(
  () => props.open,
  async (o) => {
    if (o) claim()
    else release()
    cancel()
    query.value = ""
    select(0)
    selectedId.value = null
    trail.value = []
    trailState.value = []
    modeItems.value = []
    found.value = []
    failed.value = false
    if (o) {
      await nextTick()
      inputRef.value?.focus()
    }
  },
  { immediate: true },
)

onBeforeUnmount(release)

// Through useHotkeys rather than a listener of its own: the palette is the one
// shortcut that has to work from inside a text field, and `code` is what makes
// it fire on a layout where Ctrl-K has a different reported key.
useHotkeys(() =>
  props.hotkey
    ? [
        {
          key: "k",
          code: "KeyK",
          ctrl: true,
          allowInInput: true,
          overLayers: true,
          repeat: false,
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
        :class="{ 'lp-scrim--light': frosted, 'lp-scrim--nested': layer.nested }"
        class="lp-scrim fixed inset-0 data-[state=open]:animate-[fade-in_150ms_ease] data-[state=closed]:animate-[fade-out_130ms_ease]"
        :style="{ zIndex: layer.scrim }"
      />
      <DialogContent
        ref="contentRef"
        class="lp-cmd-dialog fixed left-1/2 top-[12vh] flex max-h-[76vh] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-line shadow-panel outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-emphasized)] data-[state=closed]:animate-[pop-out_130ms_ease]"
        :class="[frosted ? (layer.nested ? 'lp-glass-overlay lp-glass-overlay--nested' : 'lp-glass-overlay') : 'bg-surface-raised', previewPane && 'lp-cmd-split']"
        :style="{ zIndex: layer.panel }"
        :data-pane="paneOpen ? 'open' : undefined"
        @open-auto-focus.prevent
        @keydown.capture="onPaletteKeydown"
      >
        <DialogTitle class="sr-only">{{ text.title }}</DialogTitle>
        <DialogDescription class="sr-only">{{ text.description }}</DialogDescription>

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
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            :aria-controls="listId"
            :aria-activedescendant="activeId"
            :placeholder="mode?.childPlaceholder ?? placeholder"
            class="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            @keydown.enter.prevent="runSelected"
            @keydown.backspace="onBackspace"
            @keydown.esc="onEscape"
            @keydown.tab="onTab"
          />
          <kbd class="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">{{ text.esc }}</kbd>
        </div>

        <!-- Results -->
        <div class="flex min-h-0 flex-1" @pointermove="onPointerMove">
          <LpScrollArea ref="scrollRef" class="lp-cmd-list min-h-0 min-w-0 flex-1" content-class="p-2">
            <!-- While a request is out there is nothing to say yet: "no results"
                 under a spinner reads as an answer, and it is not one. -->
            <p v-if="flat.length === 0 && !failed" class="px-2 py-10 text-center text-sm text-muted">
              {{ searching ? text.searching : emptyText }}
            </p>

            <div :id="listId" role="listbox">
              <div
                v-for="(group, gi) in grouped"
                :key="group.name"
                role="group"
                :aria-labelledby="group.name ? `${listId}-g${gi}` : undefined"
              >
                <div
                  v-if="group.name"
                  :id="`${listId}-g${gi}`"
                  class="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  {{ group.name }}
                </div>
                <!-- tabindex -1: the rows are reached with the arrows from the box,
                     so Tab should not walk through every one of them. -->
                <component
                  :is="c.href ? 'a' : 'button'"
                  v-for="c in group.items"
                  :id="optionId(flatIndexOf(c))"
                  :key="c.id"
                  :href="c.disabled ? undefined : c.href"
                  :type="c.href ? undefined : 'button'"
                  role="option"
                  tabindex="-1"
                  :aria-selected="flatIndexOf(c) === selectedIndex"
                  :aria-disabled="c.disabled || undefined"
                  :data-cmd-index="flatIndexOf(c)"
                  :disabled="c.href ? undefined : c.disabled"
                  class="lp-cmd-item flex w-full gap-3 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors duration-[var(--duration-fast)] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45"
                  :class="[
                    c.excerpt ? 'items-start' : 'items-center',
                    flatIndexOf(c) === selectedIndex
                      ? 'bg-brand-soft text-brand'
                      : moreOf.has(c)
                        ? 'text-muted hover:bg-surface-soft/60'
                        : 'text-ink hover:bg-surface-soft/60',
                  ]"
                  @click="onRowClick($event, c)"
                  @pointerenter="onPointerEnter(c)"
                >
                  <LpIcon v-if="c.icon" :name="c.icon" :size="16" class="shrink-0" :class="{ 'mt-0.5': c.excerpt }" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium">
                      <template v-for="(p, pi) in highlight(c.label, c.highlight)" :key="`l${pi}`">
                        <mark v-if="p.hit" class="rounded-xs bg-brand/25 text-ink">{{ p.text }}</mark>
                        <template v-else>{{ p.text }}</template>
                      </template>
                    </span>
                    <span v-if="c.description" class="mt-0.5 block truncate text-xs text-muted">
                      <template v-for="(p, pi) in highlight(c.description, c.highlight)" :key="`d${pi}`">
                        <mark v-if="p.hit" class="rounded-xs bg-brand/20 text-ink">{{ p.text }}</mark>
                        <template v-else>{{ p.text }}</template>
                      </template>
                    </span>
                    <!-- Wraps rather than truncates: a passage cut to one line
                         stops before the part that explains the match. Ink, not
                         brand, on the active row: a paragraph in accent colour is
                         hard to read. -->
                    <span
                      v-if="c.excerpt"
                      class="lp-cmd-excerpt mt-1 block text-[13px] leading-snug text-ink/80"
                      :style="{ '-webkit-line-clamp': excerptLines }"
                    >
                      <template v-for="(p, pi) in highlight(c.excerpt, c.highlight)" :key="`e${pi}`">
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
                </component>
              </div>
            </div>
            <!-- Below what was found: the static matches are still worth
                 picking, and the failure is about the part that is missing. -->
            <div
              v-if="failed"
              role="alert"
              class="flex items-center justify-center gap-2 px-2 text-sm text-muted"
              :class="flat.length ? 'pb-1 pt-3' : 'py-10'"
            >
              <LpIcon name="lucide:circle-alert" :size="15" class="shrink-0" />
              <span>{{ text.searchFailed }}</span>
              <button
                type="button"
                class="rounded-md px-1.5 py-0.5 font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-ring"
                @click="refresh(); inputRef?.focus()"
              >
                {{ text.retry }}
              </button>
            </div>
          </LpScrollArea>
          <!-- Slides in beside the list while the dialog widens to make room,
               and out again for a row with nothing to show. -->
          <Transition name="lp-cmd-pane">
            <aside
              v-if="paneOpen"
              class="lp-cmd-pane hidden min-h-0 shrink-0 flex-col border-l border-line md:flex"
            >
              <LpScrollArea ref="previewRef" class="min-h-0 flex-1" content-class="px-5 py-4">
                <!-- Keyed by the row, so moving the highlight replays the
                     entrance rather than swapping text in place. -->
                <div v-if="active" :key="active.id">
                  <slot name="preview" :command="active">
                    <div class="lp-cmd-para flex items-center gap-2 text-ink">
                      <LpIcon v-if="active.icon" :name="active.icon" :size="16" class="shrink-0 text-muted" />
                      <h3 class="min-w-0 text-base font-semibold">{{ active.label }}</h3>
                    </div>
                    <p v-if="paneDescription" class="lp-cmd-para mt-0.5 text-xs text-muted">
                      {{ paneDescription }}
                    </p>
                    <p
                      v-for="(para, i) in paragraphs"
                      :key="i"
                      class="lp-cmd-para mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/90"
                      :style="{ animationDelay: `${Math.min(i + 1, STAGGER_MAX) * STAGGER_MS}ms` }"
                    >
                      <template v-for="(p, pi) in highlight(para, active.highlight)" :key="`p${pi}`">
                        <mark v-if="p.hit" class="rounded-xs bg-brand/25 text-ink">{{ p.text }}</mark>
                        <template v-else>{{ p.text }}</template>
                      </template>
                    </p>
                  </slot>
                </div>
              </LpScrollArea>
            </aside>
          </Transition>
        </div>

        <!-- Footer hints. Keyboard-only, so a touch screen without a keyboard
             gets the row back for results. -->
        <div
          class="flex shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted [@media(hover:none)_and_(pointer:coarse)]:hidden"
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
          <span v-if="selectedActions.length" class="flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">tab</kbd>
            {{ text.actions }}
          </span>
          <span v-if="trail.length" class="flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">⌫</kbd>
            {{ text.back }}
          </span>
          <span class="ml-auto flex items-center gap-1">
            <kbd class="rounded border border-line px-1 text-[10px]">{{ text.esc }}</kbd>
            {{ text.close }}
          </span>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/*
 * Sizes for the split layout. Only the dialog's width animates: the list and
 * the pane keep fixed widths, and the dialog — overflow hidden — uncovers the
 * pane from its right edge as it grows. Animating the columns themselves made
 * every line of the list and the pane re-wrap on every frame.
 */
.lp-cmd-dialog {
  --lp-cmd-list: min(92vw, 40rem);
  --lp-cmd-pane: max(0px, min(26rem, 96vw - var(--lp-cmd-list)));
  width: var(--lp-cmd-list);
}
.lp-cmd-split {
  transition:
    width 300ms var(--ease-emphasized, ease),
    min-height 300ms var(--ease-emphasized, ease);
}
@media (min-width: 768px) {
  .lp-cmd-split .lp-cmd-list {
    flex: 0 0 auto;
    /* the dialog's 1px border on each side */
    width: calc(var(--lp-cmd-list) - 2px);
  }
  .lp-cmd-dialog[data-pane="open"] {
    width: calc(var(--lp-cmd-list) + var(--lp-cmd-pane));
    min-height: min(76vh, 36rem);
  }
}
.lp-cmd-pane {
  width: var(--lp-cmd-pane);
}
/*
 * The pane rides in from the right edge while the dialog opens up to it, and
 * leaves the same way, for as long as the dialog takes to close over it.
 */
.lp-cmd-pane-enter-active,
.lp-cmd-pane-leave-active {
  transition:
    transform 300ms var(--ease-emphasized, ease),
    opacity 300ms ease;
}
.lp-cmd-pane-enter-from,
.lp-cmd-pane-leave-to {
  opacity: 0;
  transform: translateX(40%);
}
.lp-cmd-para {
  animation: lp-cmd-para-in 260ms ease-out both;
}
@keyframes lp-cmd-para-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lp-cmd-split,
  .lp-cmd-pane-enter-active,
  .lp-cmd-pane-leave-active {
    transition: none;
  }
  .lp-cmd-para {
    animation: none;
  }
}
.lp-cmd-excerpt {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
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
