import { expect, test } from "bun:test"
import { calloutLabels, chartSummary, formatTick, markerIndex, normalise, xLabelIndices } from "../src/components/chart"

test("callout labels survive a side with no labels", () => {
  const single = calloutLabels([{ index: 0, mid: 0 }], 100, 100, 50, 16, 14, 17, 200)
  expect(single).toHaveLength(1)
  expect(single[0].side).toBe("right")

  const rightOnly = calloutLabels(
    [
      { index: 0, mid: -0.5 },
      { index: 1, mid: 0.5 },
    ],
    100,
    100,
    50,
    16,
    14,
    17,
    200,
  )
  expect(rightOnly.map((l) => l.side)).toEqual(["right", "right"])
})

test("tick labels roll over to the next unit instead of reading 1000k", () => {
  expect(formatTick(999)).toBe("999")
  expect(formatTick(1200)).toBe("1.2k")
  expect(formatTick(999_999)).toBe("1M")
  expect(formatTick(-999_999)).toBe("-1M")
  expect(formatTick(999_960_000)).toBe("1B")
  expect(formatTick(999.999)).toBe("1k")
  expect(formatTick(2.5e12)).toBe("2.5T")
  expect(formatTick(Number.NaN)).toBe("NaN")
})

test("markers resolve by index or by label", () => {
  expect(markerIndex(2, ["a", "b", "c"], 3)).toBe(2)
  expect(markerIndex(3, ["a", "b", "c"], 3)).toBe(-1)
  expect(markerIndex("b", ["a", "b", "c"], 3)).toBe(1)
  expect(markerIndex("z", ["a", "b", "c"], 3)).toBe(-1)
})

test("summary names the span and each series' range", () => {
  const series = normalise([{ name: "cpu", data: [1, 5, 3] }])
  const text = chartSummary(series, ["Mon", "Tue", "Wed"], (_s, v) => `${v}%`, "Load")
  expect(text).toBe("Load, 3 points, Mon to Wed. cpu: from 1% to 5%, latest 3%")
})

test("x labels keep the last point and drop a neighbour that would touch it", () => {
  expect(xLabelIndices(24, 2)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 23])
  expect(xLabelIndices(25, 2)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24])
  expect(xLabelIndices(10, 4)).toEqual([0, 4, 9])
  expect(xLabelIndices(1, 3)).toEqual([0])
  expect(xLabelIndices(0, 3)).toEqual([])
})
