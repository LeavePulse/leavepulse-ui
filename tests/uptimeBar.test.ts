import { describe, expect, test } from "bun:test"
import { uptimeFigure, uptimeRange, uptimeShare } from "../src/components/uptimeBar"

const MIN = 60_000

describe("uptimeShare", () => {
  test("counts slices when they carry nothing else", () => {
    expect(uptimeShare([{ status: "operational" }, { status: "down" }, { status: "empty" }])).toBe(50)
  })

  test("counts real time when slices carry durations", () => {
    const day = { status: "down" as const, durations: { operational: 1439 * MIN, down: MIN } }
    const share = uptimeShare([day, { status: "operational", durations: { operational: 1440 * MIN } }])!
    expect(share).toBeCloseTo((2879 / 2880) * 100, 6)
  })

  test("weights slices by their span", () => {
    const share = uptimeShare([
      { status: "operational", start: 0, end: 3 * MIN },
      { status: "down", start: 3 * MIN, end: 4 * MIN },
    ])
    expect(share).toBe(75)
  })

  test("planned maintenance counts as up, and nothing tracked is null", () => {
    expect(uptimeShare([{ status: "maintenance" }, { status: "operational" }])).toBe(100)
    expect(uptimeShare([{ status: "empty" }])).toBeNull()
  })
})

describe("uptimeFigure", () => {
  test("trims trailing zeros", () => {
    expect(uptimeFigure(100)).toEqual({ value: 100, decimals: 0 })
    expect(uptimeFigure(99.9)).toEqual({ value: 99.9, decimals: 1 })
  })

  test("never rounds an outage up to 100", () => {
    expect(uptimeFigure(99.9995)).toEqual({ value: 99.99, decimals: 2 })
  })
})

describe("uptimeRange", () => {
  test("writes the date once for a span inside one day", () => {
    const start = new Date(2026, 9, 26, 12, 0)
    const end = new Date(2026, 9, 26, 12, 15)
    expect(uptimeRange(start, end, "en-GB")).toBe("26 Oct, 12:00 – 12:15")
  })
})
