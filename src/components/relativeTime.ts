import { toEpoch } from "./timeSpan"

/*
 * "3 min ago" / "in 2 h": the wording, and when it next changes.
 *
 * Pure, so it can be tested without a clock and so a non-Vue caller (a toast,
 * a log line) can say a date the same way LpRelativeTime does.
 */

export type RelativeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30.4375 * DAY
const YEAR = 365.25 * DAY

/*
 * Each unit holds until the next one reads better. The cut-offs sit before the
 * full next unit on purpose: "50 minutes ago" is fussier than "1 hour ago",
 * and nobody says "6 days ago" about a date that was a week ago.
 */
const SCALE: { unit: RelativeUnit; ms: number; until: number }[] = [
  { unit: "second", ms: SECOND, until: 45 * SECOND },
  { unit: "minute", ms: MINUTE, until: 45 * MINUTE },
  { unit: "hour", ms: HOUR, until: 22 * HOUR },
  { unit: "day", ms: DAY, until: 6.5 * DAY },
  { unit: "week", ms: WEEK, until: 26 * DAY },
  { unit: "month", ms: MONTH, until: 320 * DAY },
  { unit: "year", ms: YEAR, until: Infinity },
]

export interface RelativeTimeOptions {
  locale?: string
  /** Intl's width: `long` "3 minutes ago", `short` "3 min. ago", `narrow` "3m ago". */
  style?: Intl.RelativeTimeFormatStyle
  /**
   * Under this many ms either side of now, say "now" instead of counting
   * seconds. Counting seconds is churn nobody reads; a countdown that needs
   * them wants a timer, not this.
   */
  nowWithin?: number
}

export interface RelativeTime {
  text: string
  unit: RelativeUnit
  /** Signed: negative is the past. */
  value: number
  /**
   * Milliseconds until `text` would read differently. A ticker sleeps this
   * long instead of waking every second for a date three weeks away.
   */
  refreshIn: number
}

const formatters = new Map<string, Intl.RelativeTimeFormat>()
function formatterFor(locale: string | undefined, style: Intl.RelativeTimeFormatStyle) {
  const key = `${locale ?? ""}|${style}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style })
    formatters.set(key, f)
  }
  return f
}

/** Never sleep longer than this: a laptop waking from sleep should not show "2 h ago" for an hour. */
const MAX_REFRESH = HOUR
const MIN_REFRESH = SECOND

export function formatRelativeTime(
  date: Date | string | number,
  now: number = Date.now(),
  options: RelativeTimeOptions = {},
): RelativeTime {
  const { locale, style = "long", nowWithin = 45 * SECOND } = options
  const at = toEpoch(date)
  const fmt = formatterFor(locale, style)
  if (!Number.isFinite(at)) return { text: "", unit: "second", value: 0, refreshIn: MAX_REFRESH }

  const diff = at - now
  const abs = Math.abs(diff)

  if (abs < nowWithin) {
    // "now" holds until the date is `nowWithin` away on the far side; a future
    // date crossing into the past stays "now" all the way through.
    const refreshIn = diff >= 0 ? diff + nowWithin : nowWithin - abs
    return { text: fmt.format(0, "second"), unit: "second", value: 0, refreshIn: clampRefresh(refreshIn) }
  }

  const index = SCALE.findIndex((s) => abs < s.until)
  const step = SCALE[index]
  const count = Math.max(1, Math.round(abs / step.ms))
  const value = diff < 0 ? -count : count

  /*
   * The next moment the rounded count changes. In the past the distance only
   * grows, so that is the next half-unit boundary above it; in the future it
   * only shrinks, so the next one below. Crossing into another unit happens on
   * a boundary of the smaller unit, so this also catches "45 min" → "1 hour".
   */
  const units = abs / step.ms
  const boundary = diff < 0 ? (Math.floor(units + 0.5) + 0.5) * step.ms : (Math.ceil(units - 0.5) - 0.5) * step.ms
  // A unit change can also come before the next rounding step: a past date
  // grows into the next unit at this one's `until`, a future one shrinks into
  // the previous unit at that one's.
  const unitChange = diff < 0 ? step.until - abs : index > 0 ? abs - SCALE[index - 1].until : Infinity
  const refreshIn = Math.min(diff < 0 ? boundary - abs : abs - boundary, unitChange)

  return { text: fmt.format(value, step.unit), unit: step.unit, value, refreshIn: clampRefresh(refreshIn) }
}

function clampRefresh(ms: number): number {
  return Math.min(MAX_REFRESH, Math.max(MIN_REFRESH, Math.ceil(ms)))
}
