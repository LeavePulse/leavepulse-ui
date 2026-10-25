import { describe, expect, test } from "bun:test"
import { dockSize, magneticOffset } from "../src/components/dock"
import { masonryColumnCount, placeMasonry } from "../src/components/masonry"
import { revealFrom, revealTo, staggerDelay } from "../src/components/reveal"
import { spotlightPoint } from "../src/composables/useSpotlight"

describe("dockSize", () => {
  test("peaks under the pointer and rests beyond reach", () => {
    expect(dockSize(40, 70, 0, 100)).toBe(70)
    expect(dockSize(40, 70, 100, 100)).toBe(40)
    expect(dockSize(40, 70, -250, 100)).toBe(40)
  })
  test("falls off symmetrically and monotonically", () => {
    expect(dockSize(40, 70, 30, 100)).toBeCloseTo(dockSize(40, 70, -30, 100))
    expect(dockSize(40, 70, 20, 100)).toBeGreaterThan(dockSize(40, 70, 60, 100))
    expect(dockSize(40, 70, 50, 100)).toBeCloseTo(55)
  })
})

describe("magneticOffset", () => {
  test("pulls toward the pointer inside the field only", () => {
    expect(magneticOffset(200, 0, 100, 0.3)).toEqual({ x: 0, y: 0 })
    const near = magneticOffset(20, -10, 100, 0.3)
    expect(near.x).toBeGreaterThan(0)
    expect(near.y).toBeLessThan(0)
  })
  test("fades out toward the edge", () => {
    expect(Math.abs(magneticOffset(95, 0, 100, 0.3).x)).toBeLessThan(2)
  })
})

describe("masonryColumnCount", () => {
  test("derives from min width and gap, capped", () => {
    expect(masonryColumnCount(1000, { minColumnWidth: 240, gap: 16 })).toBe(3)
    expect(masonryColumnCount(1040, { minColumnWidth: 240, gap: 16 })).toBe(4)
    expect(masonryColumnCount(1040, { minColumnWidth: 240, gap: 16, maxColumns: 2 })).toBe(2)
    expect(masonryColumnCount(100, { minColumnWidth: 240, gap: 16 })).toBe(1)
  })
  test("fixed count and breakpoint table", () => {
    expect(masonryColumnCount(300, { columns: 4, minColumnWidth: 240, gap: 16 })).toBe(4)
    const columns = { 0: 1, 480: 2, 900: 3 }
    expect(masonryColumnCount(300, { columns, minColumnWidth: 240, gap: 16 })).toBe(1)
    expect(masonryColumnCount(480, { columns, minColumnWidth: 240, gap: 16 })).toBe(2)
    expect(masonryColumnCount(2000, { columns, minColumnWidth: 240, gap: 16 })).toBe(3)
  })
})

describe("placeMasonry", () => {
  test("shortest column first, leftmost on ties, in order", () => {
    const p = placeMasonry([100, 50, 80, 30], 2, 210, 10)
    expect(p.columnWidth).toBe(100)
    expect(p.column).toEqual([0, 1, 1, 0])
    expect(p.x).toEqual([0, 110, 110, 0])
    expect(p.y).toEqual([0, 0, 60, 110])
    expect(p.height).toBe(140)
  })
  test("appending leaves earlier items in place", () => {
    const before = placeMasonry([100, 50, 80], 3, 320, 10)
    const after = placeMasonry([100, 50, 80, 40], 3, 320, 10)
    expect(after.x.slice(0, 3)).toEqual(before.x)
    expect(after.y.slice(0, 3)).toEqual(before.y)
  })
  test("empty list has no height", () => {
    expect(placeMasonry([], 3, 300, 10).height).toBe(0)
  })
})

describe("reveal", () => {
  test("presets describe a hidden start and a matching rest", () => {
    const rise = revealFrom("rise", "up", 16)
    expect(rise).toEqual({ opacity: 0, transform: "translate3d(0, 16px, 0)" })
    expect(revealTo(rise)).toEqual({ opacity: 1, transform: "none" })
    expect(revealFrom("rise", "right", 10).transform).toBe("translate3d(-10px, 0, 0)")
    expect(revealTo(revealFrom("blur", "up", 16))).toEqual({ opacity: 1, transform: "none", filter: "blur(0px)" })
    expect(revealTo(revealFrom("fade", "up", 16))).toEqual({ opacity: 1 })
  })
  test("stagger steps stop growing at the cap", () => {
    expect(staggerDelay(0, 100, 50)).toBe(100)
    expect(staggerDelay(3, 100, 50)).toBe(250)
    expect(staggerDelay(40, 0, 50, 10)).toBe(500)
  })
})

test("spotlightPoint is relative to the rect", () => {
  expect(spotlightPoint({ left: 10, top: 20 }, 60.4, 70.6)).toEqual({ x: "50px", y: "51px" })
})
