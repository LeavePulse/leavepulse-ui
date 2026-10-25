import { describe, expect, test } from "bun:test"
import { holeClip, holeOf, panelsAround } from "../src/components/tour"

const viewport = { width: 1000, height: 800 }

describe("holeOf", () => {
  test("pads the target", () => {
    expect(holeOf({ x: 100, y: 100, width: 50, height: 20 }, 6, viewport)).toEqual({ x: 94, y: 94, width: 62, height: 32 })
  })

  test("clips to the viewport so a tall target keeps the panels on screen", () => {
    expect(holeOf({ x: -20, y: 700, width: 100, height: 400 }, 6, viewport)).toEqual({ x: 0, y: 694, width: 86, height: 106 })
  })
})

describe("panelsAround", () => {
  test("four panels cover everything but the hole", () => {
    const hole = { x: 100, y: 200, width: 300, height: 100 }
    const panels = panelsAround(hole, viewport)
    const covered = panels.reduce((sum, p) => sum + p.width * p.height, 0)
    expect(covered + hole.width * hole.height).toBe(viewport.width * viewport.height)
    expect(panels[0]).toEqual({ x: 0, y: 0, width: 1000, height: 200 })
    expect(panels[3]).toEqual({ x: 400, y: 200, width: 600, height: 100 })
  })

  test("a hole at the edge leaves empty panels, never negative ones", () => {
    const panels = panelsAround({ x: 0, y: 0, width: 1000, height: 800 }, viewport)
    expect(panels.every((p) => p.width >= 0 && p.height >= 0)).toBe(true)
  })
})

describe("holeClip", () => {
  const viewport = { width: 800, height: 600 }
  const count = (clip: string) => clip.split(",").length

  test("cuts the hole out of the whole viewport with evenodd", () => {
    const clip = holeClip({ x: 100, y: 50, width: 200, height: 80 }, viewport, 8)
    expect(clip.startsWith("polygon(evenodd, 0px 0px, 800px 0px, 800px 600px, 0px 600px, 0px 0px")).toBe(true)
    expect(clip).toContain("292px 50px")
  })

  test("keeps the same point count with or without a target, so it can ease", () => {
    expect(count(holeClip(null, viewport, 8))).toBe(count(holeClip({ x: 1, y: 1, width: 10, height: 10 }, viewport, 8)))
  })

  test("never rounds a corner past half of a small hole", () => {
    expect(holeClip({ x: 0, y: 0, width: 4, height: 4 }, viewport, 8)).toContain("4px 2px")
  })
})
