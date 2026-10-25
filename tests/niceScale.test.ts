import { describe, expect, test } from "bun:test"
import { fitScale, niceScale } from "../src/components/chart"

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

describe("fitScale", () => {
  test("keeps the interval count and covers the data", () => {
    const s = fitScale(12, 56, 4)
    expect((s.max - s.min) / s.step).toBe(4)
    expect(s.min).toBeLessThanOrEqual(12)
    expect(s.max).toBeGreaterThanOrEqual(56)
  })

  test("leaves a range that already fits alone", () => {
    expect(fitScale(0, 40, 4)).toEqual({ min: 0, max: 40, step: 10 })
  })

  test("gives a flat series a band", () => {
    const s = fitScale(5, 5, 4)
    expect(s.max).toBeGreaterThan(s.min)
  })
})
