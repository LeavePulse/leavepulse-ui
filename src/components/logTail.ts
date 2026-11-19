import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type ComputedRef, type Ref } from "vue"
import { clamp } from "../composables/clamp"
import { durationToken, prefersReducedMotion, tokenEase } from "../composables/easing"
import { useResizeObserver } from "../composables/useResizeObserver"
import { inTextField } from "../composables/textEntry"
import { isElement, nodeWindow } from "../composables/useView"
import type { LogLine } from "./logViewerTypes"

/*
 * LpLogViewer's scrolling: the virtual window over a long stream, the tail
 * that follows new lines (and lets go the moment the reader reaches up), the
 * scroll-back trigger for older history, and the anchor that keeps the line
 * being read in place while lines change around it.
 */
export interface LogRow {
  line: LogLine
  n: number
  count: number
}

export interface LogTailOptions {
  /** The rows after filtering and folding, each with its original index. */
  visibleLines: ComputedRef<LogRow[]>
  /** The lines the viewer holds (windowed, maybe frozen): what `n` indexes. */
  sourceLines: ComputedRef<LogLine[]>
  /** The consumer's stream, whose changes move the tail. */
  lines: () => LogLine[]
  wrap: () => boolean
  tail: () => boolean
  loadOlder: () => boolean
  loadingOlder: () => boolean
  onReachTop: () => void
  /** The search match being shown; while one is, new lines do not move the view. */
  current: Ref<number>
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

// Slack from the bottom that still counts as "pinned". Generous (a few rows
// tall) so a freshly pushed line — which momentarily grows scrollHeight before
// the tail catches up — doesn't unpin us and flash the jump-to-latest pill;
// only a deliberate scroll up past this clears it.
const NEAR = 120

// Distance from the top that arms a scroll-back fetch (a few rows of slack so
// the next page is on its way before the user hits the very top).
const TOP_NEAR = 80

// Long enough for a scroll event already queued by the glide to arrive.
const LEAVE_GRACE_MS = 250

const UPWARD_KEYS = new Set(["ArrowUp", "PageUp", "Home"])

/*
 * Rows that just arrived while virtualised. The TransitionGroup is off there
 * (FLIP over thousands of rows is the cost virtualising avoids), but a pushed
 * line still should not pop in. Only the lines appended by the latest change
 * are marked, found by where the previous last line sits in the new array, so
 * a row scrolled into view later, or a whole replaced buffer, never plays it.
 * A burst taller than the viewport is not worth animating line by line.
 */
const FRESH_CAP = 40

export function useLogTail(options: LogTailOptions) {
  const { visibleLines, current } = options

  const virtualise = computed(() => !options.wrap() && visibleLines.value.length > VIRTUALISE_ABOVE)

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

  function viewport(): HTMLElement | null {
    return scrollRef.value?.viewportEl ?? null
  }

  function atBottom(el: HTMLElement): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR
  }

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
    if (!options.loadOlder()) return
    if (el.scrollTop <= TOP_NEAR) {
      if (topArmed && !options.loadingOlder()) {
        topArmed = false
        options.onReachTop()
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
      const t = clamp((now - started) / ms, 0, 1)
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

  function onKeydown(event: KeyboardEvent) {
    if (!inTextField(event.target) && UPWARD_KEYS.has(event.key)) leaveTail()
  }

  let holdWindow: Window | null = null

  function release() {
    holding = false
    holdWindow?.removeEventListener("pointerup", release)
    holdWindow?.removeEventListener("pointercancel", release)
    holdWindow?.removeEventListener("touchend", release)
    holdWindow = null
  }

  function hold(event: Event) {
    // The scroll area's root, so its scrollbar (a sibling of the viewport)
    // counts, and the toolbar and jump pill above it do not.
    const area = viewport()?.parentElement
    if (!area || !isElement(event.target) || !area.contains(event.target)) return
    stopGlide()
    release()
    holding = true
    holdWindow = nodeWindow(area)
    holdWindow.addEventListener("pointerup", release)
    holdWindow.addEventListener("pointercancel", release)
    holdWindow.addEventListener("touchend", release)
  }

  function scrollToBottom() {
    current.value = -1
    rideToBottom()
    pinned.value = true
  }

  // Brings a row (by its position among the visible rows) to the middle of the
  // viewport. A virtualised row may not be in the DOM yet, so the offset is
  // computed from the fixed row height instead.
  function revealRow(position: number | undefined) {
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

  // Snapshot the scroll anchor BEFORE the DOM updates for a line change (flush:pre)
  // so a prepend can be compensated post-update. Only matters when NOT pinned to
  // the bottom (i.e. the user is reading history up the stream).
  /*
   * A capped buffer (shift + push, or slice(-N)) keeps the length constant once
   * full, so the length alone stops seeing new lines. The array, its length and
   * its last line together change on every append, prepend or replacement.
   */
  const linesSignal = () => {
    const lines = options.lines()
    return [lines, lines.length, lines[lines.length - 1]]
  }

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
      if (options.tail() && pinned.value && !holding && current.value < 0) {
        rideToBottom()
      } else {
        restoreScrollAnchor()
      }
    },
  )

  const showJump = computed(() => options.tail() && !pinned.value && options.lines().length > 0)

  // Track the viewport height for the whole lifetime, not just at mount. Reading
  // it once was a deadlock when the viewer mounted inside a container that had no
  // height yet (a drawer mid open-animation, a hidden tab): the virtual window
  // collapsed to a single row, so there was nothing to scroll, and `onScroll` —
  // the only other place that refreshed the height — could never fire to correct
  // it. The list looked stuck and wouldn't scroll at all.
  function measureViewport() {
    const el = viewport()
    if (el) viewportHeight.value = el.clientHeight
  }
  useResizeObserver(viewport, measureViewport)

  onMounted(() => {
    measureViewport()
    const el = viewport()
    // A tailing viewer opens on its newest lines. Opening at the top left the
    // first pushed line to haul the whole history past in one go.
    if (el && options.tail()) el.scrollTop = el.scrollHeight
  })

  onBeforeUnmount(() => {
    stopGlide()
    release()
  })

  const freshLines = shallowRef<WeakSet<LogLine>>(new WeakSet())
  let lastSeen: LogLine | undefined
  watch(
    linesSignal,
    () => {
      const lines = options.lines()
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
    const line = options.sourceLines.value[n]
    return virtualise.value && !!line && freshLines.value.has(line)
  }

  return {
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
  }
}
