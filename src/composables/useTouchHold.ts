import { onBeforeUnmount } from "vue"

/*
 * Press-and-hold on a touch screen, for things a pointer reaches by hovering
 * (a hover card, a tooltip). A hold that drifts is a scroll, not a hold, so
 * moving past a few pixels cancels it. Once it has fired, the click the finger
 * produces on lifting is swallowed: the reader asked for the preview, not for
 * the link or button under it. A mouse or pen is left alone.
 *
 * The handlers go on the trigger: pointerdown, pointermove, pointerup,
 * pointercancel, click (capture) and contextmenu.
 */
const SLOP = 8
/* A long press may produce no click at all; past this the next click is the user's own. */
const CLICK_AFTER_RELEASE_MS = 350

export interface TouchHoldOptions {
  /** Whether a touch press may start a hold now. */
  enabled: () => boolean
  /** How long the finger must stay, in ms. */
  delay: () => number
  onHold: () => void
}

export function useTouchHold(options: TouchHoldOptions) {
  let timer = 0
  /* The finger the hold belongs to: a second one must not move or end it. */
  let finger: number | null = null
  let start = { x: 0, y: 0 }
  let held = false

  function stop() {
    window.clearTimeout(timer)
    timer = 0
  }

  function onPointerDown(event: PointerEvent) {
    // Any new press starts over: on a hybrid laptop the mouse click after a
    // hold must not be taken for that hold's own click.
    if (timer && event.pointerId !== finger) return
    held = false
    if (event.pointerType !== "touch" || !options.enabled()) return
    finger = event.pointerId
    start = { x: event.clientX, y: event.clientY }
    stop()
    timer = window.setTimeout(() => {
      timer = 0
      held = true
      options.onHold()
    }, options.delay())
  }

  function onPointerMove(event: PointerEvent) {
    if (!timer || event.pointerId !== finger) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP) stop()
  }

  function onPointerUp(event: PointerEvent) {
    if (finger !== null && event.pointerId !== finger) return
    finger = null
    stop()
    if (held) window.setTimeout(() => (held = false), CLICK_AFTER_RELEASE_MS)
  }

  // A cancelled press produces no click, so there is nothing left to swallow.
  function onPointerCancel(event?: PointerEvent) {
    if (event && finger !== null && event.pointerId !== finger) return
    finger = null
    stop()
    held = false
  }

  function onClickCapture(event: MouseEvent) {
    if (!held) return
    held = false
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  // A long press would otherwise also bring up the system's own menu.
  function onContextMenu(event: Event) {
    if (timer || held) event.preventDefault()
  }

  onBeforeUnmount(stop)

  return {
    /** Drops a hold in progress, as if the finger had been lifted off the screen. */
    cancel: () => onPointerCancel(),
    handlers: { onPointerdown: onPointerDown, onPointermove: onPointerMove, onPointerup: onPointerUp, onPointercancel: onPointerCancel, onClickCapture, onContextmenu: onContextMenu },
  }
}
