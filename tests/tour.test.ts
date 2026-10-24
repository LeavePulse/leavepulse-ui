import { describe, expect, test } from "bun:test"
import { holeOf, panelsAround } from "../src/components/tour"

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
