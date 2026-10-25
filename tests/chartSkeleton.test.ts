import { describe, expect, test } from "bun:test"
import { sampleValues, skeletonHeights, skeletonWave } from "../src/components/chartSkeleton"

describe("skeletonHeights", () => {
  test("is stable from one call to the next", () => {
    expect(skeletonHeights(8)).toEqual(skeletonHeights(8))
  })

  test("returns the count asked for, at least one, within the plot", () => {
    expect(skeletonHeights(20)).toHaveLength(20)
    expect(skeletonHeights(0)).toHaveLength(1)
    for (const h of skeletonHeights(30)) {
      expect(h).toBeGreaterThan(0)
      expect(h).toBeLessThanOrEqual(1)
    }
  })

  test("is uneven, so it does not read as stripes", () => {
    expect(new Set(skeletonHeights(6)).size).toBeGreaterThan(1)
  })
})

describe("skeletonWave", () => {
  test("spans the whole box edge to edge", () => {
    const d = skeletonWave([0.5, 0.8])
    expect(d.startsWith("M0 50")).toBe(true)
    expect(d.endsWith("L100 20")).toBe(true)
  })

  test("draws one curve per step between points", () => {
    expect(skeletonWave(skeletonHeights(5)).match(/C/g)).toHaveLength(4)
  })

  test("is empty without heights", () => {
    expect(skeletonWave([])).toBe("")
  })
})

describe("sampleValues", () => {
  test("is stable, so a sample never looks like data changing", () => {
    expect(sampleValues(12, 1)).toEqual(sampleValues(12, 1))
  })

  test("gives each series its own line", () => {
    expect(sampleValues(12, 0)).not.toEqual(sampleValues(12, 1))
  })

  test("draws at least a segment", () => {
    expect(sampleValues(0)).toHaveLength(2)
  })
})
