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
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  TransitionGroup,
  watch,
} from "vue"
import { usePersisted } from "../composables/usePersisted"
import { durationToken, prefersReducedMotion, tokenEase } from "../composables/easing"
import { useClipboard } from "../composables/useClipboard"
import { useHotkeys } from "../composables/useHotkeys"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"
import LpScrollArea from "./LpScrollArea.vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useLabels } from "../composables/useLpConfig"
import { countLevels, matchPositions, ringWindow, stepMatch } from "./logSearch"

export interface LogViewerLabels {
  [key: string]: string
  empty: string
  frozen: string
  noMatch: string
  loadingOlder: string
  copyMessage: string
  copyLine: string
  copyTimestamp: string
  copied: string
  /** `{source}` is replaced by the line's source. */
  filterSource: string
  /** `{level}` is replaced by the line's level. */
  filterLevel: string
  /** `{n}` is replaced by the count. */
  identical: string
  jump: string
  search: string
  clearSearch: string
  previousMatch: string
  nextMatch: string
  /** `{current}` and `{total}` are replaced. */
  matchCount: string
  noMatches: string
  levels: string
}

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "success"

export interface LogLine {
  /** Body of the line. */
  message: string
  level?: LogLevel
  /** Epoch ms, ISO string, or pre-formatted label — shown in the time column. */
  time?: number | string
  /** Short origin tag (service / module), rendered as a dim chip. */
  source?: string
}

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
}>()

/** The toolbar's search term. Without the toolbar, `highlight` is the term. */
const query = defineModel<string>("search", { default: "" })
/** Levels to show. Empty shows every level. */
const levels = defineModel<LogLevel[]>("levels", { default: () => [] })
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
  },
  () => props.labels,
)

// Level → gutter rail + text colour. Reads only semantic tokens so re-skinning
// just works. trace/debug stay muted; success is green; warn amber; error/fatal
// red (fatal gets a filled chip to stand apart from plain error).
// `sel` tints ::selection in the row's semantic colour (info→brand, warn→accent,
// error/fatal→danger) via Tailwind's `selection:` variant — the highlight then
// matches the level instead of the browser default. Static classes (not built
// from a var) so Tailwind emits them from the @source scan.
const levelMeta: Record<LogLevel, { rail: string; text: string; chip: string; sel: string }> = {
  trace: { rail: "bg-line-strong", text: "text-muted", chip: "text-muted", sel: "selection:bg-muted/40" },
  debug: { rail: "bg-line-strong", text: "text-muted-strong", chip: "text-muted-strong", sel: "selection:bg-muted-strong/40" },
  info: { rail: "bg-brand", text: "text-ink", chip: "text-brand", sel: "selection:bg-brand/40" },
  success: { rail: "bg-action", text: "text-ink", chip: "text-action", sel: "selection:bg-action/40" },
  warn: { rail: "bg-accent", text: "text-ink", chip: "text-accent", sel: "selection:bg-accent/40" },
  error: { rail: "bg-danger", text: "text-ink", chip: "text-danger", sel: "selection:bg-danger/40" },
  fatal: { rail: "bg-danger", text: "text-ink", chip: "rounded-xs bg-danger px-1 text-ink-inverse", sel: "selection:bg-danger/40" },
}

function metaFor(level?: LogLevel) {
  return levelMeta[level ?? "info"]
}

// ── format recognition (opt-in via `parse`) ──────────────────────────────
// Map a recognised level word to a canonical LogLevel; unknown → undefined.
const LEVEL_WORDS: Record<string, LogLevel> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  notice: "info",
  warn: "warn",
  warning: "warn",
  error: "error",
  err: "error",
  fatal: "fatal",
  crit: "fatal",
  critical: "fatal",
  panic: "fatal",
  success: "success",
  ok: "success",
}
// Leading ISO-8601 / "YYYY-MM-DD HH:MM:SS" timestamp, optionally bracketed.
const TS_RE =
  /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s+/
// A leading LEVEL token, optionally followed by ':' .
const LEVEL_RE = /^([A-Za-z]{2,8})\s*:?\s+/
// A leading "[source]" tag.
const SOURCE_RE = /^\[([^\]]{1,40})\]\s+/

// Pull level/time/source out of a raw message; only fields not already set on
// the line are filled, and only the recognised prefixes are stripped from the
// body — so an unrecognised line is returned unchanged.
function parseLine(line: LogLine): LogLine {
  if (!props.parse) return line
  let msg = line.message
  let time = line.time
  let level = line.level
  let source = line.source

  // 1) timestamp prefix
  if (time == null) {
    const m = TS_RE.exec(msg)
    if (m) {
      time = m[1]
      msg = msg.slice(m[0].length)
    }
  } else {
    // strip a duplicate leading timestamp even if time is already set
    const m = TS_RE.exec(msg)
    if (m) msg = msg.slice(m[0].length)
  }

  // 2) level word
  const lm = LEVEL_RE.exec(msg)
  if (lm) {
    const canon = LEVEL_WORDS[lm[1].toLowerCase()]
    if (canon) {
      if (level == null) level = canon
      msg = msg.slice(lm[0].length) // drop the duplicate word from the body
    }
  }

  // 3) [source] tag
  if (source == null) {
    const sm = SOURCE_RE.exec(msg)
    if (sm) {
      source = sm[1]
      msg = msg.slice(sm[0].length)
    }
  }

  return msg === line.message && time === line.time && level === line.level && source === line.source
    ? line
    : { ...line, message: msg, time, level, source }
}

/*
 * Hold a key, the stream stops.
 *
 * Not a toggle. A stream worth freezing is one that is scrolling past faster
 * than it can be read, and in that state you are looking at a line you want to
 * keep in sight — reaching for a button means moving your eyes off it, and a
 * toggle you must remember to switch back leaves the viewer dead until you do.
 * The gesture is Task Manager's: press to hold, let go to resume, and nothing
 * is lost either way because the lines were never the viewer's to begin with.
 *
 * The freeze bites at the SOURCE rather than at the scroll position. Pinning
 * the scroll only stops it moving; the rows underneath still re-render, so
 * whatever you were reading is replaced in place while it appears to stand
 * still — which is worse than either state on its own.
 */
const root = ref<HTMLElement | null>(null)
const frozen = ref(false)
const frozenLines = shallowRef<LogLine[] | null>(null)

const windowed = computed(() => ringWindow(frozenLines.value ?? props.lines, props.maxLines))
const sourceLines = computed<LogLine[]>(() => windowed.value.lines as LogLine[])
// Line numbers keep counting from the start of the stream after the cap trims it.
const lineOffset = computed(() => windowed.value.offset)

function freeze(): boolean {
  // Declining unless the stream is being looked at: `false` hands Ctrl back
  // untouched, which matters because Ctrl is half of every shortcut on the
  // page and swallowing it would break them all.
  if (!hovered.value && !focusWithin()) return false
  if (frozen.value) return true
  // Snapshotted by reference, not copied: the array the consumer hands over is
  // replaced wholesale on every update, so holding the old one is enough — and
  // a copy of ten thousand lines on every keypress is not.
  // A capped stream is usually one array pushed into in place, which a
  // reference would not hold still; its window is small enough to copy.
  frozenLines.value = props.maxLines ? props.lines.slice(-props.maxLines) : props.lines
  frozen.value = true
  return true
}

function thaw() {
  frozen.value = false
  frozenLines.value = null
}

/*
 * Held while the pointer is over the stream, or while it holds the focus.
 *
 * Not scoped to focus alone: nobody clicks a log before reading it, and a
 * modifier held over an unfocused viewer would have gone to the page instead.
 * Not global either — two viewers side by side would both freeze, and Ctrl is
 * pressed for a hundred other reasons on a page that happens to contain logs.
 * Pointing at the thing is the intent.
 */
const hovered = ref(false)

function focusWithin() {
  const el = root.value
  return !!el && el.contains(document.activeElement)
}

// `when` rather than a bare decline: several viewers on one page all bind these
// keys, and only the one being looked at should claim them.
const lookedAt = () => hovered.value || focusWithin()

useHotkeys(() => [
  { key: "control", allowInInput: true, when: lookedAt, handler: freeze },
  { key: "meta", allowInInput: true, when: lookedAt, handler: freeze },
])

// Released on keyup anywhere, and on blur: a window that loses focus mid-hold
// never delivers the keyup, and the viewer would stay frozen with no visible
// reason and no key to press.
function onKeyup(event: KeyboardEvent) {
  if (event.key === "Control" || event.key === "Meta") thaw()
}

onMounted(() => {
  window.addEventListener("keyup", onKeyup)
  window.addEventListener("blur", thaw)
})
onBeforeUnmount(() => {
  window.removeEventListener("keyup", onKeyup)
  window.removeEventListener("blur", thaw)
})

const parsedLines = computed<LogLine[]>(() =>
  props.parse ? sourceLines.value.map(parseLine) : sourceLines.value,
)

// Rows actually rendered, each carrying its ORIGINAL index so line numbers stay
// truthful when filtering, plus a `count` for compact mode (1 unless folded).
// With filterMatches + a search term, keep only lines whose message contains it
// (case-insensitive); otherwise pass everything.
const visibleLines = computed<{ line: LogLine; n: number; count: number }[]>(() => {
  const needle = props.filterMatches ? term.value.toLowerCase() : ""
  const shown = levels.value.length ? new Set<LogLevel>(levels.value) : null
  const filtered = parsedLines.value
    .map((line, n) => ({ line, n }))
    .filter(({ line }) => !shown || shown.has(line.level ?? "info"))
    .filter(({ line }) => !needle || matchPositions([line], needle).length > 0)

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
const LEVEL_ORDER: LogLevel[] = ["trace", "debug", "info", "success", "warn", "error", "fatal"]
const levelCounts = computed(() => countLevels<LogLevel>(parsedLines.value, "info"))
const presentLevels = computed(() => LEVEL_ORDER.filter((l) => levelCounts.value.has(l)))

function toggleLevel(level: LogLevel) {
  levels.value = levels.value.includes(level)
    ? levels.value.filter((l) => l !== level)
    : [...levels.value, level]
}

const matches = computed(() => matchPositions(visibleLines.value.map((r) => r.line), term.value))
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
  nextTick(() => revealMatch(matches.value[next]))
}

// Brings the match to the middle of the viewport. A virtualised row may not be
// in the DOM yet, so the offset is computed from the fixed row height instead.
function revealMatch(position: number | undefined) {
  const el = viewport()
  if (!el || position === undefined) return
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth"
  if (virtualise.value) {
    el.scrollTo({ top: Math.max(0, position * ROW_HEIGHT - el.clientHeight / 2), behavior })
    return
  }
  const n = visibleLines.value[position]?.n
  el.querySelector<HTMLElement>(`[data-log-row="${n}"]`)?.scrollIntoView({ block: "center", behavior })
}

const searchEl = ref<InstanceType<typeof LpInput> | null>(null)

function onSearchKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === "Enter") {
    event.preventDefault()
    step(event.shiftKey ? -1 : 1)
  } else if (event.key === "Escape" && query.value) {
    event.preventDefault()
    event.stopPropagation()
    query.value = ""
  }
}

const searching = () => !!term.value && lookedAt()

useHotkeys(() => [
  { key: "f3", allowInInput: true, when: searching, handler: () => step(1) },
  { key: "f3", shift: true, allowInInput: true, when: searching, handler: () => step(-1) },
])

defineExpose({
  next: () => step(1),
  previous: () => step(-1),
  focusSearch: () => searchEl.value?.focus(),
})

// True when filtering has emptied an otherwise non-empty stream.
const filteredEmpty = computed(
  () => props.lines.length > 0 && visibleLines.value.length === 0,
)

function fmtTime(time?: number | string): string {
  if (time == null) return ""
  if (typeof time === "number" || /^\d+$/.test(time)) {
    const d = new Date(Number(time))
    if (Number.isNaN(d.getTime())) return String(time)
    return d.toLocaleTimeString(undefined, { hour12: false }) + "." +
      String(d.getMilliseconds()).padStart(3, "0")
  }
  return time
}

// ── row context menu ─────────────────────────────────────────────────
// A menu item closes the menu as it runs, leaving nothing on screen to say the
// copy happened — so unlike LpCodeBlock's button, this one announces itself.
const { copy: writeClipboard } = useClipboard()
const copy = (value: string) => writeClipboard(value, { toast: text.value.copied })

// The whole line as one copyable string: "time LEVEL [source] message".
function lineText(line: LogLine): string {
  return [fmtTime(line.time), line.level?.toUpperCase(), line.source && `[${line.source}]`, line.message]
    .filter(Boolean)
    .join(" ")
}

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
interface Part {
  text: string
  hit: boolean
}
function splitHighlight(message: string): Part[] {
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

// ── virtualisation ───────────────────────────────────────────────────
// A live log stream can reach tens of thousands of rows; rendering them all
// (a v-for over the whole list, each row a flex box with a highlight-split and,
// worse, a TransitionGroup computing FLIP offsets for every node on each push)
// pins the main thread and the viewer stops responding. So past a threshold we
// render only the slice inside the viewport plus a small overscan, padding the
// rest with two spacer rows. This needs a uniform row height, which only holds
// when lines don't wrap — with `wrap` (or short lists) we fall back to the
// plain full render that keeps the fold/enter transitions.
const ROW_HEIGHT = 20 // px; matches leading-5 (1.25rem) monospace rows
const VIRTUALISE_ABOVE = 200 // rows; below this the full render is cheap enough
const OVERSCAN = 12 // rows rendered beyond each edge to cover fast scrolls

const virtualise = computed(() => !props.wrap && visibleLines.value.length > VIRTUALISE_ABOVE)

const viewportHeight = ref(0)
const scrollTop = ref(0)

// Window of rows to actually render when virtualising: [start, end) by index
// into visibleLines, widened by OVERSCAN on both sides and clamped.
const virtualRange = computed(() => {
  const total = visibleLines.value.length
  if (!virtualise.value) return { start: 0, end: total }
  const visibleCount = Math.ceil(viewportHeight.value / ROW_HEIGHT) + 1
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(total, start + visibleCount + OVERSCAN * 2)
  return { start, end }
})

const renderedLines = computed(() => {
  if (!virtualise.value) return visibleLines.value
  const { start, end } = virtualRange.value
  return visibleLines.value.slice(start, end)
})

// Spacer heights that stand in for the un-rendered rows above/below the window,
// so the scrollbar and scroll position stay honest.
const padTop = computed(() =>
  virtualise.value ? virtualRange.value.start * ROW_HEIGHT : 0,
)
const padBottom = computed(() =>
  virtualise.value
    ? (visibleLines.value.length - virtualRange.value.end) * ROW_HEIGHT
    : 0,
)

// ── tail / auto-scroll ───────────────────────────────────────────────
const scrollRef = ref<{ viewportEl: HTMLElement | null } | null>(null)
const pinned = ref(true) // currently glued to the bottom
// Slack from the bottom that still counts as "pinned". Generous (a few rows
// tall) so a freshly pushed line — which momentarily grows scrollHeight before
// the tail catches up — doesn't unpin us and flash the jump-to-latest pill;
// only a deliberate scroll up past this clears it.
const NEAR = 120

function viewport(): HTMLElement | null {
  return scrollRef.value?.viewportEl ?? null
}

function atBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR
}

// Distance from the top that arms a scroll-back fetch (a few rows of slack so
// the next page is on its way before the user hits the very top).
const TOP_NEAR = 80
// Armed = ready to fire reach-top; cleared until the scroll leaves the top zone
// so one trip to the top emits exactly once.
let topArmed = true

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  // The glide's own writes are not the user leaving the tail: a burst taller
  // than NEAR would read as "scrolled up" on its first frame and unpin it.
  // Anything the user does to scroll cancels the glide before this runs. Nor
  // may a scroll event the glide queued before an upward wheel re-pin the
  // tail the wheel just left (see `leaveTail`).
  if (!glide && performance.now() - leftAt > LEAVE_GRACE_MS) pinned.value = atBottom(el)
  // Feed the virtual window. Reading clientHeight here keeps it in sync with
  // runtime resizes (drawer drag, window resize) without a ResizeObserver.
  scrollTop.value = el.scrollTop
  if (el.clientHeight !== viewportHeight.value) viewportHeight.value = el.clientHeight
  if (!props.loadOlder) return
  if (el.scrollTop <= TOP_NEAR) {
    if (topArmed && !props.loadingOlder) {
      topArmed = false
      emit("reach-top")
    }
  } else {
    topArmed = true
  }
}

/*
 * Keep the line being read where it is when the lines change under it.
 *
 * Anchored on a row, not on the total height. Measuring how much scrollHeight
 * grew and adding all of it to scrollTop is right for older lines prepended
 * above, but a line appended BELOW grows it just the same, so every pushed
 * line dragged a reader who had scrolled up one row further down. The absolute
 * write also cancelled the browser's own animated wheel scroll, so with a busy
 * stream a wheel turn up never got anywhere.
 *
 * The first row in view is remembered with its offset; afterwards scrollTop
 * moves by however far that row was displaced, and is not written at all when
 * it stayed put. Rows above that leave (a capped stream) are covered the same
 * way.
 */
let anchorRow: HTMLElement | null = null
let anchorOffset = 0

function firstRowInView(el: HTMLElement): HTMLElement | null {
  const top = el.getBoundingClientRect().top
  for (const row of el.querySelectorAll<HTMLElement>("[data-log-row]")) {
    if (row.getBoundingClientRect().bottom > top) return row
  }
  return null
}

function captureScrollAnchor() {
  const el = viewport()
  anchorRow = el ? firstRowInView(el) : null
  if (el && anchorRow) anchorOffset = anchorRow.getBoundingClientRect().top - el.getBoundingClientRect().top
}

function restoreScrollAnchor() {
  const el = viewport()
  const row = anchorRow
  anchorRow = null
  if (!el || !row?.isConnected) return
  const drift = row.getBoundingClientRect().top - el.getBoundingClientRect().top - anchorOffset
  if (Math.abs(drift) >= 1) el.scrollTop += drift
}

/*
 * Follow the tail by easing scrollTop toward the bottom over a frame loop.
 *
 * The browser's own smooth scroll covered one 20px row in three frames, so a
 * pushed line still read as a jolt; it also cannot be retargeted, and a line
 * arriving mid-scroll restarted it from wherever it stood. Here the target is
 * re-read every frame, so lines landing during the glide (or rows collapsing
 * above it) only move where it ends, and a fresh change restarts the easing
 * from the position actually on screen.
 *
 * A jump of more than a viewport starts one viewport short of the end: easing
 * across a whole burst is a smear of text nobody can follow, and snapping
 * there outright was the jolt this replaces.
 */
let glide = 0

function stopGlide() {
  if (glide) cancelAnimationFrame(glide)
  glide = 0
}

/*
 * Where "the bottom" is: the newest row that is staying, not the end of the
 * scroll height. Rows still collapsing out under it (a window that slid back,
 * a filter that dropped the tail) briefly make the list overflow, and gliding
 * down into them scrolled a list that fits by a few pixels and back again as
 * they closed.
 */
function tailEnd(el: HTMLElement): number {
  const max = el.scrollHeight - el.clientHeight
  const list = el.querySelector("[data-log-row]")?.parentElement
  let row = list?.lastElementChild ?? null
  const below = row ? max + el.clientHeight - contentBottom(el, row) : 0
  while (row && (!row.hasAttribute("data-log-row") || row.classList.contains("lp-log-row-leave-active"))) {
    row = row.previousElementSibling
  }
  if (!row) return max
  return Math.max(0, Math.min(max, contentBottom(el, row) + below - el.clientHeight))
}

function contentBottom(el: HTMLElement, row: Element): number {
  return row.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop
}

function rideToBottom() {
  const el = viewport()
  if (!el) return
  stopGlide()
  const end = () => tailEnd(el)
  if (prefersReducedMotion()) {
    el.scrollTop = end()
    return
  }
  const from = Math.max(el.scrollTop, end() - el.clientHeight)
  if (Math.abs(end() - from) < 1) return
  el.scrollTop = from
  const ms = durationToken("duration-medium")
  const ease = tokenEase("ease-emphasized")
  const started = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - started) / ms))
    el.scrollTop = from + (end() - from) * ease(t)
    glide = t < 1 ? requestAnimationFrame(step) : 0
  }
  glide = requestAnimationFrame(step)
}

/*
 * The user reaching for the stream ends the glide at once, and an upward
 * gesture leaves the tail there and then rather than when its scroll lands.
 *
 * Waiting for the scroll event was not enough: a wheel turn is itself animated
 * by the browser, the next pushed line arrived before it had moved past NEAR,
 * the tail still counted as pinned, and the glide's first write cancelled the
 * wheel's own animation. With lines every ~100ms the stream simply refused to
 * be scrolled up. A pointer or finger held on the stream (dragging the
 * scrollbar, selecting text) holds the tail for the same reason.
 */
let holding = false
// Long enough for a scroll event already queued by the glide to arrive.
const LEAVE_GRACE_MS = 250
let leftAt = -Infinity

function leaveTail() {
  stopGlide()
  leftAt = performance.now()
  const el = viewport()
  if (el && el.scrollTop > 0) pinned.value = false
}

function onWheel(event: WheelEvent) {
  if (event.deltaY < 0) leaveTail()
  else stopGlide()
}

const UPWARD_KEYS = new Set(["ArrowUp", "PageUp", "Home"])

function onKeydown(event: KeyboardEvent) {
  const field = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]")
  if (!field && UPWARD_KEYS.has(event.key)) leaveTail()
}

function release() {
  holding = false
  window.removeEventListener("pointerup", release)
  window.removeEventListener("pointercancel", release)
  window.removeEventListener("touchend", release)
}

function hold(event: Event) {
  // The scroll area's root, so its scrollbar (a sibling of the viewport)
  // counts, and the toolbar and jump pill above it do not.
  const area = viewport()?.parentElement
  if (!area || !(event.target instanceof Node) || !area.contains(event.target)) return
  stopGlide()
  holding = true
  window.addEventListener("pointerup", release)
  window.addEventListener("pointercancel", release)
  window.addEventListener("touchend", release)
}

function scrollToBottom() {
  current.value = -1
  rideToBottom()
  pinned.value = true
}

// Snapshot the scroll anchor BEFORE the DOM updates for a line change (flush:pre)
// so a prepend can be compensated post-update. Only matters when NOT pinned to
// the bottom (i.e. the user is reading history up the stream).
/*
 * A capped buffer (shift + push, or slice(-N)) keeps the length constant once
 * full, so the length alone stops seeing new lines. The array, its length and
 * its last line together change on every append, prepend or replacement.
 */
const linesSignal = () => [props.lines, props.lines.length, props.lines[props.lines.length - 1]]

watch(
  linesSignal,
  () => {
    if (!pinned.value) captureScrollAnchor()
  },
  { flush: "pre" },
)

// After the DOM updates: tail to the bottom if pinned, else keep the view glued
// to where it was so a top prepend (older history) doesn't yank it.
watch(
  linesSignal,
  async () => {
    await nextTick()
    if (props.tail && pinned.value && !holding && current.value < 0) {
      rideToBottom()
    } else {
      restoreScrollAnchor()
    }
  },
)

const showJump = computed(() => props.tail && !pinned.value && props.lines.length > 0)

// Track the viewport height for the whole lifetime, not just at mount. Reading
// it once was a deadlock when the viewer mounted inside a container that had no
// height yet (a drawer mid open-animation, a hidden tab): the virtual window
// collapsed to a single row, so there was nothing to scroll, and `onScroll` —
// the only other place that refreshed the height — could never fire to correct
// it. The list looked stuck and wouldn't scroll at all.
let viewportResize: ResizeObserver | null = null

function measureViewport() {
  const el = viewport()
  if (el) viewportHeight.value = el.clientHeight
}

onMounted(() => {
  measureViewport()
  const el = viewport()
  // A tailing viewer opens on its newest lines. Opening at the top left the
  // first pushed line to haul the whole history past in one go.
  if (el && props.tail) el.scrollTop = el.scrollHeight
  if (el && typeof ResizeObserver !== "undefined") {
    viewportResize = new ResizeObserver(measureViewport)
    viewportResize.observe(el)
  }
})

onBeforeUnmount(() => {
  stopGlide()
  release()
  viewportResize?.disconnect()
  viewportResize = null
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

/*
 * Rows that just arrived while virtualised. The TransitionGroup is off there
 * (FLIP over thousands of rows is the cost virtualising avoids), but a pushed
 * line still should not pop in. Only the lines appended by the latest change
 * are marked, found by where the previous last line sits in the new array, so
 * a row scrolled into view later, or a whole replaced buffer, never plays it.
 * A burst taller than the viewport is not worth animating line by line.
 */
const FRESH_CAP = 40
const freshLines = shallowRef<WeakSet<LogLine>>(new WeakSet())
let lastSeen: LogLine | undefined
watch(
  linesSignal,
  () => {
    const lines = props.lines
    const fresh = new WeakSet<LogLine>()
    const at = lastSeen ? lines.lastIndexOf(lastSeen) : -1
    if (at >= 0 && lines.length - 1 - at <= FRESH_CAP) {
      for (let i = at + 1; i < lines.length; i++) fresh.add(lines[i])
    }
    lastSeen = lines[lines.length - 1]
    freshLines.value = fresh
  },
  { immediate: true },
)
function isFresh(n: number): boolean {
  const line = sourceLines.value[n]
  return virtualise.value && !!line && freshLines.value.has(line)
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

    <div
      v-if="toolbar"
      class="flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5 font-sans"
    >
      <LpInput
        ref="searchEl"
        v-model="query"
        type="search"
        size="sm"
        icon="lucide:search"
        clearable
        class="min-w-48 flex-1"
        :aria-label="text.search"
        :placeholder="text.search"
        :labels="{ clear: text.clearSearch }"
        @keydown="onSearchKeydown"
      >
        <template #trailing>
          <span v-if="term" class="shrink-0 text-[11px] tabular-nums text-muted" aria-live="polite">{{ matchLabel }}</span>
        </template>
      </LpInput>

      <div class="flex items-center">
        <button
          type="button"
          class="rounded-xs p-1 text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          :aria-label="text.previousMatch"
          :disabled="!matches.length"
          @click="step(-1)"
        >
          <LpIcon name="lucide:chevron-up" :size="14" />
        </button>
        <button
          type="button"
          class="rounded-xs p-1 text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          :aria-label="text.nextMatch"
          :disabled="!matches.length"
          @click="step(1)"
        >
          <LpIcon name="lucide:chevron-down" :size="14" />
        </button>
      </div>
      <div
        v-if="presentLevels.length > 1"
        role="group"
        :aria-label="text.levels"
        class="flex flex-wrap items-center gap-1"
      >
        <button
          v-for="level in presentLevels"
          :key="level"
          type="button"
          class="flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="levels.includes(level) ? 'border-line-strong bg-surface-soft text-ink' : 'border-line text-muted hover:text-ink'"
          :aria-pressed="levels.includes(level)"
          @click="toggleLevel(level)"
        >
          <span class="size-1.5 rounded-full" :class="metaFor(level).rail" aria-hidden="true" />
          {{ level }}
          <span class="font-normal tabular-nums text-muted">{{ levelCounts.get(level) }}</span>
        </button>
      </div>
    </div>

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
          <LpIcon name="lucide:loader-circle" :size="14" class="animate-spin" />
          <span class="text-[11px]">{{ text.loadingOlder }}</span>
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
          :class="[metaFor(line.level).sel, n === currentRow ? 'bg-accent/15' : '', isFresh(n) ? 'lp-log-row-fresh' : '']"
          :aria-current="n === currentRow ? 'true' : undefined"
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
              <mark
                v-if="part.hit"
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
              <span
                v-if="count > 1"
                :key="count"
                class="ml-2 inline-block select-none rounded-pill bg-surface-soft px-1.5 align-[1px] text-[10px] font-semibold tabular-nums text-muted-strong"
                :title="text.identical.replace('{n}', String(count))"
              >×{{ count }}</span>
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
.lp-log-row-enter-active,
.lp-log-row-fresh {
  animation: lp-log-row-in var(--duration-medium) var(--ease-emphasized);
}

.lp-log-row-leave-active {
  overflow: hidden;
  animation: lp-log-row-out var(--duration-medium) var(--ease-emphasized) forwards;
}

.lp-log-row-move {
  transition: transform var(--duration-medium) var(--ease-emphasized);
}

/* Rises into place from just below, the direction a tail grows in. */
@keyframes lp-log-row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
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
