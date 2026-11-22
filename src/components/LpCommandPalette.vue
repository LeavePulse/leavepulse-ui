<script setup lang="ts">
import { useModelOverlayHistory, type OverlayHistoryMode } from "../composables/useOverlayHistory"
import { nodeWindow } from "../composables/realm"
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
import { clamp } from "../composables/clamp"
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui"
import { computed, h, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from "vue"
import { mergePaletteCommands, suppressPaletteDiscovery, usePaletteScope } from "../composables/usePaletteCommands"
import { useToast } from "../composables/useToast"
import LpButton from "./LpButton.vue"
import PalettePreviewBoundary from "./PalettePreviewBoundary.vue"
import PaletteFooter from "./PaletteFooter.vue"
import PalettePaneText from "./PalettePaneText.vue"
import PaletteRow from "./PaletteRow.vue"
import LpIcon from "./LpIcon.vue"
import LpLoader from "./LpLoader.vue"
import LpScrollArea from "./LpScrollArea.vue"
import { useAsyncTask } from "../composables/useAsyncTask"
import { useGlass } from "../composables/useGlass"
import { useClipboard } from "../composables/useClipboard"
import { useHotkeys } from "../composables/useHotkeys"
import { hints } from "../composables/useHints"
import { HINT_SIGNALS, runningHintSystem } from "../composables/useHintSystem"
import { useModalLayer } from "./modalDepth"
import { useLabels } from "../composables/useLpConfig"
import {
  applyQueryFilters,
  highlightParts,
  parseCommandQuery,
  parsePaletteQuery,
  searchCommandItems,
  type HighlightPart,
  type PaletteQuery,
} from "./commandSearch"
import {
  absoluteHref,
  isSafeHref,
  keptHighlight,
  moreRowId,
  PALETTE_MODES,
  type PaletteMode,
  fallbackRows,
  matchModePrefix,
  modeChipLabel,
  type RecentEntry,
  type RecentItem,
} from "./commandPalette"
import type { Command, CommandFetcher, PaletteLabels } from "./commandPaletteTypes"
import { usePaletteFetch } from "./paletteFetch"
import { usePaletteHistory } from "./paletteHistory"
import { usePalettePane } from "./palettePane"
import { usePaletteViewport } from "./paletteViewport"
import { useOutsideGuard, usePortalTarget, useView, viewWindow } from "../composables/useView"

// The public types live in commandPaletteTypes.ts; re-exported so imports from the SFC keep working.
export type { Command, CommandFetcher, CommandImage, CommandPrompt, PaletteLabels } from "./commandPaletteTypes"

const props = withDefaults(
  defineProps<{
    open?: boolean
    /**
     * Browser Back closes it, and opening it adds a history entry. Unset
     * follows `provideOverlayHistory` (off without one); `"reopen"` also opens
     * it again on Forward; `false` keeps it out of history.
     */
    history?: OverlayHistoryMode
    commands?: Command[]
    /** Include live commands registered by enclosing LpCommandScope components. */
    context?: boolean
    /** Built-in sigils; people, channels and roles appear when a provider is supplied. */
    modes?: Partial<Record<PaletteMode, Command[] | CommandFetcher>>
    pinned?: RecentItem[]
    pinnedKey?: string
    pinnedLabel?: string
    placeholder?: string
    emptyText?: string
    /** Bind a global ⌘K / Ctrl-K toggle. */
    hotkey?: boolean
    /**
     * Commands fetched from the typed query — what reaches the things too many
     * (or too remote) to hand over as a list: people, files, tickets. Called
     * debounced, never for a query shorter than `minChars`, and only its
     * newest call counts: an earlier one that lands late is dropped, so a slow
     * response can't overwrite a fresher list. The abort signal may never
     * reach the transport (a Tauri invoke cannot be cancelled); the late
     * answer is discarded all the same. See CommandFetcher for what
     * `query` and `parsed` hold: the operators are stripped from the first,
     * and the palette applies them to the results itself.
     *
     * Results join the static commands, so a palette can do both.
     */
    search?: CommandFetcher
    /** Wait after the last keystroke before `search` runs. */
    debounce?: number
    /** Shortest query `search` runs for, counted on its positive words. */
    minChars?: number
    /**
     * Recently picked commands, newest first — bind it to storage and the
     * palette opens on what this person actually uses. An item is a root
     * command's id, or a RecentEntry for a pick made inside a mode or among
     * fetched results (the `remember` event hands over exactly what to
     * store; `pushRecent` adds it to a list). A root id only reorders
     * commands already in the list. An entry is found again down its path
     * of static children, then through `resolveRecent`, then from its own
     * `href`; what none of them finds is skipped, so a stored history never
     * resurrects a command that has gone away.
     */
    recent?: RecentItem[]
    /**
     * Let the palette keep the history itself, in localStorage under this key:
     * every pick is remembered, newest first, root ones as bare ids as before
     * and deeper ones as entries. Ignored while `recent` is bound, which
     * stays the way to store it somewhere else.
     */
    recentKey?: string
    /**
     * Finds the live command for a remembered pick the palette cannot find
     * itself: a result a fetcher returned, or one inside a mode whose
     * children are fetched. Gets the stored entry, with the command's
     * `recentData` as `data`; returns the command to show and run, or
     * nothing to drop it.
     */
    resolveRecent?: (entry: RecentEntry) => Command | null | undefined
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
     * with `preview` or `excerpt` (any row, with the slot, unless `hasPreview`
     * or the row's `noPreview` says otherwise): the dialog eases wider, the
     * pane slides in, and the text arrives paragraph by paragraph. A slot
     * that renders nothing for a row falls back to that built-in text.
     * Hidden below the md breakpoint, where there is no room beside the list.
     *
     * The width is an inline style rather than a pair of classes: a base
     * width plus an `md:` override could be emitted by a consumer's Tailwind
     * build in an order where the base won, and the pane opened squeezed.
     */
    previewPane?: boolean
    /**
     * Which rows the pane opens for. With a `#preview` slot every row would
     * otherwise qualify, and an app whose previews cover only some kinds of
     * row had to draw a placeholder for the rest. Return false and the pane
     * folds away for that row, as it does for a row without text. A row's
     * own `noPreview` wins over this.
     */
    hasPreview?: (command: Command) => boolean
    /**
     * Frosted glass instead of a solid panel: the page shows through,
     * blurred, under a lighter scrim (.lp-glass-overlay, .lp-scrim--light).
     * A look, not a behaviour, so it is the app's call: unset follows
     * `provideGlass`, and without one it is off.
     */
    glass?: boolean
  }>(),
  {
    history: undefined,
    placeholder: "Type a command or search…",
    emptyText: "No results",
    commands: () => [],
    context: true,
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

const paletteScope = usePaletteScope()
suppressPaletteDiscovery()
const baseCommands = computed(() => mergePaletteCommands(props.context ? paletteScope?.registry.commands.value ?? [] : [], props.commands))
const rootCommands = computed<Command[]>(() => mergePaletteCommands([
  ...baseCommands.value,
  ...Object.entries(PALETTE_MODES).flatMap(([key, definition]) => {
    const name = key as PaletteMode
    const children = props.modes?.[name] ?? (name === "commands" ? baseCommands.value.filter(c => !c.href && !c.children && !c.editInPreview)
      : name === "help" ? [{ id: "palette/help/keys", label: "Keyboard navigation", editInPreview: true, previewComponent: { render: () => h("p", { class: "whitespace-pre-line text-sm leading-relaxed" }, "↑ ↓ Navigate results\nEnter Run or edit\nTab Result actions\nAlt+P Pin a result\nEscape Back or close") } }] : undefined)
    return children ? [{ id: `palette/mode/${name}`, ...definition, label: text.value[name], children, group: text.value.search, remember: false }] : []
  }),
], []))
const toast = useToast()
const editing = shallowRef<Command>()
let stopEditorFocus: (() => void) | undefined
const promptCommand = shallowRef<Command>()
const promptValue = ref("")
const promptError = ref("")
const promptValidation = useAsyncTask<string | undefined>()
const validating = promptValidation.pending
watch(promptCommand, () => promptValidation.cancel(), { flush: "sync" })
const executing = ref(false)
const actionError = ref("")
let executionEpoch = 0
let afterClose: (() => void) | undefined
const inputQuery = computed({ get: () => promptCommand.value ? promptValue.value : query.value, set: value => { if (promptCommand.value) { promptValidation.cancel(); promptValue.value = value; promptError.value = "" } else query.value = value } })

const frosted = useGlass(() => props.glass)
const contentRef = ref<{ $el: HTMLElement } | null>(null)
const { claim, release, layer } = useModalLayer({ element: () => contentRef.value?.$el })

const DEFAULT_LABELS: Required<PaletteLabels> = {
  ...Object.fromEntries(Object.entries(PALETTE_MODES).map(([key, mode]) => [key, mode.label])) as Record<PaletteMode, string>,
  search: "Search",
  pinned: "Pinned",
  navigate: "navigate",
  pin: "Pin",
  unpin: "Unpin",
  undo: "Undo",
  backToResults: "Back to results",
  actionFailed: "The action could not be completed.",
  submit: "Submit",
  running: "Running…",
  select: "select",
  close: "close",
  dismiss: "Close",
  back: "back",
  searching: "Searching…",
  searchFailed: "Search is unavailable right now.",
  searchIncomplete: "Some results could not be loaded.",
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
  tab: "tab",
}

const text = useLabels<Required<PaletteLabels>>("palette", DEFAULT_LABELS, () => props.labels)
const pinnedHeading = computed(() => props.pinnedLabel ?? text.value.pinned)

const emit = defineEmits<{
  (e: "update:open", value: boolean): void
  (e: "select", command: Command): void
  (e: "update:pinned", items: RecentItem[]): void
  /**
   * A command ran — id first, because the common use is appending it to a
   * stored recency list. Fires for leaf commands only: opening a mode is
   * navigation, not a pick.
   */
  (e: "run", id: string, command: Command): void
  /**
   * A pick the recent history keeps, as the item to store: a bare id for a
   * root command, a RecentEntry for anything deeper. For apps that bind
   * `recent` and keep the history themselves: `recent = pushRecent(recent,
   * item, 20)`.
   */
  (e: "remember", item: RecentItem, command: Command): void
}>()

useModelOverlayHistory({
  mode: () => props.history,
  open: () => !!props.open,
  setOpen: (open) => emit("update:open", open),
  allowClose: async () => true,
})

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
/* The list is on screen and has rows: only then does the box point into it. */
const listShown = computed(() => !editing.value && !promptCommand.value && flat.value.length > 0)
const activeId = computed(() => (listShown.value ? optionId(selectedIndex.value) : undefined))
/* The placeholder goes away with the first letter; the box keeps saying what it is for. */
const inputName = computed(() =>
  promptCommand.value?.label ?? (mode.value ? modeChipLabel(mode.value) : text.value.title),
)
const selectedIndex = ref(0)
const selectedId = ref<string | null>(null)
/*
 * Whether someone put the highlight where it is (arrows, the pointer, Tab
 * into a row's actions and back) since the list last started over. Until then
 * the highlight follows the top of the list as results arrive.
 */
let userChose = false
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
const trailState = shallowRef<{ query: string; selectedId: string | null; chose: boolean }[]>([])
const mode = computed<Command | null>(() => trail.value[trail.value.length - 1] ?? null)

/*
 * Commands of the open mode. A static `children` array is used as given; a
 * function is a fetcher and goes through the same async path as `search`,
 * which is what lets the second step be a lookup rather than a list.
 */
const modeItems = shallowRef<Command[]>([])

const { copy } = useClipboard()
const view = useView()

/* The command's link, unless it is one the palette will not follow. */
function linkOf(c: Command | undefined): string | undefined {
  return c?.href && isSafeHref(c.href) ? c.href : undefined
}

function actionsOf(c: Command | undefined): Command[] {
  if (!c || c.disabled || moreOf.has(c)) return []
  const own = c.actions ?? []
  // Read when used, not here: this runs while rendering, on the server too.
  const href = linkOf(c)
  if (!href) return own
  return [
    ...own,
    {
      id: `${c.id}:open-in-new-tab`,
      label: text.value.openInNewTab,
      icon: "lucide:external-link",
      onSelect: () => viewWindow(view.value).open(href, "_blank", "noopener"),
    },
    {
      id: `${c.id}:copy-link`,
      label: text.value.copyLink,
      icon: "lucide:link",
      onSelect: () => void copy(absoluteHref(href, viewWindow(view.value).document.baseURI), { toast: text.value.linkCopied || false }),
    },
  ]
}

const selectedActions = computed(() => actionsOf(flat.value[selectedIndex.value]))

// The visible part of the screen while a phone's keyboard is up (see paletteViewport).
const viewport = usePaletteViewport(() => props.open)

/*
 * Tab is free for this: the rows are out of the tab order and the box is the
 * only field, so Tab otherwise just walks off to the dialog's edge. Without
 * actions it keeps that default.
 */
function onTab(event: KeyboardEvent) {
  if (promptCommand.value) return
  // Without actions Tab stays Tab, so the trail chips and a Retry button are
  // still reachable from the keyboard.
  if (event.shiftKey) return
  const c = flat.value[selectedIndex.value]
  const actions = selectedActions.value
  if (!c || !actions.length) return
  event.preventDefault()
  event.stopPropagation()
  openActions(c)
}
/*
 * A long press on a phone, a right click elsewhere: the row's actions. On a
 * touch screen there is no hover to make a row the active one, so this is the
 * only way to the actions of any row but the first. A row without actions
 * keeps the browser's own menu.
 */
function onRowContextMenu(event: MouseEvent, c: Command) {
  if (!actionsOf(c).length) return
  event.preventDefault()
  openActions(c)
}

function openActions(c: Command) {
  const actions = actionsOf(c)
  if (!actions.length) return
  const actionsMode: Command = { id: `${c.id}:actions`, label: c.label, icon: c.icon, children: actions }
  syntheticModes.add(actionsMode)
  hints.use(HINT_SIGNALS.paletteActions)
  // Opening a row's actions picks that row: back out, and it is still the one.
  const index = flatIndexOf(c)
  if (index >= 0) choose(index)
  enter(actionsMode)
  inputRef.value?.focus()
}

// A returning user who never pressed Tab gets the footer key lit up, nothing
// more: the palette is the one place they already came to on purpose.
const PALETTE_ACTIONS_AFTER = 3
const showActionsKey = computed(() => {
  const system = runningHintSystem()
  return !!system?.state.loaded
    && system.count(HINT_SIGNALS.palette) >= PALETTE_ACTIONS_AFTER
    && system.count(HINT_SIGNALS.paletteActions) === 0
})

/*
 * A mode holds the command it was entered through, and a static `children`
 * list is a snapshot of that moment. When the app rebuilds its commands (a
 * theme list whose tick follows the active theme), the open mode is matched
 * to the new commands by id along its path and takes their children, so a
 * `keepOpen` pick inside it shows its own effect.
 */
watch(
  () => rootCommands.value,
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
    const fetcherBefore = mode.value?.children
    trail.value = next
    const children = next[next.length - 1]?.children
    if (Array.isArray(children)) modeItems.value = children
    // A new fetcher may answer differently: ask again, with the old rows up
    // until it does, so a refresh of the app's commands does not blank the list.
    else if (children !== fetcherBefore) refresh(true)
  },
)

function enter(c: Command, parentQuery = query.value) {
  trailState.value = [...trailState.value, { query: parentQuery, selectedId: selectedId.value, chose: userChose }]
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
  const state = trailState.value[depth] || { query: "", selectedId: null, chose: false }
  const next = trail.value.slice(0, Math.max(0, depth))
  trailState.value = trailState.value.slice(0, Math.max(0, depth))
  trail.value = next
  const parent = next[next.length - 1]
  modeItems.value = parent && Array.isArray(parent.children) ? parent.children : []
  query.value = state.query
  select(0)
  refresh()
  void nextTick(() => {
    const index = state.selectedId ? flat.value.findIndex((c) => rowId(c) === state.selectedId) : -1
    // Back on the row someone chose before going in; a row they never chose,
    // or one not loaded again yet, leaves the list following its top.
    if (index >= 0 && state.chose) choose(index)
    else select(0)
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
const { found, searching, failed, incomplete, refresh, cancel, clear: clearFound } = usePaletteFetch({
  fetcher: () => {
    const current = mode.value
    if (current) return typeof current.children === "function" ? current.children : null
    return props.search ?? null
  },
  inMode: () => mode.value !== null,
  query,
  minChars: () => props.minChars,
  debounce: () => props.debounce,
})

// ── filtering + scoring ──────────────────────────────────────
/*
 * What the query filters: the open mode's own children, or the root commands.
 * A mode is a context, not a filter over the parent list — showing the root
 * next to "which service?" is how a palette gets someone to restart the wrong
 * thing.
 */
const source = computed<Command[]>(() => (mode.value ? modeItems.value : rootCommands.value))

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
  // Fallback rows are not matched against the query; they get their own pass.
  const filtered = query.value.trim()
    ? source.value.filter((c) => !c.fallback)
    : source.value.filter((c) => !c.hidden && !c.fallback)
  // Empty query: show everything EXCEPT hidden commands. With a query, a hidden
  // command ranks only when the query names it (see commandSearch).
  if (!terms.include.length && !terms.exclude.length && !terms.groups.length) return { items: filtered, terms: [] }
  return searchCommandItems(filtered, terms)
})

const ranked = computed<Command[]>(() => local.value.items)

/*
 * Fetched results sit under their own heading unless they brought a group of
 * their own, so they never look like they were part of the static list. An id
 * already matched locally, or already answered by the provider, is dropped:
 * the same command listed twice is a misclick waiting to happen.
 */
const fetched = computed<Command[]>(() => {
  if (!found.value.length) return []
  const seen = new Set(ranked.value.map((c) => c.id))
  const rows: Command[] = []
  for (const c of found.value) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    rows.push(c.group ? c : { ...c, group: props.resultsLabel })
  }
  return applyQueryFilters(rows, parseCommandQuery(query.value))
})

/*
 * "Search elsewhere" rows for the typed words, labelled with them. The row
 * on screen is a copy with the label filled in; the command it stands for
 * is what runs and what a mode chip names.
 */
const fallbackOf = new WeakMap<Command, Command>()
const fallbacks = computed<Command[]>(() =>
  fallbackRows(source.value, query.value).map(({ command, label }) => {
    const row = { ...command, label }
    fallbackOf.set(row, command)
    return row
  }),
)

/*
 * Recent picks, newest first, lifted out of the list they already belong to.
 * Only on the root's empty query: once someone types, or drills into a mode,
 * relevance is the better order and a duplicated row is just noise. Pins sit
 * above them. See paletteHistory.
 */
const { recentItems, pinnedItems, syntheticModes, inSyntheticMode, remember, isPinned, togglePin, rowId } = usePaletteHistory({
  recent: () => props.recent,
  recentKey: () => props.recentKey,
  pinned: () => props.pinned,
  pinnedKey: () => props.pinnedKey,
  resolveRecent: () => props.resolveRecent,
  recentLimit: () => props.recentLimit,
  recentLabel: () => props.recentLabel,
  pinnedHeading: () => pinnedHeading.value,
  rootCommands,
  mode,
  query,
  trail,
  isMore: (c) => moreOf.has(c),
  onRemember: (item, c) => emit("remember", item, c),
  onPinned: (items) => emit("update:pinned", items),
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
  const pinned = pinnedItems.value
  for (const c of pinned) push(c, pinnedHeading.value)
  const shown = new Set(pinned.map(rowId))
  const recent = recentItems.value.filter(c => !shown.has(rowId(c)))
  for (const c of recent) {
    push(c, props.recentLabel)
    shown.add(rowId(c))
  }
  // A recent entry is shown once: leaving the copy in its own group would put
  // the same row on screen twice with nothing to tell them apart.
  for (const c of ranked.value) if (!shown.has(rowId(c))) push(c, c.group ?? "")
  for (const c of fetched.value) push(c, c.group ?? "")
  // Last, whatever their group: they are the way out when nothing above is it.
  const tail = new Map<string, Command[]>()
  for (const c of fallbacks.value) {
    const group = c.group ?? ""
    if (map.has(group)) map.get(group)!.push(c)
    else tail.set(group, [...(tail.get(group) ?? []), c])
  }
  for (const [group, items] of tail) {
    map.set(group, items)
    order.push(group)
  }
  return order.map((name) => ({ name, items: folded(name, map.get(name)!) }))
})

/*
 * Groups unfolded by their "Show more" row. Reset with the list it applies
 * to: a new query or another mode is a new list, and its groups start folded.
 */
const expanded = ref(new Set<string>())
const moreOf = new WeakMap<Command, string>()
// The first row each "Show more" hides. Unfolding removes the "Show more" row
// itself, so the highlight has to be handed to this one: an id that is gone
// from the list sends the selection back to the top, and the list with it.
const firstHidden = new WeakMap<Command, string>()

/*
 * Folding hides at least two rows: a "Show 1 more" row takes the same space
 * as the row it hides.
 */
function folded(name: string, items: Command[]): Command[] {
  const limit = props.groupLimit
  if (!limit || items.length <= limit + 1 || expanded.value.has(name)) return items
  const more: Command = {
    id: moreRowId(name),
    label: text.value.showMore.replace("{count}", String(items.length - limit)),
    icon: "lucide:chevron-down",
    keepOpen: true,
  }
  moreOf.set(more, name)
  firstHidden.set(more, rowId(items[limit]))
  return [...items.slice(0, limit), more]
}

// Flat list in render order — what arrow keys walk through.
const flat = computed(() => grouped.value.flatMap((g) => g.items))

const slots = defineSlots<{
  /**
   * Body of the preview pane for the highlighted command. `highlight(text)`
   * splits any text around the words typed (positive terms only, plus the
   * command's own `highlight` words), the same matching the rows use; the
   * LpPalette* blocks take its result wherever they take text, and
   * `query` is the parsed box for anything else.
   */
  preview?: (props: { command: Command; highlight: (text: string) => HighlightPart[]; query: PaletteQuery }) => unknown
}>()

const active = computed<Command | undefined>(() => {
  const c = flat.value[selectedIndex.value]
  return c && !moreOf.has(c) ? c : undefined
})
const canPin = computed(() => active.value && !active.value.children && !moreOf.has(active.value) && !inSyntheticMode())

// The preview pane beside the list (see palettePane).
const { previewRef, paneCommand, paneOpen, paneBody } = usePalettePane({
  previewPane: () => props.previewPane,
  hasPreview: () => props.hasPreview,
  slot: () => !!slots.preview,
  editing,
  active,
  prompting: () => !!promptCommand.value,
})

function paneHighlight(text: string): HighlightPart[] {
  return highlight(text, paneBody.value?.highlight)
}
const paneQuery = computed(() => parsePaletteQuery(query.value.trim()))

// Rows ask for their index several times per render; a lookup keeps that O(1)
// instead of a scan of the whole list per row.
const flatIndex = computed(() => new Map(flat.value.map((c, i) => [c, i])))
function flatIndexOf(c: Command): number {
  return flatIndex.value.get(c) ?? -1
}

// ── highlight ────────────────────────────────────────────────
// Split text around the positive query terms (and a row's own `highlight`
// words) for <mark> wrapping, without v-html. Exclusions are never marked.
function highlight(value: string, extra: string[] = []): HighlightPart[] {
  return highlightParts(value, [...local.value.terms, ...extra])
}

// ── selection + keyboard ─────────────────────────────────────
watch(query, (value) => {
  if (enterByPrefix(value)) return
  select(0)
  refresh()
})

/*
 * A prefix typed (or pasted) at the start of the box opens its mode with the
 * rest of the text as the query there. The list it leaves is remembered with
 * an empty query: Backspace out of the mode should land on the plain list,
 * not on the prefix, which would open the mode again on the spot.
 */
function enterByPrefix(value: string): boolean {
  const hit = matchModePrefix(value, source.value)
  if (!hit) return false
  enter(hit.command, "")
  query.value = hit.rest
  return true
}
watch([query, trail, () => props.open], () => {
  expanded.value = new Set()
  keyboardSelection.value = true
})
// Sync, so the rows a new query brings are never placed by the last query's pick.
watch([query, trail, () => props.open], () => { userChose = false }, { flush: "sync" })
watch(
  () => flat.value.map(rowId).join("|"),
  () => {
    keyboardSelection.value = true
    select(keptHighlight(flat.value.map(rowId), selectedId.value, userChose))
  },
)
watch([selectedIndex, () => flat.value.map(rowId).join("|")], async () => {
  await nextTick()
  scrollSelectedIntoView()
})

function scrollSelectedIntoView() {
  const viewportEl = scrollRef.value?.viewportEl
  // Not chosen yet: the top of the list is on screen, headings and notes
  // above the highlight included, so rows streaming in above stay in sight.
  if (viewportEl && !userChose) viewportEl.scrollTop = 0
  const el = viewportEl?.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex.value}"]`)
  el?.scrollIntoView({ block: "nearest" })
}

const keyboardSelection = ref(false)

// A disabled row is a note, not a choice (an error, a summary above the
// results): the highlight steps over it in the direction it was moving, so
// Enter never lands on a row that does nothing. Only an all-disabled list keeps it.
function select(index: number, keyboard = false, step: 1 | -1 = 1) {
  const len = flat.value.length
  let next = len ? clamp(index, 0, len - 1) : 0
  for (let tried = 0; tried < len && flat.value[next]?.disabled; tried++) next = (next + step + len) % len
  selectedIndex.value = flat.value[next]?.disabled ? (len ? clamp(index, 0, len - 1) : 0) : next
  const row = flat.value[selectedIndex.value]
  selectedId.value = row ? rowId(row) : null
  if (keyboard) {
    keyboardSelection.value = true
    userChose = true
  }
}

function moveDown() {
  const len = flat.value.length
  if (len) select((selectedIndex.value + 1) % len, true)
}
function moveUp() {
  const len = flat.value.length
  if (len) select((selectedIndex.value - 1 + len) % len, true, -1)
}
function movePage(direction: -1 | 1) {
  select(selectedIndex.value + direction * 8, true, direction)
}
function onPaletteKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.target !== inputRef.value || promptCommand.value) return
  if (event.altKey && event.key.toLowerCase() === "p") {
    event.preventDefault()
    togglePin(active.value)
    return
  }
  if (!(["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"] as string[]).includes(event.key)) return
  // Home and End belong to the caret while there is text to move it through.
  const typing = inputRef.value?.value !== ""
  if (typing && (event.key === "Home" || event.key === "End")) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === "ArrowDown") moveDown()
  else if (event.key === "ArrowUp") moveUp()
  else if (event.key === "Home") select(0, true)
  else if (event.key === "End") select(flat.value.length - 1, true, -1)
  else movePage(event.key === "PageDown" ? 1 : -1)
}
/*
 * A row that appears under a still pointer gets a pointerenter of its own, and
 * browsers can send a move of zero after a layout: neither is the user choosing
 * it. The selection stays where the keyboard or the list put it until the
 * pointer really moves, and that first move picks the row it is over.
 */
let hovered: Command | null = null
function onPointerMove(event: PointerEvent) {
  if (!keyboardSelection.value || (!event.movementX && !event.movementY)) return
  keyboardSelection.value = false
  if (hovered) choose(flatIndexOf(hovered))
}
/* A pick by the pointer: from here on the highlight stays with its row. */
function choose(index: number) {
  userChose = true
  select(index)
}
function onCloseAutoFocus(event: Event) {
  if (!afterClose) return
  event.preventDefault()
  const focus = afterClose
  afterClose = undefined
  requestAnimationFrame(focus)
}
async function focusEditor() {
  stopEditorFocus?.()
  await nextTick()
  if (!editing.value) return
  const root = previewRef.value?.viewportEl
  if (!root) return
  const focus = () => {
    const body = root.querySelector("[data-lp-command-preview]")
    const field = body?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]):not([tabindex="-1"]):not([aria-hidden="true"]),textarea:not([disabled]):not([tabindex="-1"]),select:not([disabled]),[contenteditable="true"]')
      ?? body?.querySelector<HTMLElement>('button:not([disabled]):not([tabindex="-1"]),[tabindex="0"]')
    field?.focus()
    return !!field
  }
  if (focus()) return
  const observer = new (nodeWindow(root).MutationObserver)(() => { if (focus()) { observer.disconnect(); stopEditorFocus = undefined } })
  observer.observe(root, { childList: true, subtree: true })
  stopEditorFocus = () => { observer.disconnect(); stopEditorFocus = undefined }
}
watch([editing, () => props.open], () => { if (!editing.value || !props.open) stopEditorFocus?.() })
onBeforeUnmount(() => stopEditorFocus?.())
function onPointerEnter(c: Command) {
  hovered = c
  if (!keyboardSelection.value) choose(flatIndexOf(c))
}
function onPointerLeave() {
  hovered = null
}
function runSelected(event?: KeyboardEvent) {
  if (promptCommand.value) { void submitPrompt(); return }
  const c = flat.value[selectedIndex.value]
  if (c && linkOf(c) && !c.disabled && (event?.ctrlKey || event?.metaKey)) {
    openInNewTab(c)
    return
  }
  run(c)
}

function openInNewTab(c: Command) {
  const href = linkOf(c)
  if (!href) return
  viewWindow(view.value).open(href, "_blank", "noopener")
  emit("run", c.id, c)
  remember(c)
  emit("update:open", false)
}

/*
 * A modified click on a link is the browser's to handle: it opens a tab or a
 * window and this page stays where it is, so the palette neither runs the
 * command nor closes. Only the plain click is taken over.
 */
function onRowClick(event: MouseEvent, c: Command) {
  if (linkOf(c) && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return
  event.preventDefault()
  run(c)
}

async function run(row: Command | undefined) {
  // A closing palette has already reset to its first rows, where the command
  // just run sits again as recent: an Enter that lands during the fade ran it
  // a second time (two snapshots for one pick).
  if (!props.open) return
  if (!row || row.disabled || executing.value) return
  const c = fallbackOf.get(row) ?? row
  // The highlight stays on the same index, which is now the first row that
  // was hidden: the arrows carry on from where the fold was.
  const group = moreOf.get(row)
  if (group !== undefined) {
    selectedId.value = firstHidden.get(row) ?? null
    userChose = true
    expanded.value = new Set([...expanded.value, group])
    inputRef.value?.focus()
    return
  }
  if (c.editInPreview && c.previewComponent) {
    editing.value = c
    paneCommand.value = c
    await focusEditor()
    return
  }
  if (c.prompt) {
    promptCommand.value = c
    promptValue.value = c.prompt.initial ?? ""
    promptError.value = ""
    inputRef.value?.focus()
    return
  }
  if (!await execute(c, () => c.onSelect?.())) return
  const href = linkOf(c)
  if (!c.onSelect && href && !c.children) viewWindow(view.value).location.assign(href)
  // A command with children drills in instead of closing, and is navigation
  // rather than a pick — so it stays out of the recency history.
  if (c.children) {
    const carried = query.value
    enter(c)
    if (c.carryQuery) query.value = carried
    return
  }
  emit("run", c.id, c)
  remember(c)
  if (c.keepOpen) {
    // Back to the top of a fresh list: the query that found this command is
    // spent, and leaving it would hide whatever the action just changed.
    query.value = ""
    // Inside a mode the highlight stays on what was just picked, so trying
    // themes one after another is a matter of the arrow keys; at the root the
    // list it came from is gone and the top is the honest place to land.
    if (mode.value) void nextTick(() => choose(Math.max(0, flat.value.findIndex((x) => x.id === c.id))))
    else select(0)
    inputRef.value?.focus()
    return
  }
  afterClose = c.afterClose
  emit("update:open", false)
}

async function execute(command: Command, action: () => unknown | Promise<unknown>): Promise<boolean> {
  if (executing.value) return false
  executing.value = true
  actionError.value = ""
  const epoch = executionEpoch
  try {
    emit("select", command)
    const result = await action()
    if (command.undo) toast.success(command.label, { duration: 8000, actions: [{ label: text.value.undo, onClick: async () => { await command.undo!(result) } }] })
    return epoch === executionEpoch
  } catch (error) {
    if (epoch === executionEpoch) actionError.value = error instanceof Error ? error.message : text.value.actionFailed
    return false
  } finally { executing.value = false }
}
function submitPrompt() {
  const command = promptCommand.value
  if (!command?.prompt || executing.value || validating.value) return
  const value = promptValue.value
  promptValidation.run(() => command.prompt!.validate?.(value), {
    apply: error => { void completePrompt(command, value, error) },
    fail: error => { promptError.value = error instanceof Error ? error.message : text.value.actionFailed },
  })
}
async function completePrompt(command: Command, value: string, error: string | undefined) {
  if (promptCommand.value !== command || promptValue.value !== value) return
  promptError.value = error ?? ""
  if (promptError.value || !await execute(command, () => command.prompt!.submit(value))) return
  remember(command)
  emit("run", command.id, command)
  if (promptCommand.value !== command) return
  promptCommand.value = undefined
  afterClose = command.afterClose
  if (!command.keepOpen) emit("update:open", false)
}

/*
 * Backspace on an empty query leaves the mode. Mirrors how the Slack and
 * Linear palettes behave, and means the way out is the key already under the
 * finger — Escape stays the way out of the palette itself.
 */
function onBackspace(event: KeyboardEvent) {
  if (promptCommand.value || query.value) return
  if (back()) event.preventDefault()
}

/*
 * Escape unwinds one mode at a time and only closes at the root, so drilling
 * in three levels does not make leaving one an all-or-nothing choice. reka's
 * Dialog would close on its own, so the key is handled here and declined
 * (stopPropagation) only while there is a mode to pop.
 */
function onEscape(event: KeyboardEvent) {
  if (promptCommand.value || editing.value) {
    event.preventDefault()
    event.stopPropagation()
    promptCommand.value = undefined
    editing.value = undefined
    inputRef.value?.focus()
    return
  }
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
    if (o) {
      claim()
      hints.use(HINT_SIGNALS.palette)
    } else release()
    executionEpoch++
    editing.value = undefined
    promptCommand.value = undefined
    promptError.value = ""
    actionError.value = ""
    cancel()
    query.value = ""
    select(0)
    selectedId.value = null
    trail.value = []
    trailState.value = []
    modeItems.value = []
    clearFound()
    if (o) {
      await nextTick()
      // Closed again meanwhile: the box belongs to a dialog on its way out.
      if (props.open) inputRef.value?.focus()
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

// Overlays open in the window this component renders in (an LpFrame's, inside one).
const portalTo = usePortalTarget()
// What happens in another document (the page around a frame, or a frame in
// the page) is not "outside" for this layer.
const guardOutside = useOutsideGuard()
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogPortal :to="portalTo">
      <DialogOverlay
        :class="{ 'lp-scrim--light': frosted, 'lp-scrim--nested': layer.nested, 'lp-scrim--covered': layer.covered }"
        class="lp-scrim fixed inset-0 data-[state=open]:animate-[fade-in_150ms_ease] data-[state=closed]:animate-[fade-out_130ms_ease]"
        :style="{ zIndex: layer.scrim }"
      />
      <DialogContent
        @interact-outside="guardOutside"
        @escape-key-down="event => { guardOutside(event); if (!event.defaultPrevented) onEscape(event) }"
        @close-auto-focus="onCloseAutoFocus"
        ref="contentRef"
        class="lp-cmd-dialog fixed left-1/2 top-[12vh] flex max-h-[76dvh] -translate-x-1/2 flex-col overflow-hidden rounded-card border border-line shadow-panel outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-emphasized)] data-[state=closed]:animate-[pop-out_130ms_ease]"
        :class="[frosted ? (layer.nested ? 'lp-glass-overlay lp-glass-overlay--nested' : 'lp-glass-overlay') : 'bg-surface-raised', previewPane && 'lp-cmd-split']"
        :style="{ zIndex: layer.panel, ...viewport }"
        :data-pane="paneOpen ? 'open' : undefined"
        :data-editing="editing ? '' : undefined"
        @open-auto-focus.prevent
        @keydown.capture="onPaletteKeydown"
      >
        <DialogTitle class="sr-only">{{ text.title }}</DialogTitle>
        <DialogDescription class="sr-only">{{ text.description }}</DialogDescription>

        <!-- Filter. The trail sits inside the box as chips, the way a scoped
             search reads everywhere else: what you type is filtered by what is
             to its left. -->
        <div class="relative flex shrink-0 items-center gap-2.5 border-b border-line px-4">
          <LpIcon
            v-if="!executing && !validating"
            name="lucide:search"
            :size="18"
            class="shrink-0 text-muted"
          />
          <!-- At once, since it takes the search icon's place. -->
          <LpLoader
            v-else
            size="inline"
            :delay="0"
            :labels="{ loading: text.running }"
            class="shrink-0 text-[18px] text-muted"
          />
          <!-- A search under way runs a bar along the box's lower edge, over
               the border, for as long as it lasts: results that stream in
               batches are already on screen by then, and the bar is what says
               more may come. It is also what tells a screen reader a search
               went out, so it speaks. -->
          <LpLoader
            v-if="searching"
            variant="bar"
            size="sm"
            tone="brand"
            :labels="{ loading: text.searching }"
            class="pointer-events-none absolute inset-x-0 -bottom-px"
          />

          <button
            v-for="(step, i) in trail"
            :key="step.id"
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-inner bg-brand-soft px-2 py-1 text-xs font-medium text-brand transition-opacity hover:opacity-80"
            :title="text.back"
            @click="popTo(i)"
          >
            <LpIcon v-if="step.icon" :name="step.icon" :size="13" />
            {{ modeChipLabel(step) }}
            <LpIcon name="lucide:x" :size="12" class="opacity-60" />
          </button>

          <input
            ref="inputRef"
            v-model="inputQuery"
            :readonly="executing && !!promptCommand"
            @focus="editing = undefined"
            type="text"
            enterkeyhint="go"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            role="combobox"
            aria-autocomplete="list"
            :aria-label="inputName"
            :aria-expanded="listShown"
            :aria-controls="listShown ? listId : undefined"
            :aria-activedescendant="activeId"
            :placeholder="promptCommand?.prompt?.placeholder ?? mode?.childPlaceholder ?? placeholder"
            class="lp-entry h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            @keydown.enter.prevent="runSelected"
            @keydown.backspace="onBackspace"
            @keydown.esc="onEscape"
            @keydown.tab="onTab"
          />
          <kbd class="shrink-0 rounded-small border border-line px-1.5 py-0.5 text-[10px] text-muted [@media(hover:none)_and_(pointer:coarse)]:hidden">{{ text.esc }}</kbd>
          <!-- A finger has no Esc, and tapping the dim edge is not there when
               the palette fills the screen: the way out is a button. -->
          <button
            type="button"
            class="hidden shrink-0 rounded-inner px-2 py-1.5 text-sm font-medium text-brand outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:none)_and_(pointer:coarse)]:inline-flex"
            @click="emit('update:open', false)"
          >
            {{ text.dismiss }}
          </button>
        </div>

        <div v-if="promptCommand" class="flex flex-col gap-3 p-4">
          <p class="text-sm font-semibold">{{ promptCommand.label }}</p>
          <p v-if="promptError" role="alert" class="text-sm text-danger">{{ promptError }}</p>
          <div class="flex gap-2"><LpButton :loading="executing || validating" @click="submitPrompt">{{ text.submit }}</LpButton><LpButton variant="ghost" @click="promptCommand = undefined; inputRef?.focus()">{{ text.backToResults }}</LpButton></div>
        </div>
        <p v-if="actionError" role="alert" class="px-4 py-2 text-sm text-danger">{{ actionError }}</p>
        <!-- Touch only: there the footer with its keys is hidden, and these are
             the only way to the row's actions and pin. On a pointer the same
             buttons live in the footer, so the list never shifts under this strip. -->
        <div v-if="active && (canPin || selectedActions.length) && !promptCommand" class="hidden items-center justify-end gap-2 border-b border-line px-3 py-1 [@media(hover:none)_and_(pointer:coarse)]:flex">
          <LpButton v-if="selectedActions.length" size="xs" variant="ghost" @click="openActions(active)">{{ text.actions }}</LpButton>
          <LpButton v-if="canPin" size="xs" variant="ghost" :aria-label="isPinned(active) ? text.unpin : text.pin" :aria-pressed="isPinned(active)" @click="togglePin(active)"><LpIcon name="lucide:star" :size="14" />{{ isPinned(active) ? text.unpin : text.pin }}</LpButton>
        </div>
        <!-- Results -->
        <div class="flex min-h-0 flex-1" @pointermove="onPointerMove">
          <LpScrollArea v-show="!editing && !promptCommand" ref="scrollRef" class="lp-cmd-list min-h-0 min-w-0 flex-1" content-class="p-2">
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
                <PaletteRow
                  v-for="c in group.items"
                  :id="optionId(flatIndexOf(c))"
                  :key="rowId(c)"
                  :command="c"
                  :index="flatIndexOf(c)"
                  :selected="flatIndexOf(c) === selectedIndex"
                  :more="moreOf.has(c)"
                  :href="linkOf(c)"
                  :excerpt-lines="excerptLines"
                  :highlight="highlight"
                  @click="onRowClick($event, c)"
                  @contextmenu="onRowContextMenu($event, c)"
                  @pointerenter="onPointerEnter(c)"
                  @pointerleave="onPointerLeave"
                />
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
              <span>{{ incomplete ? text.searchIncomplete : text.searchFailed }}</span>
              <button
                type="button"
                class="rounded-inner px-1.5 py-0.5 font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-ring"
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
              class="lp-cmd-pane min-h-0 flex-col"
              :class="editing ? 'flex min-w-0 flex-1' : 'hidden shrink-0 border-l border-line md:flex'"
            >
              <LpScrollArea ref="previewRef" class="min-h-0 flex-1" content-class="px-5 py-4">
                <!-- Keyed by the row, so moving the highlight replays the
                     entrance rather than swapping text in place. -->
                <div v-if="paneBody" :key="paneBody.id">
                  <LpButton v-if="editing" size="sm" variant="ghost" class="mb-3" @click="editing = undefined; inputRef?.focus()">{{ text.backToResults }}</LpButton>
                  <PalettePreviewBoundary>
                  <slot name="preview" :command="paneBody" :highlight="paneHighlight" :query="paneQuery">
                    <component v-if="paneBody.previewComponent" :is="paneBody.previewComponent" />
                    <PalettePaneText v-else :command="paneBody" :highlight="highlight" />
                  </slot>
                  </PalettePreviewBoundary>
                  <div v-if="actionsOf(paneBody).length" class="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                    <LpButton v-for="action in actionsOf(paneBody)" :key="action.id" size="sm" variant="outline" :disabled="action.disabled || executing" @click="run({ ...action, remember: false })">{{ action.label }}</LpButton>
                  </div>
                </div>
              </LpScrollArea>
            </aside>
          </Transition>
        </div>

        <!-- Footer hints. -->
        <PaletteFooter
          :text="text"
          :actions="!!(selectedActions.length && active)"
          :lit-actions="showActionsKey"
          :can-pin="!!(canPin && active && !promptCommand)"
          :pinned="!!active && isPinned(active)"
          :in-mode="trail.length > 0"
          @actions="active && openActions(active)"
          @pin="togglePin(active)"
        />
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
    min-height: min(76dvh, 36rem);
  }
}
.lp-cmd-pane {
  width: var(--lp-cmd-pane);
}
/*
 * A phone: a sheet over the whole visible screen rather than a card floating
 * a tenth of the way down, which left a band of nothing above it and let the
 * keyboard cover its lower half. Keyed to touch as well as width, so a narrow
 * desktop window keeps the card.
 */
@media (hover: none) and (pointer: coarse) and (max-width: 639px) {
  .lp-cmd-dialog {
    inset: var(--lp-cmd-vy, 0) auto auto var(--lp-cmd-vx, 0);
    translate: none;
    width: var(--lp-cmd-vw, 100%);
    height: var(--lp-cmd-vh, 100dvh);
    max-height: var(--lp-cmd-vh, 100dvh);
    border-width: 0;
    border-radius: 0;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
.lp-cmd-dialog[data-editing] .lp-cmd-pane {
  width: 100%;
}
.lp-cmd-dialog[data-editing] {
  width: var(--lp-cmd-list);
  min-height: 0;
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
@media (prefers-reduced-motion: reduce) {
  .lp-cmd-split,
  .lp-cmd-pane-enter-active,
  .lp-cmd-pane-leave-active {
    transition: none;
  }
}
</style>
