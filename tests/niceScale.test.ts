import { describe, expect, test } from "bun:test"
import { niceScale } from "../src/components/chart"

describe("niceScale on a flat series", () => {
  test("all zeros stay non-negative", () => {
    const s = niceScale(0, 0, 4)
    expect(s.min).toBe(0)
    expect(s.max).toBeGreaterThan(0)
  })
  test("a positive flat value keeps a band above zero", () => {
    const s = niceScale(5, 5, 4)
    expect(s.min).toBeGreaterThanOrEqual(0)
    expect(s.max).toBeGreaterThan(5)
  })
  test("a negative flat value stays at or below zero", () => {
    const s = niceScale(-5, -5, 4)
    expect(s.max).toBeLessThanOrEqual(0)
    expect(s.min).toBeLessThan(-5)
  })
})
