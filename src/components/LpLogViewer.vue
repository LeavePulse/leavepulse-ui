<script setup lang="ts">
/*
 * Terminal-flavoured log stream. Monospace rows, a tonal level gutter, optional
 * timestamps + source tags, search highlighting, and a sticky "tail" that pins
 * to the bottom as lines arrive (drops out the moment you scroll up, with a
 * jump-to-latest pill to re-arm). Built on LpScrollArea, which exposes its
 * viewport element and re-emits the native scroll event — exactly what tailing
 * needs.
 */
import { computed, nextTick, ref, watch } from "vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"

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
  }>(),
  {
    showTime: true,
    showLevel: true,
    lineNumbers: false,
    wrap: false,
    tail: true,
    height: "20rem",
    emptyLabel: "No logs yet",
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

const parsedLines = computed<LogLine[]>(() =>
  props.parse ? props.lines.map(parseLine) : props.lines,
)

// Rows actually rendered, each carrying its ORIGINAL index so line numbers stay
// truthful when filtering, plus a `count` for compact mode (1 unless folded).
// With filterMatches + a search term, keep only lines whose message contains it
// (case-insensitive); otherwise pass everything.
const visibleLines = computed<{ line: LogLine; n: number; count: number }[]>(() => {
  const term = props.filterMatches ? props.highlight?.trim().toLowerCase() : ""
  const filtered = parsedLines.value
    .map((line, n) => ({ line, n }))
    .filter(({ line }) => !term || line.message.toLowerCase().includes(term))

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
async function copy(text: string) {
  try {
    await navigator.clipboard?.writeText(text)
  } catch {
    // Clipboard can reject (insecure context / denied permission); swallow —
    // the menu action is best-effort and shouldn't throw into the UI.
  }
}

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
    { label: "Copy message", icon: "lucide:copy", onSelect: () => copy(line.message) },
    { label: "Copy line", icon: "lucide:clipboard-list", onSelect: () => copy(lineText(line)) },
  ]
  if (line.time != null) {
    items.push({ label: "Copy timestamp", icon: "lucide:clock", onSelect: () => copy(fmtTime(line.time)) })
  }
  if (line.source) {
    items.push({
      label: `Filter by [${line.source}]`,
      icon: "lucide:filter",
      separatorBefore: true,
      onSelect: () => emit("filter", { source: line.source }),
    })
  }
  if (line.level) {
    items.push({
      label: `Filter by ${line.level}`,
      icon: "lucide:filter",
      separatorBefore: !line.source,
      onSelect: () => emit("filter", { level: line.level }),
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
  const term = props.highlight?.trim()
  if (!term) return [{ text: message, hit: false }]
  const parts: Part[] = []
  const lower = message.toLowerCase()
  const needle = term.toLowerCase()
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
  pinned.value = atBottom(el)
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

// Preserve scroll position across a prepend: when older lines are added at the
// top, scrollTop must grow by the height they introduced or the view jumps. We
// snapshot scrollHeight before the lines change and restore the offset after.
let prevScrollHeight = 0
let prevScrollTop = 0
function captureScrollAnchor() {
  const el = viewport()
  if (!el) return
  prevScrollHeight = el.scrollHeight
  prevScrollTop = el.scrollTop
}
function restoreScrollAnchor() {
  const el = viewport()
  if (!el) return
  const added = el.scrollHeight - prevScrollHeight
  if (added > 0) el.scrollTop = prevScrollTop + added
}

// Glide to the bottom. Honours OS reduce-motion. For auto-tail we skip the
// animation on large jumps (`far`), where a smooth chase would feel sluggish —
// but a deliberate "jump to latest" passes force=true to always animate.
function rideToBottom(smooth = true, force = false) {
  const el = viewport()
  if (!el) return
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  const far = !force && el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight
  el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce && !far ? "smooth" : "auto" })
}

function scrollToBottom() {
  rideToBottom(true, true)
  pinned.value = true
}

// Snapshot the scroll anchor BEFORE the DOM updates for a line change (flush:pre)
// so a prepend can be compensated post-update. Only matters when NOT pinned to
// the bottom (i.e. the user is reading history up the stream).
watch(
  () => props.lines.length,
  () => {
    if (!pinned.value) captureScrollAnchor()
  },
  { flush: "pre" },
)

// After the DOM updates: tail to the bottom if pinned, else keep the view glued
// to where it was so a top prepend (older history) doesn't yank it.
watch(
  () => props.lines.length,
  async () => {
    await nextTick()
    if (props.tail && pinned.value) {
      requestAnimationFrame(() => rideToBottom(true))
    } else {
      restoreScrollAnchor()
    }
  },
)

const showJump = computed(() => props.tail && !pinned.value && props.lines.length > 0)
</script>

<template>
  <div
    class="relative overflow-hidden rounded-card border border-line bg-surface font-mono text-xs leading-relaxed"
  >
    <LpScrollArea
      ref="scrollRef"
      fade
      :content-class="wrap ? '' : 'min-w-max'"
      :style="{ height }"
      @scroll="onScroll"
    >
      <div
        v-if="lines.length === 0 || filteredEmpty"
        class="flex h-full flex-col items-center justify-center gap-1 px-4 py-10 text-center"
      >
        <span class="text-muted">{{ filteredEmpty ? "No lines match" : emptyLabel }}</span>
        <span v-if="filteredEmpty" class="text-muted/70">“{{ highlight }}”</span>
      </div>

      <template v-else>
        <!-- Older-history loading row, pinned at the top while a scroll-back page
             is fetched (driven by `loadingOlder`) — sits ABOVE the lines so it
             doesn't replace them. -->
        <div
          v-if="loadingOlder"
          class="flex items-center justify-center gap-2 py-2 text-muted"
        >
          <LpIcon name="lucide:loader-circle" :size="14" class="animate-spin" />
          <span class="text-[11px]">loading older…</span>
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
      <LpContextMenu :items="menuItems" :always="rowMenu">
      <TransitionGroup
        tag="ol"
        class="py-1"
        enter-active-class="transition duration-200 ease-[var(--ease-emphasized)]"
        enter-from-class="-translate-x-1 opacity-0"
        leave-active-class="overflow-hidden transition-all duration-200 ease-[var(--ease-emphasized)]"
        leave-from-class="max-h-8 opacity-100"
        leave-to-class="max-h-0 -translate-y-1 opacity-0"
        move-class="transition-transform duration-200 ease-[var(--ease-emphasized)]"
        @contextmenu="onRowContext"
        @pointerdown="onRowPointerDown"
      >
        <li
          v-for="{ line, n, count } in visibleLines"
          :key="n"
          :data-log-row="n"
          class="group relative flex items-start gap-0 px-0 leading-5 transition-colors hover:bg-surface-soft/60"
          :class="metaFor(line.level).sel"
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
          >{{ n + 1 }}</span>

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
            <template v-for="(part, p) in splitHighlight(line.message)" :key="p">
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
              enter-active-class="inline-block transition duration-200 ease-[var(--ease-emphasized)]"
              enter-from-class="scale-50 opacity-0"
            >
              <span
                v-if="count > 1"
                :key="count"
                class="ml-2 select-none rounded-pill bg-surface-soft px-1.5 align-[1px] text-[10px] font-semibold tabular-nums text-muted-strong"
                :title="`${count} identical lines`"
              >×{{ count }}</span>
            </Transition>
          </span>
        </li>
      </TransitionGroup>
      </LpContextMenu>
      </template>
    </LpScrollArea>

    <!-- jump-to-latest: shown only when tailing and scrolled away. The
         Transition rides an outer wrapper so its transform/opacity don't fight
         the button's own -translate-x-1/2 centring and hover colour transition. -->
    <Transition
      enter-active-class="transition duration-200 ease-[var(--ease-emphasized)]"
      enter-from-class="translate-y-3 scale-90 opacity-0"
      leave-active-class="transition duration-150 ease-in"
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
            class="transition-transform duration-200 ease-[var(--ease-emphasized)] group-hover:translate-y-0.5"
          />
          Jump to latest
        </button>
      </div>
    </Transition>
  </div>
</template>
