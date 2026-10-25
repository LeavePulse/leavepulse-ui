/*
 * The parts of LpVideoBackdrop that are plain arithmetic, kept out of the SFC
 * so they can be tested without a media element.
 */

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
  const clamp = (value: number) => Math.min(duration, Math.max(0, value))
  let from = clamp(options.start ?? 0)
  let to = clamp(options.end ?? duration)
  if (to < from) [from, to] = [to, from]
  const minLength = Math.min(duration, Math.max(0, options.minLength ?? 0.5))
  if (to - from < minLength) {
    to = Math.min(duration, from + minLength)
    from = Math.max(0, to - minLength)
  }
  const fade = Math.min(Math.max(0, options.crossfade ?? 0), (to - from) / 2)
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
  return Math.min(1, Math.max(0, (incomingTime - plan.from) / plan.fade))
}

/** Whether the whole clip loops with nothing cut and no overlap, which the media element does natively. */
export function isNativeLoop(plan: LoopPlan, duration: number): boolean {
  return plan.fade === 0 && plan.from === 0 && plan.to >= duration
}

/** "1:05", "0:07.5": a position on a clip as a range slider labels it. */
export function formatClipTime(seconds: number, precise = false): string {
  const t = splitTime(Number.isFinite(seconds) ? seconds * 1000 : 0)
  // Hours fold into minutes: a slider over a clip reads "75:00", not "1:15:00".
  const minutes = (t.days * 24 + t.hours) * 60 + t.minutes
  const secs = String(t.seconds).padStart(2, "0")
  const tenth = Math.floor(t.ms / 100)
  return precise && tenth ? `${minutes}:${secs}.${tenth}` : `${minutes}:${secs}`
}
