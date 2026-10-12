import { CalendarDate } from "@internationalized/date"
import { describe, expect, test } from "bun:test"
import { clampRange, defaultRangePresets, formatRange, normalizeRange, sameRange } from "../src/components/dateRange"

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
