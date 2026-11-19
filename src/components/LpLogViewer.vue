<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it a second
// time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Terminal-flavoured log stream. Monospace rows, a tonal level gutter, optional
 * timestamps + source tags, search highlighting, and a sticky "tail" that pins
 * to the bottom as lines arrive (drops out the moment you scroll up, with a
 * jump-to-latest pill to re-arm). Built on LpScrollArea, which exposes its
 * viewport element and re-emits the native scroll event — exactly what tailing
 * needs.
 */
import {
  computed,
  nextTick,
  ref,
  TransitionGroup,
  watch,
} from "vue"
import { usePersisted } from "../composables/usePersisted"
import { useClipboard } from "../composables/useClipboard"
import { useHotkeys } from "../composables/useHotkeys"
import LpBadge from "./LpBadge.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpIcon from "./LpIcon.vue"
import LpLoader from "./LpLoader.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LogViewerToolbar from "./LogViewerToolbar.vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useLabels } from "../composables/useLpConfig"
import { isElement, nodeWindow } from "../composables/useView"
import { countLevels, matchPositions, stepMatch } from "./logSearch"
import { downloadFile } from "./exportData"
import LpLogInspector from "./LpLogInspector.vue"
import {
  compilePattern,
  exportLines,
  findIds,
  groupRepeats,
  inTimeRange,
  messageParts,
  nearestByTime,
  patternPositions,
  rowSpan,
  termRanges,
  type LogExportFormat,
  type LogId,
  type LogTimeRange,
  type MessagePart,
} from "./logTools"
import { formatLogTime as fmtTime, LOG_LEVEL_ORDER, logLevelLook as metaFor, logLineText as lineText, parseLogLine } from "./logFormat"
import { useLogFreeze } from "./logFreeze"
import { useLogTail } from "./logTail"
import type { LogLevel, LogLine, LogViewerLabels } from "./logViewerTypes"

// The public types live in logViewerTypes.ts; re-exported so imports from the SFC keep working.
export type { LogLevel, LogLine, LogViewerLabels } from "./logViewerTypes"

const props = withDefaults(
  defineProps<{
    lines: LogLine[]
    /** Show the timestamp column. */
    showTime?: boolean
    /**
     * Show the per-line level chip (INFO/WARN/…). On by default. Turn off for
     * raw streams (e.g. docker logs) where most lines have no real level and a
     * blanket "INFO" chip is just noise — the tonal level RAIL still renders, so
     * errors/warnings stay visually distinct.
     */
    showLevel?: boolean
    /** Show 1-based gutter line numbers. */
    lineNumbers?: boolean
    /** Wrap long lines instead of scrolling horizontally. */
    wrap?: boolean
    /** Case-insensitive substring to highlight in message bodies. */
    highlight?: string
    /** When set with `highlight`, hide every line that doesn't match. */
    filterMatches?: boolean
    /** Collapse consecutive identical lines into one, badged with a ×N count. */
    compact?: boolean
    /** Pin to the bottom as new lines arrive (until the user scrolls up). */
    tail?: boolean
    /** Fixed height. Anything CSS-valid; defaults to a comfortable terminal. */
    height?: string
    emptyLabel?: string
    /** Shown while the stream is held. Defaulted in English; apps with i18n
     *  pass their own. */
    frozenLabel?: string
    /**
     * When true, a "loading older…" row is shown pinned at the top — set it while
     * fetching a previous page in response to `reach-top`, clear it when done.
     */
    loadingOlder?: boolean
    /**
     * When true, the viewer emits `reach-top` as the user scrolls near the top so
     * the consumer can prepend older history (infinite scroll-back). The viewer
     * preserves the scroll position across a prepend so the view doesn't jump.
     */
    loadOlder?: boolean
    /**
     * Right-click row menu: built-in copy actions (+ "filter by" when the line
     * has a source/level). Set false to disable; the row keeps the native menu.
     */
    rowMenu?: boolean
    /** Extra menu items per line, appended below the built-ins with a divider. */
    extraRowItems?: (line: LogLine, index: number) => ContextMenuItemDef[]
    /**
     * Recognise common log formats inside each `message` and lift the level,
     * timestamp and [source] out of the text into the dedicated columns. When a
     * line already carries an explicit `level`/`time`/`source`, those win and
     * the message is left untouched. Off by default (raw). Handles e.g.:
     *   "2025-01-02T03:04:05.123Z INFO [auth] user logged in"
     *   "[2025-01-02 03:04:05] WARN: disk almost full"
     *   "ERROR something broke"
     * so a duplicate level word / timestamp doesn't repeat in the message body.
     */
    parse?: boolean
    /**
     * Keep only the newest N lines on screen. The consumer can keep pushing
     * into the same array (or hand over a longer one) and the viewer shows the
     * tail; trimming the source itself is still the cheaper way to cap memory.
     */
    maxLines?: number
    /**
     * A bar above the stream with a search box (Enter / Shift+Enter or F3 step
     * through matches) and level chips. The term binds via `v-model:search`,
     * the chosen levels via `v-model:levels`.
     */
    toolbar?: boolean
    /**
     * Remember the level chips across visits under this key (the kit's
     * storage, see `usePersisted`): someone who only ever reads errors should
     * not pick them again every time.
     */
    persist?: string
    /**
     * Adds to the toolbar what reading a busy stream calls for: a regular
     * expression toggle, source chips, folding repeats, and copy and download
     * of the selection. Each is also its own model or prop.
     */
    tools?: boolean
    /** Only lines inside this span (inclusive). A line with no readable time stays. */
    timeRange?: LogTimeRange
    /**
     * Fold every repeat of a message into its first line with a count, wherever
     * they sit: numbers, ids and hashes are blanked first, so "job 41 failed"
     * and "job 42 failed" count as one. Stronger than `compact`, which keeps
     * chronology by folding runs of the same text only.
     */
    group?: boolean
    /** Make trace, request, span and correlation ids in a message clickable (`id-click`). */
    linkIds?: boolean
    /** Click selects a line, Shift+click a range (`v-model:selection`, `select`). */
    selectable?: boolean
    /** Show the selected line in an LpLogInspector under the stream. Needs `selectable`. */
    inspector?: boolean
    /** File name for a download, without its extension. */
    fileName?: string
    labels?: Partial<LogViewerLabels>
  }>(),
  {
    showTime: true,
    showLevel: true,
    lineNumbers: false,
    wrap: false,
    tail: true,
    height: "20rem",
    rowMenu: true,
    parse: false,
  },
)

const emit = defineEmits<{
  /** A "Filter by source/level" item was chosen — the consumer applies it. */
  (e: "filter", by: { source?: string; level?: LogLevel }): void
  /**
   * The user scrolled near the top with `loadOlder` on — fetch the previous
   * page. Re-armed only after the scroll leaves the top zone, so one trip up
   * fires once. The viewer keeps the scroll anchored when the page prepends.
   */
  (e: "reach-top"): void
  /** A line was selected: the link to whatever else on the page follows it. */
  (e: "select", payload: { line: LogLine; index: number }): void
  /** A correlation id was clicked (`linkIds`). */
  (e: "id-click", payload: { kind: LogId["kind"]; value: string; line: LogLine }): void
}>()

/** The toolbar's search term. Without the toolbar, `highlight` is the term. */
const query = defineModel<string>("search", { default: "" })
/** Levels to show. Empty shows every level. */
const levels = defineModel<LogLevel[]>("levels", { default: () => [] })
/** Read the search as a regular expression. */
const regex = defineModel<boolean>("regex", { default: false })
/** Sources to show. Empty shows every source. */
const sources = defineModel<string[]>("sources", { default: () => [] })
/** The selected span as original line numbers, first to last. */
const selection = defineModel<[number, number] | null>("selection", { default: null })
/** Fold repeats; the prop sets it, the toolbar's toggle flips it. */
const grouped = ref(!!props.group)
watch(() => props.group, (on) => (grouped.value = !!on))
const storedLevels = usePersisted<string[] | null>(
  () => props.persist && `lp-log-viewer:${props.persist}:levels`,
  null,
  { validate: (value): value is string[] | null => value === null || (Array.isArray(value) && value.every((l) => typeof l === "string")) },
)
// The stored choice fills an empty filter once; an app that already passes
// levels keeps its own.
if (storedLevels.value?.length && !levels.value.length) levels.value = storedLevels.value as LogLevel[]
watch(levels, (next) => {
  if (props.persist) storedLevels.value = [...next]
})
const term = computed(() => (props.toolbar && query.value ? query.value : (props.highlight ?? "")).trim())

const text = useLabels<LogViewerLabels>(
  "logViewer",
  {
    empty: "No logs yet",
    frozen: "Held — release Ctrl to resume",
    noMatch: "No lines match",
    loadingOlder: "loading older…",
    copyMessage: "Copy message",
    copyLine: "Copy line",
    copyTimestamp: "Copy timestamp",
    copied: "Copied to clipboard",
    filterSource: "Filter by [{source}]",
    filterLevel: "Filter by {level}",
    identical: "{n} identical lines",
    jump: "Jump to latest",
    search: "Search logs",
    clearSearch: "Clear search",
    previousMatch: "Previous match",
    nextMatch: "Next match",
    matchCount: "{current} / {total}",
    noMatches: "No matches",
    levels: "Levels",
    regex: "Regular expression",
    invalidPattern: "Invalid pattern",
    sources: "Sources",
    groupRepeats: "Group repeats",
    download: "Download",
    copySelection: "Copy selection",
  },
  () => props.labels,
)

// Hold Ctrl (or Cmd) over the stream and it stops (see logFreeze).
const root = ref<HTMLElement | null>(null)
const { frozen, sourceLines, lineOffset, hovered, lookedAt } = useLogFreeze({
  root,
  lines: () => props.lines,
  maxLines: () => props.maxLines,
})

const parsedLines = computed<LogLine[]>(() =>
  props.parse ? sourceLines.value.map(parseLogLine) : sourceLines.value,
)

// Rows actually rendered, each carrying its ORIGINAL index so line numbers stay
// truthful when filtering, plus a `count` for compact mode (1 unless folded).
// With filterMatches + a search term, keep only lines whose message contains it
// (case-insensitive); otherwise pass everything.
const compiled = computed(() => (regex.value && term.value ? compilePattern(term.value) : null))
const pattern = computed(() => compiled.value?.pattern ?? null)
const patternFailed = computed(() => !!compiled.value?.error)

const visibleLines = computed<{ line: LogLine; n: number; count: number }[]>(() => {
  const needle = props.filterMatches ? term.value.toLowerCase() : ""
  const wantedSources = sources.value.length ? new Set(sources.value) : null
  const inRegex = regex.value && !!needle
  const shown = levels.value.length ? new Set<LogLevel>(levels.value) : null
  const filtered = parsedLines.value
    .map((line, n) => ({ line, n }))
    .filter(({ line }) => !shown || shown.has(line.level ?? "info"))
    .filter(({ line }) => !wantedSources || (line.source !== undefined && wantedSources.has(line.source)))
    .filter(({ line }) => inTimeRange(line.time, props.timeRange))
    .filter(({ line }) => inRegex || !needle || matchPositions([line], needle).length > 0)

  if (inRegex) {
    const found = pattern.value ? patternPositions(filtered.map((row) => row.line), pattern.value) : []
    const kept = found.map((i) => filtered[i])
    return grouped.value ? groupRepeats(kept) : kept.map((row) => ({ ...row, count: 1 }))
  }
  if (grouped.value) return groupRepeats(filtered)

  if (!props.compact) return filtered.map((row) => ({ ...row, count: 1 }))

  // Fold runs of consecutive identical lines (same message/level/source, time
  // ignored). Keeps the FIRST occurrence so its index/time stay meaningful;
  // non-adjacent repeats are left alone so chronology isn't scrambled.
  const folded: { line: LogLine; n: number; count: number }[] = []
  for (const row of filtered) {
    const prev = folded[folded.length - 1]
    if (
      prev &&
      prev.line.message === row.line.message &&
      prev.line.level === row.line.level &&
      prev.line.source === row.line.source
    ) {
      prev.count++
    } else {
      folded.push({ ...row, count: 1 })
    }
  }
  return folded
})

/*
 * Rows are keyed by the identity of the line object the consumer passed, not by
 * position: prepending older history shifts every index, and index keys made
 * the bottom rows play the enter animation instead of the new top ones.
 */
const lineIds = new WeakMap<LogLine, number>()
let nextLineId = 0
function lineKey(n: number): number {
  const line = sourceLines.value[n]
  if (!line) return -1 - n
  let id = lineIds.get(line)
  if (id === undefined) {
    id = nextLineId++
    lineIds.set(line, id)
  }
  return id
}

// ── toolbar: level chips and match navigation ───────────────────────
const levelCounts = computed(() => countLevels<LogLevel>(parsedLines.value, "info"))
const presentLevels = computed(() => LOG_LEVEL_ORDER.filter((l) => levelCounts.value.has(l)))
const presentSources = computed(() => [...new Set(parsedLines.value.flatMap((l) => (l.source ? [l.source] : [])))].sort())

const matches = computed(() => {
  const rows = visibleLines.value.map((r) => r.line)
  if (!regex.value) return matchPositions(rows, term.value)
  return pattern.value ? patternPositions(rows, pattern.value) : []
})
const current = ref(-1)
const currentRow = computed(() => {
  const pos = matches.value[current.value]
  return pos === undefined ? -1 : (visibleLines.value[pos]?.n ?? -1)
})
watch(term, () => {
  current.value = -1
})
watch(matches, (list) => {
  if (current.value >= list.length) current.value = list.length - 1
})

const matchLabel = computed(() => {
  if (!term.value) return ""
  if (patternFailed.value) return text.value.invalidPattern
  const total = matches.value.length
  if (!total) return text.value.noMatches
  return text.value.matchCount
    .replace("{current}", current.value >= 0 ? String(current.value + 1) : "–")
    .replace("{total}", String(total))
})

function step(direction: 1 | -1) {
  const next = stepMatch(current.value, matches.value.length, direction)
  if (next < 0) return
  current.value = next
  pinned.value = false
  nextTick(() => revealRow(matches.value[next]))
}

const toolbarEl = ref<InstanceType<typeof LogViewerToolbar> | null>(null)

const searching = () => !!term.value && lookedAt()

useHotkeys(() => [
  { key: "f3", allowInInput: true, when: searching, handler: () => step(1) },
  { key: "f3", shift: true, allowInInput: true, when: searching, handler: () => step(-1) },
])

// ── selection, export, jump ─────────────────────────────────────────
let selectAnchor: number | null = null

function onRowClick(event: MouseEvent) {
  if (!props.selectable || !isElement(event.target)) return
  // The end of a drag across text is the user copying it, not choosing a line.
  if (nodeWindow(event.target).getSelection()?.isCollapsed === false) return
  if (event.target.closest("button")) return
  const el = event.target.closest<HTMLElement>("[data-log-row]")
  const n = el ? Number(el.dataset.logRow) : Number.NaN
  const line = parsedLines.value[n]
  if (!line) return
  const range = event.shiftKey && selectAnchor !== null
  if (!range) selectAnchor = n
  selection.value = range ? rowSpan(selectAnchor as number, n) : [n, n]
  emit("select", { line, index: n })
}

const isSelected = (n: number) => !!selection.value && n >= selection.value[0] && n <= selection.value[1]
const selectedLine = computed(() => (selection.value ? parsedLines.value[selection.value[0]] : undefined))

// What a selection covers, or everything shown when nothing is selected. Hidden
// lines inside the span stay out: what is exported is what was on screen.
function chosenLines(): LogLine[] {
  const span = selection.value
  const rows = visibleLines.value.filter((row) => !span || (row.n >= span[0] && row.n <= span[1]))
  return rows.map((row) => row.line)
}

function copySelection() {
  return copy(exportLines(chosenLines(), "text", lineText))
}

function downloadSelection(format: LogExportFormat = "text") {
  const extension = format === "ndjson" ? "ndjson" : "log"
  downloadFile(`${props.fileName ?? "logs"}.${extension}`, exportLines(chosenLines(), format, lineText), undefined, root.value?.ownerDocument)
}

/** Scrolls to the line closest to `time` and selects it. False when no line has a readable time. */
function jumpToTime(time: number | string): boolean {
  const position = nearestByTime(visibleLines.value.map((row) => row.line), time)
  if (position < 0) return false
  const { n } = visibleLines.value[position]
  selection.value = [n, n]
  pinned.value = false
  nextTick(() => revealRow(position))
  return true
}

defineExpose({
  next: () => step(1),
  previous: () => step(-1),
  focusSearch: () => toolbarEl.value?.focus(),
  jumpToTime,
  copySelection,
  downloadSelection,
})

// True when filtering has emptied an otherwise non-empty stream.
const filteredEmpty = computed(
  () => props.lines.length > 0 && visibleLines.value.length === 0,
)

// ── row context menu ─────────────────────────────────────────────────
// A menu item closes the menu as it runs, leaving nothing on screen to say the
// copy happened — so unlike LpCodeBlock's button, this one announces itself.
const { copy: writeClipboard } = useClipboard()
const copy = (value: string) => writeClipboard(value, { toast: text.value.copied })

// One LpContextMenu wraps the whole list (not each row) so a mouse drag can
// select text across rows — a per-row reka trigger would bind pointerdown and
// pin the selection to one row. On right-click we resolve which row is under the
// cursor (data-log-row) and rebuild the menu items for it before reka opens.
const menuRow = ref<{ line: LogLine; n: number } | null>(null)
const menuItems = computed<ContextMenuItemDef[]>(() =>
  menuRow.value ? menuFor(menuRow.value.line, menuRow.value.n) : [],
)

// Resolve the right-clicked row so menuItems reflects it before reka's trigger
// opens the menu (runs on the same contextmenu event, ahead of the open).
function onRowContext(e: MouseEvent) {
  if (!props.rowMenu) return
  const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-log-row]")
  const n = el ? Number(el.dataset.logRow) : NaN
  const row = Number.isNaN(n) ? undefined : visibleLines.value.find((r) => r.n === n)
  menuRow.value = row ? { line: row.line, n: row.n } : null
}

// vaul (the drawer lib) treats a left-button pointerdown on a side drawer as the
// start of a swipe-to-dismiss (`shouldDrag` returns true unconditionally for
// left/right drawers) and its preventDefault kills text selection. Stop that
// pointerdown from bubbling to vaul — left button only, so scroll and the
// right-click context menu still reach it.
function onRowPointerDown(e: PointerEvent) {
  if (e.button === 0) e.stopPropagation()
}

// Built-in copy actions + optional "filter by" + consumer extras. Rebuilt per
// right-click so it reflects the line under the cursor.
function menuFor(line: LogLine, index: number): ContextMenuItemDef[] {
  if (!props.rowMenu) return []
  const items: ContextMenuItemDef[] = [
    { label: text.value.copyMessage, icon: "lucide:copy", onSelect: () => copy(line.message) },
    { label: text.value.copyLine, icon: "lucide:clipboard-list", onSelect: () => copy(lineText(line)) },
  ]
  if (line.time != null) {
    items.push({ label: text.value.copyTimestamp, icon: "lucide:clock", onSelect: () => copy(fmtTime(line.time)) })
  }
  if (line.source) {
    items.push({
      label: text.value.filterSource.replace("{source}", line.source),
      icon: "lucide:filter",
      separatorBefore: true,
      onSelect: () => emit("filter", { source: line.source }),
    })
  }
  if (line.level) {
    items.push({
      label: text.value.filterLevel.replace("{level}", line.level),
      icon: "lucide:filter",
      separatorBefore: !line.source,
      onSelect: () => {
        if (props.toolbar && line.level) levels.value = [line.level]
        emit("filter", { level: line.level })
      },
    })
  }
  const extra = props.extraRowItems?.(line, index) ?? []
  if (extra.length) extra[0] = { ...extra[0], separatorBefore: true }
  return [...items, ...extra]
}

// Split a message around the (case-insensitive) highlight term so we can wrap
// matches in <mark> without v-html. Empty/absent term → single plain part.
type Part = MessagePart
function splitHighlight(message: string): Part[] {
  if (props.linkIds || regex.value) {
    const hits = regex.value ? (pattern.value?.ranges(message) ?? []) : termRanges(message, term.value)
    return messageParts(message, hits, props.linkIds ? findIds(message) : [])
  }
  if (!term.value) return [{ text: message, hit: false }]
  const parts: Part[] = []
  const lower = message.toLowerCase()
  const needle = term.value.toLowerCase()
  let i = 0
  while (i < message.length) {
    const at = lower.indexOf(needle, i)
    if (at === -1) {
      parts.push({ text: message.slice(i), hit: false })
      break
    }
    if (at > i) parts.push({ text: message.slice(i, at), hit: false })
    parts.push({ text: message.slice(at, at + needle.length), hit: true })
    i = at + needle.length
  }
  return parts
}

// ── scrolling: virtual window, tail, scroll-back (see logTail) ─────────
const {
  scrollRef,
  pinned,
  virtualise,
  renderedLines,
  padTop,
  padBottom,
  showJump,
  onScroll,
  onWheel,
  onKeydown,
  hold,
  scrollToBottom,
  revealRow,
  isFresh,
} = useLogTail({
  visibleLines,
  sourceLines,
  lines: () => props.lines,
  wrap: () => props.wrap,
  tail: () => props.tail,
  loadOlder: () => props.loadOlder,
  loadingOlder: () => props.loadingOlder,
  onReachTop: () => emit("reach-top"),
  current,
})

/*
 * Enter / leave / move for the full-render TransitionGroup, bound via v-bind so
 * the same list element can fall back to a plain <ol> when virtualised (a
 * component :is can't carry TransitionGroup-only props inertly otherwise).
 *
 * Named classes from the <style> block rather than Tailwind utilities: every
 * row carries `transition-colors` for its hover tint, and a utility that sets
 * `transition` for the enter, leave or move lands in the same layer with the
 * same specificity, so whichever Tailwind happened to emit last won. It was
 * `transition-colors`: no row ever animated, a pushed line popped in and a
 * dropped one took its height with it in a single frame.
 *
 * A leaving row collapses from its own measured height. A fixed cap (it was
 * `max-h-8`) snapped a wrapped, three-line row down to the cap first.
 */
const transitionProps = {
  tag: "ol",
  name: "lp-log-row",
  onBeforeLeave: (el: Element) => {
    const row = el as HTMLElement
    row.style.setProperty("--lp-log-row-h", `${row.offsetHeight}px`)
  },
}

// The viewer draws its own card frame and hides its overflow; a consumer
// fitting it into a panel that already has a border, or giving it a fixed
// height, needs those to give way rather than lose to stylesheet order.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "relative overflow-hidden rounded-card border border-line bg-surface font-mono text-xs leading-relaxed",
    frozen.value ? "ring-1 ring-brand" : "",
  ].join(" "),
)
</script>

<template>
  <div
    ref="root"
    tabindex="-1"
    :class="rootClass"
    v-bind="rest"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
    @wheel.passive="onWheel"
    @touchstart.passive="hold"
    @pointerdown="hold"
    @keydown="onKeydown"
  >
    <!-- Says which state it is in, because a stream that has simply gone quiet
         looks exactly like a frozen one. -->
    <Transition
      enter-active-class="transition duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      leave-active-class="transition duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] motion-reduce:transition-none"
      enter-from-class="-translate-y-1 opacity-0"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="frozen"
        class="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-pill bg-brand px-2.5 py-1 text-[11px] font-medium text-ink-inverse"
      >
        {{ frozenLabel ?? text.frozen }}
      </div>
    </Transition>

    <LogViewerToolbar
      v-if="toolbar"
      ref="toolbarEl"
      v-model:query="query"
      v-model:levels="levels"
      v-model:sources="sources"
      v-model:regex="regex"
      v-model:grouped="grouped"
      :text="text"
      :term="term"
      :match-label="matchLabel"
      :has-matches="matches.length > 0"
      :present-levels="presentLevels"
      :level-counts="levelCounts"
      :present-sources="presentSources"
      :tools="tools"
      @step="step"
      @copy="copySelection"
      @download="downloadSelection()"
    />

    <!-- `instant`: this viewer decides for itself when a jump animates (see
         rideToBottom) and restores scrollTop directly after prepending older
         lines. A CSS smooth scroll would override both. -->
    <LpScrollArea
      ref="scrollRef"
      instant
      :content-class="wrap ? '' : 'min-w-max'"
      :style="{ height }"
      @scroll="onScroll"
    >
      <LpEmptyState
        v-if="lines.length === 0 || filteredEmpty"
        compact
        :icon="filteredEmpty ? 'lucide:search-x' : 'lucide:scroll-text'"
        :title="filteredEmpty ? text.noMatch : (emptyLabel ?? text.empty)"
        :description="filteredEmpty && term ? `“${term}”` : undefined"
        class="h-full justify-center px-4"
      />

      <template v-else>
        <!-- Older-history loading row, pinned at the top while a scroll-back page
             is fetched (driven by `loadingOlder`) — sits ABOVE the lines so it
             doesn't replace them. -->
        <div
          v-if="loadingOlder"
          class="flex items-center justify-center gap-2 py-2 text-muted"
        >
          <!-- The loader speaks the row's words; the visible caption is hidden
               from screen readers so they are not read twice. -->
          <LpLoader size="inline" :delay="0" :labels="{ loading: text.loadingOlder }" class="text-[14px]" />
          <span class="text-[11px]" aria-hidden="true">{{ text.loadingOlder }}</span>
        </div>

      <!-- ONE context menu wraps the whole list (not each row): @contextmenu
           resolves which row was right-clicked so menuItems reflects it before
           reka opens. @pointerdown stops a left-button drag from reaching vaul
           (which would start a swipe-dismiss and cancel text selection); the
           right button still bubbles so the menu opens. reka's own trigger
           pointerdown is touch/pen-only, so it doesn't interfere with the mouse.
           Leave collapses a folded-away duplicate (max-height + opacity + a small
           lift) while the survivors FLIP-slide up via move-class — so toggling
           `compact` reads as the dupes melting into the kept line. -->
      <!-- Component switches on `virtualise`: a plain <ol> when we render only a
           windowed slice (FLIP/enter/leave transitions can't run over a moving
           virtual window, and computing them for thousands of nodes is exactly
           the cost we're avoiding), or a TransitionGroup for the full render on
           small lists, where the fold/enter animations are affordable and nice.
           Spacer rows stand in for the un-rendered slices above/below. -->
      <LpContextMenu :items="menuItems" :always="rowMenu">
      <component
        :is="virtualise ? 'ol' : TransitionGroup"
        v-bind="virtualise ? {} : transitionProps"
        class="py-1"
        @click="onRowClick"
        @contextmenu="onRowContext"
        @pointerdown="onRowPointerDown"
      >
        <li
          v-if="virtualise && padTop > 0"
          key="pad-top"
          :style="{ height: padTop + 'px' }"
          aria-hidden="true"
        />
        <li
          v-for="{ line, n, count } in renderedLines"
          :key="lineKey(n)"
          :data-log-row="n"
          class="group relative flex items-start gap-0 px-0 leading-5 transition-colors hover:bg-surface-soft/60"
          :class="[metaFor(line.level).sel, n === currentRow ? 'bg-accent/15' : '', isFresh(n) ? 'lp-log-row-fresh' : '', isSelected(n) ? 'bg-brand/15' : '']"
          :aria-current="n === currentRow ? 'true' : undefined"
          :data-selected="isSelected(n) ? '' : undefined"
        >
          <!-- level rail -->
          <!-- Level rail: absolutely positioned so it spans the FULL row height
               regardless of content — self-stretch only reached the flex line box
               (shorter than the relaxed line-height), which left visible gaps
               between rows. A spacer keeps the text indented past it. -->
          <span
            class="absolute inset-y-0 left-0 w-0.5"
            :class="metaFor(line.level).rail"
            aria-hidden="true"
          />
          <span class="mr-2 w-0.5 shrink-0" aria-hidden="true" />

          <!-- line number -->
          <span
            v-if="lineNumbers"
            class="mr-3 w-10 shrink-0 select-none text-right tabular-nums text-muted/70"
          >{{ n + lineOffset + 1 }}</span>

          <!-- timestamp -->
          <span
            v-if="showTime"
            class="mr-3 shrink-0 tabular-nums text-muted"
          >{{ fmtTime(line.time) }}</span>

          <!-- level chip -->
          <span
            v-if="showLevel"
            class="mr-3 w-12 shrink-0 text-[10px] font-semibold uppercase tracking-[0.06em]"
            :class="metaFor(line.level).chip"
          >{{ line.level ?? "info" }}</span>

          <!-- source tag -->
          <span
            v-if="line.source"
            class="mr-2 shrink-0 text-muted-strong"
          >[{{ line.source }}]</span>

          <!-- message -->
          <span
            class="min-w-0 pr-3"
            :class="[metaFor(line.level).text, wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre']"
          >
            <!-- Virtualised rows must stay one row tall, so a multi-line
                 message (a stack trace) is shown on one line with ↵ marks;
                 copying still yields the original text. -->
            <template
              v-for="(part, p) in splitHighlight(virtualise ? line.message.replace(/\r?\n/g, ' ↵ ') : line.message)"
              :key="p"
            >
              <button
                v-if="part.id"
                type="button"
                class="rounded-xs text-brand underline outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                @click="emit('id-click', { kind: part.id.kind, value: part.id.value, line })"
              >{{ part.text }}</button>
              <mark
                v-else-if="part.hit"
                class="rounded-xs bg-accent/30 text-ink"
              >{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
            <!-- compact: how many consecutive identical lines were folded here.
                 Keyed on count so each new fold re-mounts the chip and pops it,
                 cueing where the duplicate just merged. -->
            <Transition
              enter-active-class="transition duration-[var(--duration-medium)] ease-[var(--ease-emphasized)]"
              enter-from-class="scale-50 opacity-0"
            >
              <LpBadge
                v-if="count > 1"
                :key="count"
                size="sm"
                class="ml-2 select-none tabular-nums"
                :title="text.identical.replace('{n}', String(count))"
              >×{{ count }}</LpBadge>
            </Transition>
          </span>
        </li>
        <li
          v-if="virtualise && padBottom > 0"
          key="pad-bottom"
          :style="{ height: padBottom + 'px' }"
          aria-hidden="true"
        />
      </component>
      </LpContextMenu>
      </template>
    </LpScrollArea>

    <LpLogInspector
      v-if="inspector && selectedLine"
      :message="selectedLine.message"
      class="max-h-64 overflow-auto border-t border-line p-3"
    />

    <!-- jump-to-latest: shown only when tailing and scrolled away. The
         Transition rides an outer wrapper so its transform/opacity don't fight
         the button's own -translate-x-1/2 centring and hover colour transition. -->
    <Transition
      enter-active-class="transition duration-[var(--duration-medium)] ease-[var(--ease-emphasized)]"
      enter-from-class="translate-y-3 scale-90 opacity-0"
      leave-active-class="transition duration-[var(--duration-fast)] ease-in"
      leave-to-class="translate-y-3 scale-90 opacity-0"
    >
      <div v-if="showJump" class="absolute inset-x-0 bottom-3 flex justify-center">
        <button
          type="button"
          class="group flex items-center gap-1.5 rounded-pill border border-line bg-surface-overlay px-3 py-1 text-xs font-medium text-ink shadow-[var(--shadow-panel)] backdrop-blur outline-none transition-colors hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring"
          @click="scrollToBottom"
        >
          <LpIcon
            name="lucide:arrow-down"
            :size="14"
            class="transition-transform duration-[var(--duration-medium)] ease-[var(--ease-emphasized)] group-hover:translate-y-0.5"
          />
          {{ text.jump }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style>
/*
 * Unscoped and namespaced, like LpRollingText: Vue applies these to the row
 * while it leaves, and an unlayered rule is also what lets them outrank the
 * row's own `transition-colors` utility (see `transitionProps`).
 */
/* Rises into place from just below, the direction a tail grows in (the kit's rise-in). */
.lp-log-row-enter-active,
.lp-log-row-fresh {
  --rise: 6px;
  animation: rise-in var(--duration-medium) var(--ease-emphasized);
}

.lp-log-row-leave-active {
  overflow: hidden;
  animation: lp-log-row-out var(--duration-medium) var(--ease-emphasized) forwards;
}

.lp-log-row-move {
  transition: transform var(--duration-medium) var(--ease-emphasized);
}

@keyframes lp-log-row-out {
  from {
    height: var(--lp-log-row-h, 1.25rem);
  }
  to {
    height: 0;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-log-row-enter-active,
  .lp-log-row-fresh,
  .lp-log-row-leave-active {
    animation: none;
  }
  .lp-log-row-move {
    transition: none;
  }
}
</style>
