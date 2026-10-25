import { describe, expect, test } from "bun:test"
import { arcPath, capacityThresholds, meterFraction, polar, toneAt } from "../src/components/meter"
import { formatAmount, quotaSegments, quotaState } from "../src/components/quota"
import { formatRelativeTime } from "../src/components/relativeTime"

describe("meterFraction", () => {
  test("maps a value into its range", () => {
    expect(meterFraction(50, 0, 200)).toBe(0.25)
    expect(meterFraction(15, 10, 20)).toBe(0.5)
  })
  test("clamps outside the range", () => {
    expect(meterFraction(-5, 0, 10)).toBe(0)
    expect(meterFraction(50, 0, 10)).toBe(1)
  })
  test("an empty or inverted range reads as empty, not NaN", () => {
    expect(meterFraction(5, 0, 0)).toBe(0)
    expect(meterFraction(5, 10, 0)).toBe(0)
    expect(meterFraction(Number.NaN, 0, 10)).toBe(0)
  })
})

describe("toneAt", () => {
  test("capacity scale: ok, warning from 80%, danger from 90%", () => {
    const steps = capacityThresholds(0, 100)
    expect(toneAt(50, steps)).toBe("ok")
    expect(toneAt(80, steps)).toBe("warning")
    expect(toneAt(95, steps)).toBe("danger")
  })
  test("steps may rise toward ok and come in any order", () => {
    const score = [
      { at: 80, tone: "ok" as const },
      { at: 0, tone: "danger" as const },
      { at: 50, tone: "warning" as const },
    ]
    expect(toneAt(10, score)).toBe("danger")
    expect(toneAt(60, score)).toBe("warning")
    expect(toneAt(90, score)).toBe("ok")
  })
})

describe("arc geometry", () => {
  test("angles run clockwise from twelve o'clock", () => {
    const top = polar(50, 50, 10, 0)
    expect(top.x).toBeCloseTo(50)
    expect(top.y).toBeCloseTo(40)
    const right = polar(50, 50, 10, 90)
    expect(right.x).toBeCloseTo(60)
    expect(right.y).toBeCloseTo(50)
  })
  test("a sweep past 180 degrees takes the large arc", () => {
    expect(arcPath(50, 50, 10, -90, 90)).toContain(" 0 0 1 ")
    expect(arcPath(50, 50, 10, -135, 135)).toContain(" 0 1 1 ")
  })
})

describe("quotaState", () => {
  test("within the limit", () => {
    const s = quotaState(30, 100)
    expect(s).toMatchObject({ ratio: 0.3, remaining: 70, over: 0, limited: true, tone: "ok" })
  })
  test("tone rises toward the limit", () => {
    expect(quotaState(85, 100).tone).toBe("warning")
    expect(quotaState(97, 100).tone).toBe("danger")
  })
  test("over the limit is danger whatever the thresholds", () => {
    const s = quotaState(120, 100, 2, 3)
    expect(s.tone).toBe("danger")
    expect(s.over).toBe(20)
    expect(s.remaining).toBe(0)
  })
  test("no limit is unlimited, not divided by zero", () => {
    for (const limit of [null, undefined, 0, Infinity]) {
      const s = quotaState(5, limit)
      expect(s.limited).toBe(false)
      expect(s.tone).toBe("ok")
    }
  })
})

describe("quotaSegments", () => {
  test("within the limit, shares are of the limit", () => {
    const { segments, limitAt } = quotaSegments([{ label: "a", value: 25 }, { label: "b", value: 25 }], 100)
    expect(segments.map((s) => s.share)).toEqual([0.25, 0.25])
    expect(limitAt).toBeNull()
  })
  test("over the limit, the bar holds everything and marks the limit", () => {
    const { segments, limitAt } = quotaSegments([{ label: "a", value: 60 }, { label: "b", value: 60 }], 100)
    expect(segments.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1)
    expect(limitAt).toBeCloseTo(100 / 120)
  })
  test("parts without a colour never take danger", () => {
    const parts = Array.from({ length: 8 }, (_, i) => ({ label: `p${i}`, value: 1 }))
    for (const s of quotaSegments(parts, 100).segments) expect(s.color).not.toContain("danger")
  })
})

describe("formatAmount", () => {
  test("bytes scale in binary steps", () => {
    expect(formatAmount(512, "bytes", "en")).toBe("512\u00a0B")
    expect(formatAmount(1536, "bytes", "en")).toBe("1.5\u00a0kB")
    expect(formatAmount(10 * 1024 ** 3, "bytes", "en")).toBe("10\u00a0GB")
  })
  test("a string unit is a suffix, a function is used as is", () => {
    expect(formatAmount(3, "seats", "en")).toBe("3 seats")
    expect(formatAmount(3, (v) => `${v}/8`)).toBe("3/8")
  })
})

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0)
  const en = { locale: "en" }

  test("close to now is 'now'", () => {
    expect(formatRelativeTime(now - 10_000, now, en).text).toBe("now")
    expect(formatRelativeTime(now + 10_000, now, en).text).toBe("now")
  })
  test("past and future in fitting units", () => {
    expect(formatRelativeTime(now - 3 * 60_000, now, en).text).toBe("3 minutes ago")
    expect(formatRelativeTime(now + 2 * 3_600_000, now, en).text).toBe("in 2 hours")
    expect(formatRelativeTime(now - 50 * 60_000, now, en).text).toBe("1 hour ago")
    expect(formatRelativeTime(now - 24 * 3_600_000, now, en).text).toBe("yesterday")
    expect(formatRelativeTime(now - 400 * 86_400_000, now, en).text).toBe("last year")
  })
  test("follows the locale", () => {
    expect(formatRelativeTime(now - 3 * 60_000, now, { locale: "ru" }).text).toBe("3 минуты назад")
    expect(formatRelativeTime(now - 3 * 60_000, now, { locale: "en", style: "short" }).text).toBe("3 min. ago")
  })
  test("accepts ISO strings and Dates", () => {
    const iso = new Date(now - 3 * 60_000).toISOString()
    expect(formatRelativeTime(iso, now, en).text).toBe("3 minutes ago")
    expect(formatRelativeTime(new Date(iso), now, en).value).toBe(-3)
  })
  test("refreshIn is when the text next changes", () => {
    // 3 min ago changes to 4 at 3.5 min: 30 s from now.
    const r = formatRelativeTime(now - 3 * 60_000, now, en)
    expect(r.refreshIn).toBe(30_000)
    const later = formatRelativeTime(now - 3 * 60_000, now + r.refreshIn, en)
    expect(later.text).toBe("4 minutes ago")
  })
  test("a future date wakes when it crosses into a smaller unit", () => {
    // In 50 minutes reads "in 1 hour" and becomes "in 45 minutes" 5 min from now.
    const r = formatRelativeTime(now + 50 * 60_000, now, en)
    expect(r.text).toBe("in 1 hour")
    expect(r.refreshIn).toBe(5 * 60_000)
  })
  test("far dates sleep at most an hour, near ones at least a second", () => {
    expect(formatRelativeTime(now - 90 * 86_400_000, now, en).refreshIn).toBe(3_600_000)
    expect(formatRelativeTime(now - 44_999, now, en).refreshIn).toBeGreaterThanOrEqual(1000)
  })
  test("an invalid date yields no text", () => {
    expect(formatRelativeTime("not a date", now, en).text).toBe("")
  })
})
