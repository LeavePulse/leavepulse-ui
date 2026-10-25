/*
 * Spans of time as people read them: "0:42", "2d 3h", "1m 12s".
 *
 * Pure functions, shared by LpCountdown (time left) and LpPipeline (time
 * taken), so a job that ran for 72 seconds and a code that can be resent in 72
 * seconds are written the same way. Nothing here reads the clock: callers pass
 * milliseconds, which is what makes the formatting testable and lets the
 * components decide how often to look at the time.
 */

export interface TimeSplit {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** Whole milliseconds left over below a second. */
  ms: number
}

export type TimeUnit = "d" | "h" | "m" | "s"

/** Unit suffixes, so an app can write "2 д 3 ч" without reformatting. */
export type TimeUnitLabels = Record<TimeUnit, string>

export const DEFAULT_UNIT_LABELS: TimeUnitLabels = { d: "d", h: "h", m: "m", s: "s" }

/**
 * How a span is written.
 *
 * `clock` is for a short wait the eye follows second by second ("0:42",
 * "1:05:09"); `units` is for a long one read at a glance ("2d 3h"); `auto` is
 * clock below an hour and units above it, which is what both examples above
 * want without the caller choosing.
 */
export type TimeFormat = "auto" | "clock" | "units"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Splits a span into calendar-free parts. Negative spans count as zero. */
export function splitTime(ms: number): TimeSplit {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0
  return {
    days: Math.floor(total / DAY),
    hours: Math.floor((total % DAY) / HOUR),
    minutes: Math.floor((total % HOUR) / MINUTE),
    seconds: Math.floor((total % MINUTE) / SECOND),
    ms: total % SECOND,
  }
}

/** One printed piece of a span: a number and what follows it. */
export interface TimePart {
  unit: TimeUnit
  value: number
  /** Digits to pad to: 2 for a clock's minutes and seconds after the first. */
  pad: number
  /** Text printed after the number: a unit suffix, or ":" between clock fields. */
  after: string
}

/**
 * A countdown rounds UP: with 41.2 s left it says 0:42, so the display only
 * reaches 0:00 at the moment the wait is over. Rounding down would show 0:00
 * for most of the last second while the thing is still not ready.
 */
export function ceilToSecond(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.ceil(ms / SECOND) * SECOND
}

/** Which of `clock` and `units` an `auto` span resolves to. */
export function resolveFormat(ms: number, format: TimeFormat): "clock" | "units" {
  if (format !== "auto") return format
  return ms >= HOUR ? "units" : "clock"
}

/**
 * The parts of a span in the given format.
 *
 * Units keep the two largest non-zero places ("2d 3h", not "2d 3h 4m 5s"): a
 * long wait is read for its size, and the extra places only flicker. A span
 * under a minute keeps its seconds, and zero is "0s" rather than nothing.
 * The clock always has minutes and seconds and grows hours when it needs
 * them; days fold into hours, since a clock reading of days is not a clock.
 */
export function timeParts(
  ms: number,
  format: TimeFormat = "auto",
  labels: TimeUnitLabels = DEFAULT_UNIT_LABELS,
  places = 2,
): TimePart[] {
  const t = splitTime(ms)
  if (resolveFormat(ms, format) === "clock") {
    const hours = t.days * 24 + t.hours
    const parts: TimePart[] = []
    if (hours > 0) parts.push({ unit: "h", value: hours, pad: 1, after: ":" })
    parts.push({ unit: "m", value: t.minutes, pad: hours > 0 ? 2 : 1, after: ":" })
    parts.push({ unit: "s", value: t.seconds, pad: 2, after: "" })
    return parts
  }
  const all: Array<[TimeUnit, number]> = [["d", t.days], ["h", t.hours], ["m", t.minutes], ["s", t.seconds]]
  const first = all.findIndex(([, v]) => v > 0)
  if (first === -1) return [{ unit: "s", value: 0, pad: 1, after: labels.s }]
  return all
    .slice(first, first + Math.max(1, places))
    // A trailing zero place says nothing ("2d 0h"); a middle one would, but
    // with two places there is no middle.
    .filter(([, v], i) => i === 0 || v > 0)
    .map(([unit, value]) => ({ unit, value, pad: 1, after: labels[unit] }))
}

/** Pads a part's number the way the clock prints it. */
export function padPart(part: Pick<TimePart, "value" | "pad">): string {
  return String(part.value).padStart(part.pad, "0")
}

/** The span as one string — for titles, aria text and anything not animated. */
export function formatTime(
  ms: number,
  format: TimeFormat = "auto",
  labels: TimeUnitLabels = DEFAULT_UNIT_LABELS,
  places = 2,
): string {
  const parts = timeParts(ms, format, labels, places)
  if (resolveFormat(ms, format) === "clock") return parts.map((p) => padPart(p) + p.after).join("")
  return parts.map((p) => `${p.value}${p.after}`).join(" ")
}

/**
 * Time a job took, as a CI log writes it: "850ms" under a second (a step that
 * fast is still worth telling apart from one that took nothing), then "42s",
 * "1m 12s", "1h 3m".
 */
export function formatElapsed(ms: number, labels: TimeUnitLabels = DEFAULT_UNIT_LABELS): string {
  if (!Number.isFinite(ms) || ms < 0) return ""
  if (ms < SECOND) return `${Math.round(ms)}ms`
  return formatTime(ms, "units", labels)
}

/**
 * Milliseconds until the display next changes, so a ticking timer wakes on the
 * second boundary instead of every 1000 ms from whenever it started. Started
 * mid-second, a plain interval shows each value late by that fraction — and
 * keeps drifting as timers fire late. Never zero: a tick that lands exactly on
 * the boundary waits a whole second rather than spinning.
 */
export function msToNextSecond(remaining: number): number {
  if (!Number.isFinite(remaining) || remaining <= 0) return SECOND
  const rest = remaining % SECOND
  return rest === 0 ? SECOND : rest
}

/**
 * Remaining time worth saying aloud. A timer re-read every second is noise to
 * a screen reader; one that speaks when it crosses a round mark ("5 minutes
 * left", "10 seconds left") is information. Returns the mark crossed going
 * from `before` to `after`, or null.
 */
export const DEFAULT_MILESTONES = [3600_000, 1800_000, 600_000, 300_000, 60_000, 30_000, 10_000]

export function crossedMilestone(
  before: number,
  after: number,
  milestones: readonly number[] = DEFAULT_MILESTONES,
): number | null {
  if (!(after < before)) return null
  let hit: number | null = null
  for (const mark of milestones) {
    if (before > mark && after <= mark) hit = hit === null ? mark : Math.min(hit, mark)
  }
  return hit
}

/** A date-ish input as epoch milliseconds, or NaN when it is not one. */
export function toEpoch(value: Date | string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return Number.NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  return new Date(value).getTime()
}
