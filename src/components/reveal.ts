/*
 * Keyframes and timing for LpRevealOnScroll, kept apart from the component so
 * they can be tested without a DOM.
 */

export type RevealPreset = "fade" | "rise" | "blur" | "scale"
export type RevealDirection = "up" | "down" | "left" | "right"

/**
 * The hidden state an entrance starts from; the end state is always "as laid
 * out", so the keyframes only describe where the content comes FROM.
 *
 * `direction` is the way the content travels: `up` starts below and rises.
 * Every preset fades — motion without a fade reads as a layout jump.
 */
export function revealFrom(
  preset: RevealPreset,
  direction: RevealDirection,
  distance: number,
): Keyframe {
  const offset = (d: number) =>
    ({
      up: `translate3d(0, ${d}px, 0)`,
      down: `translate3d(0, ${-d}px, 0)`,
      left: `translate3d(${d}px, 0, 0)`,
      right: `translate3d(${-d}px, 0, 0)`,
    })[direction]
  switch (preset) {
    case "fade":
      return { opacity: 0 }
    case "rise":
      return { opacity: 0, transform: offset(distance) }
    case "blur":
      // A short travel with the blur: blur alone looks like a focus problem.
      return { opacity: 0, filter: "blur(8px)", transform: offset(distance / 2) }
    case "scale":
      return { opacity: 0, transform: "scale(0.94)" }
  }
}

/** The resting state matching `revealFrom`'s properties. */
export function revealTo(from: Keyframe): Keyframe {
  const to: Keyframe = { opacity: 1 }
  if ("transform" in from) to.transform = "none"
  if ("filter" in from) to.filter = "blur(0px)"
  return to
}

/**
 * Delay of the `index`-th child. The steps stop growing after `cap` children:
 * a list of eighty would otherwise take seconds to finish arriving, and the
 * last rows would still be invisible when the user starts reading them.
 */
export function staggerDelay(index: number, delay: number, stagger: number, cap = 10): number {
  return delay + Math.min(Math.max(0, index), cap) * Math.max(0, stagger)
}
