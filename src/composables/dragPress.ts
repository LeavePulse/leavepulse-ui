import { HOLD_TO_DRAG_MS, slopFor } from "./gesture"
import { onBeforeUnmount, onMounted, readonly, ref, watch, type Ref } from "vue"
import { scrollParent } from "./scroll"
import { isNode } from "./realm"
import { nodeWindow } from "./useView"

/*
 * The press that turns into a sweep, shared by usePaintSelect and useDragDrop:
 * when a press becomes the gesture, what it does to the page while it lasts,
 * and how it ends.
 *
 * - A finger (or any pointer asked to `hold`) holds still for HOLD_TO_DRAG_MS
 *   first, so a swipe through a list still scrolls it; moving past the touch
 *   slop before that lets the press go. A mouse or pen starts at once, or once
 *   it has moved `slop` pixels, so a click on the item stays a click.
 * - While it lasts, text does not get selected, the page does not scroll under
 *   a finger, a long press does not open the context menu, and near the edge
 *   of the scrolling box the box scrolls on its own (the owner hears `move`
 *   again, since what is under the pointer changed).
 * - It ends on release (`end(true)`), on pointercancel, on unmount or, if the
 *   owner asks for it, on Escape (`end(false)`). The click the release makes
 *   is swallowed so the item under it does not toggle back.
 *
 * Listeners follow `root`: a root that renders after the owner mounted (a list
 * behind a loader) is picked up when it appears.
 *
 * When the press becomes the gesture, the element pressed dispatches
 * GESTURE_CLAIM_EVENT (bubbling): a gesture of its own an ancestor runs on the
 * same press, such as a strip dragged sideways to scroll it, drops it and
 * leaves the pointer to this one. It goes from the pressed element rather
 * than `root`, since the strip may sit inside `root` as well as around it. Near either edge of the box that scrolls along an axis, the box
 * scrolls that way, so a row reordered sideways follows the pointer too.
 */

/** Dispatched (bubbling) from the pressed element when its press becomes the gesture. */
export const GESTURE_CLAIM_EVENT = "lp-gesture-claim"
export interface DragPressOptions {
  root: Ref<HTMLElement | null>
  /** The pointer moved, or the box scrolled under it, while the gesture runs. */
  move: (x: number, y: number) => void
  /** The gesture ended: released (true) or cancelled (false). */
  end: (released: boolean) => void
  /** Escape cancels the gesture. */
  escape?: boolean
}

export interface DragPressStart {
  /** Hold this long first, whatever the pointer. Default: only a finger holds. */
  hold?: number
  /** A mouse or pen moves this far before the gesture starts. Default 0: at once. */
  slop?: number
}

const EDGE_PX = 44
const SCROLL_STEP = 14

interface Pending {
  pointerId: number
  pointerType: string
  origin: EventTarget | null
  x: number
  y: number
  begin: (x: number, y: number) => boolean
  slop: number
  timer: ReturnType<typeof setTimeout> | null
}

export function useDragPress(options: DragPressOptions) {
  const active = ref(false)
  let pending: Pending | null = null
  let scroller: HTMLElement | null = null
  let scrollerX: HTMLElement | null = null
  let x = 0
  let y = 0
  let frame = 0
  let swallowClick = false

  const hostWindow = (): Window => (options.root.value ? nodeWindow(options.root.value) : window)

  function cancelPending() {
    if (pending?.timer) clearTimeout(pending.timer)
    pending = null
  }

  function go(begin: (x: number, y: number) => boolean, at: { x: number; y: number }, origin: EventTarget | null) {
    if (!begin(at.x, at.y)) return
    active.value = true
    x = at.x
    y = at.y
    scroller = scrollParent(options.root.value)
    scrollerX = scrollParent(options.root.value, { axis: "x", self: true })
    const from = isNode(origin) && origin.isConnected ? origin : options.root.value
    from?.dispatchEvent(new CustomEvent(GESTURE_CLAIM_EVENT, { bubbles: true }))
    hostWindow().getSelection()?.removeAllRanges()
    if (options.root.value) options.root.value.style.userSelect = "none"
    if (!frame) frame = requestAnimationFrame(tick)
  }

  /** Bind to `pointerdown`; `begin` decides whether the gesture really starts. */
  function start(event: PointerEvent, begin: (x: number, y: number) => boolean, how: DragPressStart = {}) {
    if (event.button !== 0 || active.value) return
    cancelPending()
    const at = { x: event.clientX, y: event.clientY }
    const holds = how.hold !== undefined || event.pointerType === "touch"
    if (!holds && !how.slop) {
      // Keeps the press from starting a text selection or moving focus mid-gesture.
      event.preventDefault()
      go(begin, at, event.target)
      return
    }
    pending = { pointerId: event.pointerId, pointerType: event.pointerType, origin: event.target, ...at, begin, slop: holds ? 0 : how.slop ?? 0, timer: null }
    if (!holds) return
    pending.timer = setTimeout(() => {
      const held = pending
      pending = null
      if (!held) return
      go(held.begin, held, held.origin)
      navigator.vibrate?.(8)
    }, how.hold ?? HOLD_TO_DRAG_MS)
  }

  function tick() {
    frame = 0
    if (!active.value) return
    const box = scroller?.getBoundingClientRect() ?? { top: 0, bottom: hostWindow().innerHeight }
    const delta = y > box.bottom - EDGE_PX ? SCROLL_STEP : y < box.top + EDGE_PX ? -SCROLL_STEP : 0
    if (delta) {
      if (scroller) scroller.scrollTop += delta
      else hostWindow().scrollBy(0, delta)
    }
    let deltaX = 0
    if (scrollerX) {
      const row = scrollerX.getBoundingClientRect()
      deltaX = x > row.right - EDGE_PX ? SCROLL_STEP : x < row.left + EDGE_PX ? -SCROLL_STEP : 0
      if (deltaX) scrollerX.scrollLeft += deltaX
    }
    if (delta || deltaX) options.move(x, y)
    frame = requestAnimationFrame(tick)
  }

  function finish(released: boolean) {
    cancelPending()
    if (!active.value) return
    active.value = false
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (options.root.value) options.root.value.style.userSelect = ""
    swallowClick = true
    setTimeout(() => (swallowClick = false), 0)
    options.end(released)
  }

  function onMove(event: PointerEvent) {
    if (pending && event.pointerId === pending.pointerId) {
      const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
      if (pending.timer) {
        // A mouse that moves before the hold is over is scrolling or
        // selecting, the way a finger is: it lets the press go.
        if (moved > slopFor(pending.pointerType)) cancelPending()
        return
      }
      if (moved <= pending.slop) return
      const { begin } = pending
      const at = { x: pending.x, y: pending.y }
      const { origin } = pending
      pending = null
      go(begin, at, origin)
    }
    if (!active.value) return
    x = event.clientX
    y = event.clientY
    options.move(x, y)
  }

  const onUp = () => finish(true)
  const onCancel = () => finish(false)

  function onKey(event: KeyboardEvent) {
    if (!options.escape || event.key !== "Escape" || !active.value) return
    event.preventDefault()
    event.stopPropagation()
    finish(false)
  }

  function onClickCapture(event: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    event.stopPropagation()
    event.preventDefault()
  }

  // A long press is also how a finger asks for the context menu; once it has
  // turned into the gesture, that menu would open over it.
  function onContextMenu(event: Event) {
    if (!active.value && !swallowClick) return
    event.preventDefault()
    event.stopPropagation()
  }

  // A finger that has started the gesture must not scroll the page under it.
  function onTouchMove(event: TouchEvent) {
    if (active.value) event.preventDefault()
  }

  // The browser's own drag of a link or an image would take the pointer away.
  function onNativeDrag(event: DragEvent) {
    if (pending || active.value) event.preventDefault()
  }

  watch(
    options.root,
    (el, _, onCleanup) => {
      if (!el) return
      el.addEventListener("touchmove", onTouchMove, { passive: false })
      el.addEventListener("dragstart", onNativeDrag)
      onCleanup(() => {
        el.removeEventListener("touchmove", onTouchMove)
        el.removeEventListener("dragstart", onNativeDrag)
      })
    },
    { immediate: true, flush: "post" },
  )

  let listening: Window | null = null
  onMounted(() => {
    listening = hostWindow()
    listening.addEventListener("pointermove", onMove)
    listening.addEventListener("pointerup", onUp)
    listening.addEventListener("pointercancel", onCancel)
    listening.addEventListener("keydown", onKey, true)
    listening.addEventListener("click", onClickCapture, true)
    listening.addEventListener("contextmenu", onContextMenu, true)
  })
  onBeforeUnmount(() => {
    finish(false)
    swallowClick = false
    listening?.removeEventListener("pointermove", onMove)
    listening?.removeEventListener("pointerup", onUp)
    listening?.removeEventListener("pointercancel", onCancel)
    listening?.removeEventListener("keydown", onKey, true)
    listening?.removeEventListener("click", onClickCapture, true)
    listening?.removeEventListener("contextmenu", onContextMenu, true)
  })

  return { start, cancel: () => finish(false), active: readonly(active) }
}
