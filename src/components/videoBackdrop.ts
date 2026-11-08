/*
 * The parts of LpVideoBackdrop that are plain arithmetic, kept out of the SFC
 * so they can be tested without a media element.
 */

import { clamp } from "../composables/clamp"
import { splitTime } from "./timeSpan"

/** The stretch of a clip that loops, and how long two passes overlap at the seam. */
export interface LoopPlan {
  /** Where every pass starts, in seconds of media time. */
  from: number
  /** Where every pass ends, in seconds of media time. */
  to: number
  /** Media seconds over which the next pass fades in over the ending one; 0 cuts. */
  fade: number
}

/**
 * The loop a backdrop plays, from what was asked and what the clip has.
 *
 * `start` and `end` are clamped into the clip and put in order; a stretch
 * shorter than `minLength` is widened from its start (or, at the clip's end,
 * backwards), since a loop of a few frames reads as a flicker. The overlap
 * is at most half the stretch: a seam longer than that would have the next
 * pass begin before the current one had shown anything of its own.
 */
export function planLoop(
  duration: number,
  options: { start?: number; end?: number; crossfade?: number; minLength?: number } = {},
): LoopPlan {
  if (!Number.isFinite(duration) || duration <= 0) return { from: 0, to: 0, fade: 0 }
  const within = (value: number) => clamp(value, 0, duration)
  let from = within(options.start ?? 0)
  let to = within(options.end ?? duration)
  if (to < from) [from, to] = [to, from]
  const minLength = clamp(options.minLength ?? 0.5, 0, duration)
  if (to - from < minLength) {
    to = Math.min(duration, from + minLength)
    from = Math.max(0, to - minLength)
  }
  const fade = clamp(options.crossfade ?? 0, 0, (to - from) / 2)
  return { from, to, fade }
}

/** Whether the pass at `time` has reached the point where the next one must begin. */
export function seamReached(plan: LoopPlan, time: number): boolean {
  return plan.to > plan.from && time >= plan.to - plan.fade
}

/**
 * How far the incoming pass is through the seam, 0 to 1, from its own media
 * time: it starts at `from` and is fully in once it has played `fade` seconds.
 * Measured on the media clock rather than the wall clock, so the fade keeps
 * pace with a playback rate and holds still while playback stalls.
 */
export function seamProgress(plan: LoopPlan, incomingTime: number): number {
  if (plan.fade <= 0) return 1
  return clamp((incomingTime - plan.from) / plan.fade, 0, 1)
}

/** Whether the whole clip loops with nothing cut and no overlap, which the media element does natively. */
export function isNativeLoop(plan: LoopPlan, duration: number): boolean {
  return plan.fade === 0 && plan.from === 0 && plan.to >= duration
}

/**
 * "1:05", "0:07.5": a position on a clip as a range slider labels it.
 * `precise` adds tenths when there are any; "fixed" always writes them, for a
 * time that changes while it is read, so it keeps one length ("0:05.0", not
 * "0:05" between "0:04.9" and "0:05.1").
 */
export function formatClipTime(seconds: number, precise: boolean | "fixed" = false): string {
  const t = splitTime(Number.isFinite(seconds) ? seconds * 1000 : 0)
  // Hours fold into minutes: a slider over a clip reads "75:00", not "1:15:00".
  const minutes = (t.days * 24 + t.hours) * 60 + t.minutes
  const secs = String(t.seconds).padStart(2, "0")
  const tenth = Math.floor(t.ms / 100)
  return precise === "fixed" || (precise && tenth) ? `${minutes}:${secs}.${tenth}` : `${minutes}:${secs}`
}

/** The widest a clip time up to `seconds` gets, its digits as zeros: what SteadyText reserves. */
export function widestClipTime(seconds: number): string {
  return formatClipTime(seconds, "fixed").replace(/\d/g, "0")
}

/**
 * The slowest rate a pause eases down to before the element is paused, and a
 * start eases up from. Chromium refuses a rate below a sixteenth; past that
 * point the picture is all but still anyway.
 */
export const SLOWEST_RATE = 1 / 16
