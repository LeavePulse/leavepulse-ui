import { describe, expect, test } from "bun:test"
import {
  ceilToSecond,
  crossedMilestone,
  formatElapsed,
  formatTime,
  msToNextSecond,
  splitTime,
  timeParts,
  toEpoch,
} from "../src/components/timeSpan"

const S = 1000
const M = 60 * S
const H = 60 * M
const D = 24 * H

describe("splitTime", () => {
  test("splits into calendar-free parts", () => {
    expect(splitTime(2 * D + 3 * H + 4 * M + 5 * S + 6)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5, ms: 6 })
  })
  test("negative and non-finite spans are zero", () => {
    expect(splitTime(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, ms: 0 })
    expect(splitTime(Number.NaN).seconds).toBe(0)
  })
})

describe("formatTime", () => {
  test("auto is a clock under an hour", () => {
    expect(formatTime(42 * S)).toBe("0:42")
    expect(formatTime(9 * M + 5 * S)).toBe("9:05")
    expect(formatTime(59 * M + 59 * S)).toBe("59:59")
  })
  test("auto is two units from an hour up", () => {
    expect(formatTime(H + 5 * S)).toBe("1h")
    expect(formatTime(H + 5 * M)).toBe("1h 5m")
    expect(formatTime(2 * D + 3 * H + 4 * M)).toBe("2d 3h")
  })
  test("the clock grows hours and folds days into them", () => {
    expect(formatTime(H + 2 * M + 3 * S, "clock")).toBe("1:02:03")
    expect(formatTime(D + H, "clock")).toBe("25:00:00")
  })
  test("units drop a zero second place and say zero as 0s", () => {
    expect(formatTime(0, "units")).toBe("0s")
    expect(formatTime(2 * M, "units")).toBe("2m")
    expect(formatTime(72 * S, "units")).toBe("1m 12s")
  })
  test("unit labels and places are the caller's", () => {
    expect(formatTime(2 * D + 3 * H + 4 * M, "units", { d: "j", h: "h", m: "min", s: "s" }, 3)).toBe("2j 3h 4min")
  })
})

describe("timeParts", () => {
  test("clock parts carry padding and separators", () => {
    expect(timeParts(65 * S, "clock")).toEqual([
      { unit: "m", value: 1, pad: 1, after: ":" },
      { unit: "s", value: 5, pad: 2, after: "" },
    ])
  })
})

describe("ceilToSecond", () => {
  test("rounds up so zero means done", () => {
    expect(ceilToSecond(41_200)).toBe(42_000)
    expect(ceilToSecond(42_000)).toBe(42_000)
    expect(ceilToSecond(1)).toBe(1000)
    expect(ceilToSecond(0)).toBe(0)
    expect(ceilToSecond(-3)).toBe(0)
  })
})

describe("formatElapsed", () => {
  test("keeps sub-second jobs apart from instant ones", () => {
    expect(formatElapsed(850)).toBe("850ms")
    expect(formatElapsed(42 * S)).toBe("42s")
    expect(formatElapsed(72 * S)).toBe("1m 12s")
    expect(formatElapsed(H + 3 * M + 9 * S)).toBe("1h 3m")
    expect(formatElapsed(-1)).toBe("")
  })
})

describe("msToNextSecond", () => {
  test("wakes on the boundary where the display changes", () => {
    expect(msToNextSecond(41_200)).toBe(200)
    expect(msToNextSecond(42_000)).toBe(1000)
    expect(msToNextSecond(0)).toBe(1000)
  })
})

describe("crossedMilestone", () => {
  test("reports the mark crossed, smallest when several are", () => {
    expect(crossedMilestone(61 * S, 60 * S)).toBe(60_000)
    expect(crossedMilestone(60 * S, 59 * S)).toBeNull()
    expect(crossedMilestone(11 * M, 9 * S)).toBe(10_000)
  })
  test("ignores time going up (a restart)", () => {
    expect(crossedMilestone(5 * S, 45 * S)).toBeNull()
  })
})

describe("toEpoch", () => {
  test("reads dates, ISO strings and numbers", () => {
    expect(toEpoch(new Date(5))).toBe(5)
    expect(toEpoch(7)).toBe(7)
    expect(toEpoch("1970-01-01T00:00:01Z")).toBe(1000)
    expect(toEpoch(undefined)).toBeNaN()
  })
})
