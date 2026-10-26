/*
 * The arithmetic behind LpUptimeBar, kept pure so the corners are tested
 * without a DOM: what share of the time was up, how that figure is printed,
 * and how a slice's span reads in its tooltip.
 */
import { toEpoch } from "./timeSpan"

export type UptimeStatus = "operational" | "degraded" | "down" | "maintenance" | "empty"

export type UptimeMoment = Date | string | number

/** Something that happened inside a slice: a restart, a deploy, an alert. */
export interface UptimeEvent {
  text: string
  at?: UptimeMoment
  status?: UptimeStatus
}

export interface UptimeSegment {
  /** Health of this slice. `empty` renders a faded placeholder (no data). */
  status: UptimeStatus
  /** Optional rich tooltip body; falls back to a humanised status. */
  label?: string
  /** When the slice begins and ends. Shown in the tooltip, and weights the uptime figure. */
  start?: UptimeMoment
  end?: UptimeMoment
  /**
   * Time spent in each state inside the slice, in ms. With it the figure
   * counts real time rather than slices (one bad minute in a day no longer
   * costs the whole day), and the tooltip says how long each state lasted.
   */
  durations?: Partial<Record<Exclude<UptimeStatus, "empty">, number>>
  /** What happened in the slice, a line each in the tooltip. */
  events?: UptimeEvent[]
}

const UP: ReadonlySet<UptimeStatus> = new Set(["operational", "maintenance"])

/** Worst first: the order a tooltip lists the time a slice spent in each state. */
export const UPTIME_SEVERITY: readonly Exclude<UptimeStatus, "empty">[] = ["down", "degraded", "maintenance", "operational"]

function span(seg: UptimeSegment): number | null {
  if (seg.start === undefined || seg.end === undefined) return null
  const ms = toEpoch(seg.end) - toEpoch(seg.start)
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

/**
 * Percent of the tracked time that was up (operational or planned
 * maintenance). Slices with `durations` count their real minutes; the rest
 * count by their span when every one of them has a span, and as one slice
 * each otherwise. Empty slices are not tracked. Null when nothing is.
 */
export function uptimeShare(segments: readonly UptimeSegment[]): number | null {
  const tracked = segments.filter((s) => s.status !== "empty")
  const bySpan = tracked.every((s) => s.durations || span(s) !== null)
  let up = 0
  let total = 0
  for (const seg of tracked) {
    if (seg.durations) {
      for (const [status, ms] of Object.entries(seg.durations)) {
        if (!ms || ms < 0) continue
        total += ms
        if (UP.has(status as UptimeStatus)) up += ms
      }
      continue
    }
    const weight = bySpan ? (span(seg) ?? 0) : 1
    total += weight
    if (UP.has(seg.status)) up += weight
  }
  return total > 0 ? (up / total) * 100 : null
}

/**
 * The figure and its decimal places: trailing zeros trimmed (100, 99.9), and
 * never rounded up to 100 while some time was down — 99.999 prints as 99.99,
 * because "100%" over an outage reads as no outage at all.
 */
export function uptimeFigure(pct: number): { value: number; decimals: number } {
  let value = Number(pct.toFixed(2))
  if (pct < 100 && value >= 100) value = 99.99
  const decimals = Number.isInteger(value) ? 0 : String(value).split(".")[1].length
  return { value, decimals }
}

/** "26 Oct, 12:00 – 12:15", the date written once when both ends share a day. */
export function uptimeRange(start: UptimeMoment, end: UptimeMoment | undefined, locale?: string): string {
  const from = toEpoch(start)
  if (!Number.isFinite(from)) return ""
  const full = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  if (end === undefined) return full.format(from)
  const to = toEpoch(end)
  if (!Number.isFinite(to)) return full.format(from)
  const sameDay = new Date(from).toDateString() === new Date(to).toDateString()
  const tail = sameDay ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }) : full
  return `${full.format(from)} – ${tail.format(to)}`
}
