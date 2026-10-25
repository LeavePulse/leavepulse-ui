import { onScopeDispose, toValue, type MaybeRefOrGetter } from "vue"
import { prefersReducedMotion } from "./easing"

/*
 * The scaffolding of a decoration that follows the pointer (LpMagnetic's
 * pull, the spotlight glow, LpTilt's lean): take the latest pointer position,
 * and paint from it once per animation frame.
 *
 * pointermove fires faster than frames, and a re-render per event for a
 * decoration is the kind of cost the launcher on WebKitGTK actually feels. So
 * nothing here is reactive: `move` records the position and asks for a frame,
 * `paint` runs in that frame with the latest one, and writes straight to the
 * element (a style property, a custom property). The three effects had this
 * written out each, with the same filters in slightly different orders.
 *
 * Who listens is the caller's: the spotlight listens on its own element, the
 * magnet on its window (its field reaches past its edges), the tilt through
 * handlers its consumer binds. They all feed `move`.
 *
 * Touch and pen are ignored unless `anyPointer`: there is no hover to follow,
 * and an effect that jumps to wherever a finger landed reads as a pressed
 * state that is not one. Reduced motion and `disabled` drop moves entirely.
 */
export interface PointerFrameOptions {
  /** Paint with the latest pointer position, in client coordinates. */
  paint: (x: number, y: number) => void
  /** Drop moves while true; the caller decides what "off" looks like. */
  disabled?: MaybeRefOrGetter<boolean | undefined>
  /** Follow touch and pen too, not only a mouse. */
  anyPointer?: boolean
}

export interface PointerFrame {
  /** Feed a pointer event. False when it was dropped (touch, reduced motion, disabled). */
  move: (event: PointerEvent) => boolean
  /** Paint at a given position on the next frame, as if the pointer were there (a pointer that left the window). */
  moveTo: (x: number, y: number) => void
  /** Drop a frame that has been asked for but not painted yet. */
  cancel: () => void
}

export function usePointerFrame(options: PointerFrameOptions): PointerFrame {
  let frame = 0
  let lastX = 0
  let lastY = 0

  const run = () => {
    frame = 0
    options.paint(lastX, lastY)
  }

  const moveTo = (x: number, y: number) => {
    lastX = x
    lastY = y
    if (!frame) frame = requestAnimationFrame(run)
  }

  const move = (event: PointerEvent): boolean => {
    if (!options.anyPointer && event.pointerType !== "mouse") return false
    if (toValue(options.disabled) || prefersReducedMotion()) return false
    moveTo(event.clientX, event.clientY)
    return true
  }

  const cancel = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  onScopeDispose(cancel)
  return { move, moveTo, cancel }
}
