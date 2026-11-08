/*
 * How things come and go in LpVideoPlayer and LpVideoTrim, bound on a
 * <Transition> with v-bind so every control, overlay and hint in both appears
 * and leaves the same way, never in a single frame. Entrances take the
 * medium duration and the emphasized curve; exits are quicker, since what is
 * leaving no longer needs reading. Reduced motion swaps instantly.
 */
export const FADE = {
  enterActiveClass: "transition-opacity duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none",
  leaveActiveClass: "transition-opacity duration-(--duration-fast) ease-(--ease-emphasized) motion-reduce:transition-none",
  enterFromClass: "opacity-0",
  leaveToClass: "opacity-0",
} as const

/** A fade with a small settle in scale: for a button or a box, which reads as arriving rather than blinking on. */
export const FADE_SCALE = {
  enterActiveClass: "transition-[opacity,scale] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none",
  leaveActiveClass: "transition-[opacity,scale] duration-(--duration-fast) ease-(--ease-emphasized) motion-reduce:transition-none",
  enterFromClass: "scale-90 opacity-0",
  leaveToClass: "scale-90 opacity-0",
} as const

/** One icon handing over to another in the same spot (play and pause, sound on and off). */
export const ICON_SWAP = {
  mode: "out-in",
  enterActiveClass: "transition-[opacity,scale] duration-(--duration-fast) ease-(--ease-emphasized) motion-reduce:transition-none",
  leaveActiveClass: "transition-[opacity,scale] duration-(--duration-fast) ease-(--ease-emphasized) motion-reduce:transition-none",
  enterFromClass: "scale-75 opacity-0",
  leaveToClass: "scale-75 opacity-0",
} as const

/**
 * A ghost button over the picture: white on the video in every theme, as the
 * lightbox's are. The players' own buttons use it, and their `#actions` and
 * `#controls` slots hand it out as `buttonClass`, so an app's button there
 * (a bin that takes the video back out of a dropzone) looks like theirs.
 */
export const OVERLAY_BUTTON = "text-white/85 hover:bg-white/15 hover:text-white"
