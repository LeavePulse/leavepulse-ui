import { CalendarDate } from "@internationalized/date"
import { describe, expect, test } from "bun:test"
import {
  clampRange,
  dayAllowed,
  defaultDatePresets,
  defaultRangePresets,
  formatRange,
  normalizeRange,
  reshapeRange,
  sameRange,
} from "../src/components/dateRange"

const labels = { today: "Today", last7: "7", last30: "30", thisMonth: "This", lastMonth: "Last" }

describe("defaultRangePresets", () => {
  const presets = defaultRangePresets(labels, () => new CalendarDate(2026, 3, 5))
  const ranges = Object.fromEntries(presets.map((p) => [p.label, p.range()]))

  test("counts today inside the trailing windows", () => {
    expect(ranges["Today"]).toEqual({ start: "2026-03-05", end: "2026-03-05" })
    expect(ranges["7"]).toEqual({ start: "2026-02-27", end: "2026-03-05" })
    expect(ranges["30"]).toEqual({ start: "2026-02-04", end: "2026-03-05" })
  })

  test("calendar months end on their last day", () => {
    expect(ranges["This"]).toEqual({ start: "2026-03-01", end: "2026-03-31" })
    expect(ranges["Last"]).toEqual({ start: "2026-02-01", end: "2026-02-28" })
  })
})

describe("range helpers", () => {
  test("normalizeRange orders the ends and rejects junk", () => {
    expect(normalizeRange({ start: "2026-05-09", end: "2026-05-01" })).toEqual({ start: "2026-05-01", end: "2026-05-09" })
    expect(normalizeRange({ start: "2026-05-01" })).toBeUndefined()
    expect(normalizeRange({ start: "nope", end: "2026-05-01" })).toBeUndefined()
  })

  test("sameRange ignores order", () => {
    expect(sameRange({ start: "2026-05-09", end: "2026-05-01" }, { start: "2026-05-01", end: "2026-05-09" })).toBe(true)
    expect(sameRange(undefined, { start: "2026-05-01", end: "2026-05-09" })).toBe(false)
  })

  test("clampRange clips to bounds and drops ranges outside them", () => {
    const r = { start: "2026-05-01", end: "2026-05-31" }
    expect(clampRange(r, "2026-05-10")).toEqual({ start: "2026-05-10", end: "2026-05-31" })
    expect(clampRange(r, undefined, "2026-05-20")).toEqual({ start: "2026-05-01", end: "2026-05-20" })
    expect(clampRange(r, "2026-06-01")).toBeUndefined()
  })

  test("formatRange collapses the shared month and year", () => {
    expect(formatRange({ start: "2026-06-03", end: "2026-06-18" }, "en-US")).toBe("Jun 3 – 18, 2026")
  })
})

test("reshapeRange follows the dragged end and flips past the anchor", () => {
  expect(reshapeRange("2026-10-05", "2026-10-12")).toEqual({ start: "2026-10-05", end: "2026-10-12" })
  expect(reshapeRange("2026-10-05", "2026-10-01")).toEqual({ start: "2026-10-01", end: "2026-10-05" })
  expect(reshapeRange("2026-10-05", "2026-10-05")).toEqual({ start: "2026-10-05", end: "2026-10-05" })
})

test("reshapeRange refuses a day that breaks a rule", () => {
  expect(reshapeRange("2026-10-05", "2026-10-20", { maximumDays: 7 })).toBeNull()
  expect(reshapeRange("2026-10-05", "2026-10-11", { maximumDays: 7 })).not.toBeNull()
  expect(reshapeRange("2026-10-05", "2026-10-10", { unavailable: (d) => d === "2026-10-08" })).toBeNull()
  expect(reshapeRange("2026-10-05", "2026-10-10", { allowed: (d) => d < "2026-10-09" })).toBeNull()
})

describe("defaultDatePresets", () => {
  const presets = defaultDatePresets(
    { today: "Today", tomorrow: "Tomorrow", inWeek: "Week" },
    () => new CalendarDate(2026, 2, 26),
  )
  const days = Object.fromEntries(presets.map((p) => [p.label, p.date()]))

  test("steps across a month end", () => {
    expect(days["Today"]).toBe("2026-02-26")
    expect(days["Tomorrow"]).toBe("2026-02-27")
    expect(days["Week"]).toBe("2026-03-05")
  })
})

describe("dayAllowed", () => {
  test("honours bounds inclusively", () => {
    expect(dayAllowed("2026-05-01", { min: "2026-05-01", max: "2026-05-31" })).toBe(true)
    expect(dayAllowed("2026-04-30", { min: "2026-05-01" })).toBe(false)
    expect(dayAllowed("2026-06-01", { max: "2026-05-31" })).toBe(false)
  })

  test("asks both predicates and rejects junk", () => {
    expect(dayAllowed("2026-05-02", { isDisabled: (d) => d === "2026-05-02" })).toBe(false)
    expect(dayAllowed("2026-05-03", { isDateUnavailable: (d) => d === "2026-05-03" })).toBe(false)
    expect(dayAllowed("2026-05-04", { isDisabled: () => false, isDateUnavailable: () => false })).toBe(true)
    expect(dayAllowed("nope")).toBe(false)
  })
})
