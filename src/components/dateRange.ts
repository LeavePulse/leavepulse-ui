import {
  type CalendarDate,
  endOfMonth,
  getLocalTimeZone,
  parseDate,
  startOfMonth,
  today,
} from "@internationalized/date"

/*
 * Date ranges as the kit models them: two ISO "YYYY-MM-DD" strings, inclusive
 * on both ends, the same shape LpDatePicker uses for a single day. Presets are
 * plain functions so a consumer can add "This quarter" or "Year to date"
 * without the kit knowing about it.
 */
export interface DateRange {
  start: string
  end: string
}

export interface DateRangePreset {
  label: string
  range: () => DateRange
}

export interface DateRangePresetLabels {
  today: string
  last7: string
  last30: string
  thisMonth: string
  lastMonth: string
}

function span(start: CalendarDate, end: CalendarDate): DateRange {
  return { start: start.toString(), end: end.toString() }
}

/** The default preset list. `now` is injectable so the set can be tested. */
export function defaultRangePresets(
  labels: DateRangePresetLabels,
  now: () => CalendarDate = () => today(getLocalTimeZone()),
): DateRangePreset[] {
  return [
    { label: labels.today, range: () => span(now(), now()) },
    { label: labels.last7, range: () => span(now().subtract({ days: 6 }), now()) },
    { label: labels.last30, range: () => span(now().subtract({ days: 29 }), now()) },
    { label: labels.thisMonth, range: () => span(startOfMonth(now()), endOfMonth(now())) },
    {
      label: labels.lastMonth,
      range: () => {
        const previous = now().subtract({ months: 1 })
        return span(startOfMonth(previous), endOfMonth(previous))
      },
    },
  ]
}

export function parseIsoDay(iso: string | undefined): CalendarDate | undefined {
  if (!iso) return undefined
  try {
    return parseDate(iso.slice(0, 10))
  } catch {
    return undefined
  }
}

/** A range with both ends parsed and in order, or undefined. */
export function normalizeRange(range: Partial<DateRange> | undefined): DateRange | undefined {
  const start = parseIsoDay(range?.start)
  const end = parseIsoDay(range?.end)
  if (!start || !end) return undefined
  return start.compare(end) <= 0 ? span(start, end) : span(end, start)
}

export function sameRange(a: Partial<DateRange> | undefined, b: Partial<DateRange> | undefined): boolean {
  const x = normalizeRange(a)
  const y = normalizeRange(b)
  return !!x && !!y && x.start === y.start && x.end === y.end
}

/** Clip a preset to the allowed bounds; undefined when nothing of it is left. */
export function clampRange(range: DateRange, min?: string, max?: string): DateRange | undefined {
  const r = normalizeRange(range)
  if (!r) return undefined
  const start = min && r.start < min ? min : r.start
  const end = max && r.end > max ? max : r.end
  return start <= end ? { start, end } : undefined
}

/**
 * "Jun 3 – 18, 2026" style text: Intl's own range formatting collapses the
 * shared month and year, which is how a range reads naturally in every locale.
 */
export function formatRange(
  range: DateRange,
  locale?: string,
  format: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const start = parseIsoDay(range.start)
  const end = parseIsoDay(range.end)
  if (!start || !end) return ""
  const zone = "UTC"
  const fmt = new Intl.DateTimeFormat(locale, { ...format, timeZone: zone })
  return fmt.formatRange(start.toDate(zone), end.toDate(zone))
}

export interface ReshapeRules {
  /** Whether the moving end may land on this day (min, max, disabled). */
  allowed?: (iso: string) => boolean
  /** Days a range may not include. */
  unavailable?: (iso: string) => boolean
  /** Longest range, in days, counting both ends. */
  maximumDays?: number
}

/**
 * The range one end makes when it is dragged to `moving` while the other stays
 * at `anchor`; passing the anchor flips which end is which. Null when the result
 * would break a rule, so a drag simply does not follow onto that day.
 */
export function reshapeRange(anchor: string, moving: string, rules: ReshapeRules = {}): DateRange | null {
  const a = parseIsoDay(anchor)
  const m = parseIsoDay(moving)
  if (!a || !m) return null
  if (rules.allowed && !rules.allowed(m.toString())) return null
  const [start, end] = a.compare(m) <= 0 ? [a, m] : [m, a]
  if (rules.maximumDays && end.compare(start) + 1 > rules.maximumDays) return null
  if (rules.unavailable) {
    for (let d = start; d.compare(end) <= 0; d = d.add({ days: 1 })) {
      if (rules.unavailable(d.toString())) return null
    }
  }
  return { start: start.toString(), end: end.toString() }
}
