import { onBeforeUnmount } from "vue"
import { createGesture } from "./useGesture"

/*
 * Press-and-hold on a touch screen, for things a pointer reaches by hovering
 * (a hover card, a tooltip). The kit's gesture engine's long press, limited to
 * touch: a hold that drifts past the slop is a scroll, not a hold; once it has
 * fired, the click the finger produces on lifting is swallowed (the reader
 * asked for the preview, not for the link or button under it), and the
 * system's own long-press menu is kept away. A mouse or pen is left alone.
 *
 * The handlers go on the trigger.
 */
export interface TouchHoldOptions {
  /** Whether a touch press may start a hold now. */
  enabled: () => boolean
  /** How long the finger must stay, in ms. */
  delay: () => number
  onHold: () => void
}

export function useTouchHold(options: TouchHoldOptions) {
  const gesture = createGesture({
    enabled: options.enabled,
    pointerTypes: ["touch"],
    longPress: { delay: options.delay, handler: () => options.onHold() },
  })
  onBeforeUnmount(gesture.dispose)
  return {
    /** Drops a hold in progress, as if the finger had been lifted off the screen. */
    cancel: gesture.cancel,
    handlers: gesture.handlers,
  }
}
