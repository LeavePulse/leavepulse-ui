import { expect, test } from "bun:test"
import {
  MIN_RANGE_POINTS,
  chartView,
  clampRange,
  lttbIndices,
  minMaxBuckets,
  panRange,
  slotOf,
  sourceOf,
  zoomRange,
} from "../src/components/chartWindow"

const wave = (count: number) => Array.from({ length: count }, (_, i) => Math.sin(i / 10) * 10)

test("a range is held to the data, ordered and at least two points wide", () => {
  expect(clampRange({ start: -5, end: 3 }, 10)).toEqual({ start: 0, end: 3 })
  expect(clampRange({ start: 8, end: 2 }, 10)).toEqual({ start: 2, end: 8 })
  expect(clampRange({ start: 4, end: 4 }, 10)).toEqual({ start: 4, end: 5 })
  expect(clampRange({ start: 9, end: 9 }, 10)).toEqual({ start: 8, end: 9 })
})

test("a range that narrows nothing is no range", () => {
  expect(clampRange(null, 10)).toBeNull()
  expect(clampRange({ start: 0, end: 9 }, 10)).toBeNull()
  expect(clampRange({ start: 0, end: 5 }, 0)).toBeNull()
  expect(clampRange({ start: Number.NaN, end: 5 }, 10)).toBeNull()
})

test("a zoom keeps its anchor and stops at the narrowest window", () => {
  const zoomed = zoomRange(null, 101, 0.5, 0.5)!
  expect((zoomed.start + zoomed.end) / 2).toBeCloseTo(50, 0)
  expect(zoomed.end - zoomed.start).toBe(50)
  let range = zoomed
  for (let i = 0; i < 40; i++) range = zoomRange(range, 101, 0.5, 0.5) ?? range
  expect(range.end - range.start + 1).toBe(MIN_RANGE_POINTS)
})

test("zooming all the way out is the whole series again", () => {
  expect(zoomRange({ start: 40, end: 60 }, 101, 0.5, 100)).toBeNull()
})

test("a pan keeps the width at the ends of the data", () => {
  expect(panRange({ start: 10, end: 20 }, 100, -50)).toEqual({ start: 0, end: 10 })
  expect(panRange({ start: 10, end: 20 }, 100, 500)).toEqual({ start: 89, end: 99 })
})

test("min/max keeps every extreme, a one-point spike included", () => {
  const data = wave(10_000)
  data[6_123] = 500
  data[2_222] = -500
  const { values, indices } = minMaxBuckets([data], 200)
  expect(values[0]).toHaveLength(200)
  expect(indices).toHaveLength(200)
  expect(Math.max(...(values[0] as number[]))).toBe(500)
  expect(Math.min(...(values[0] as number[]))).toBe(-500)
})

test("min/max keeps a bucket's extremes in the order they came", () => {
  const { values } = minMaxBuckets([[9, 1, 5, 2, 8, 3]], 2)
  expect(values[0]).toEqual([9, 1])
})

test("min/max keeps each series' own peak in shared slots", () => {
  const a = [1, 9, 1, 1, 1, 1]
  const b = [1, 1, 1, 1, 7, 1]
  const { values } = minMaxBuckets([a, b], 2)
  expect(Math.max(...(values[0] as number[]))).toBe(9)
  expect(Math.max(...(values[1] as number[]))).toBe(7)
})

test("min/max leaves a gap where a bucket has no reading", () => {
  const { values } = minMaxBuckets([[null, null, 1, 2]], 4)
  expect(values[0]).toEqual([null, null, 1, 2])
})

test("min/max takes empty input", () => {
  expect(minMaxBuckets([], 10)).toEqual({ values: [], indices: [] })
  expect(minMaxBuckets([[]], 10)).toEqual({ values: [[]], indices: [] })
  expect(minMaxBuckets([[1, 2]], 0)).toEqual({ values: [[]], indices: [] })
})

test("lttb keeps both ends, the asked count and ascending indices", () => {
  const picked = lttbIndices(wave(1_000), 50)
  expect(picked).toHaveLength(50)
  expect(picked[0]).toBe(0)
  expect(picked.at(-1)).toBe(999)
  expect(picked.every((v, i) => i === 0 || v > picked[i - 1])).toBe(true)
})

test("lttb keeps a pronounced peak of a line", () => {
  const data = Array.from({ length: 1_000 }, () => 0)
  data[500] = 100
  expect(lttbIndices(data, 20)).toContain(500)
})

test("lttb skips gaps and takes short or empty input", () => {
  expect(lttbIndices([], 10)).toEqual([])
  expect(lttbIndices([null, null], 10)).toEqual([])
  expect(lttbIndices([1, null, 3], 10)).toEqual([0, 2])
  expect(lttbIndices([1, 2, 3, 4], 2)).toEqual([0, 1, 2, 3])
})

test("no range and no thinning hands the same arrays back", () => {
  const series = [[1, 2, 3]]
  const view = chartView(series, 3, null, false, 100)
  expect(view.values).toBe(series)
  expect(view.indices).toBeNull()
})

test("thinning waits until the series outgrows the slots, and for a measured width", () => {
  expect(chartView([wave(100)], 100, null, "minmax", 100).indices).toBeNull()
  expect(chartView([wave(100)], 100, null, "minmax", 0).indices).toBeNull()
})

test("the window comes first: slots trace back to the data", () => {
  const data = Array.from({ length: 1_000 }, (_, i) => i)
  const view = chartView([data], 1_000, { start: 100, end: 899 }, "minmax", 100)
  expect(view.values[0]).toHaveLength(100)
  expect(sourceOf(view, 0)).toBe(100)
  expect(sourceOf(view, 99)).toBe(899)
  expect(slotOf(view, 50)).toBe(-1)
  expect(slotOf(view, 950)).toBe(-1)
  expect(sourceOf(view, slotOf(view, 500))).toBeLessThanOrEqual(500)
})

test("a plain window maps by offset", () => {
  const view = chartView([[1, 2, 3, 4, 5]], 5, { start: 1, end: 3 }, false, 100)
  expect(view.values).toEqual([[2, 3, 4]])
  expect(slotOf(view, 2)).toBe(1)
  expect(sourceOf(view, 2)).toBe(3)
})

test("lttb shares its picks across series", () => {
  const view = chartView([wave(1_000), wave(1_000).map((v) => v * 2)], 1_000, null, "lttb", 50)
  expect(view.values[0]).toHaveLength(50)
  expect(view.values[1]).toHaveLength(50)
  expect(view.values[1][10]).toBe((view.values[0][10] as number) * 2)
})
