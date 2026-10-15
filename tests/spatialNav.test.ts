import { describe, expect, test } from "bun:test"
import { nextInDirection, type Box } from "../src/composables/spatialNav"

const box = (x: number, y: number, width = 40, height = 40): Box => ({ x, y, width, height })

describe("nextInDirection", () => {
  // A 3x3 grid of 40px buttons with 10px gaps; the centre one is the start.
  const grid = [0, 50, 100].flatMap((y) => [0, 50, 100].map((x) => box(x, y)))
  const centre = grid[4]!

  test("moves to the neighbour in each direction", () => {
    expect(nextInDirection(centre, grid, "right")).toBe(5)
    expect(nextInDirection(centre, grid, "left")).toBe(3)
    expect(nextInDirection(centre, grid, "up")).toBe(1)
    expect(nextInDirection(centre, grid, "down")).toBe(7)
  })

  test("finds nothing past the edge", () => {
    expect(nextInDirection(grid[2]!, grid, "right")).toBe(-1)
    expect(nextInDirection(grid[0]!, grid, "up")).toBe(-1)
  })

  test("prefers the same row over a diagonally nearer box", () => {
    const start = box(0, 0)
    const sameRowFar = box(200, 0)
    const diagonalNear = box(60, 90)
    expect(nextInDirection(start, [diagonalNear, sameRowFar], "right")).toBe(1)
  })

  test("takes a wide box below that overlaps the column", () => {
    const start = box(100, 0)
    const banner = box(0, 60, 400, 80)
    const offside = box(500, 50)
    expect(nextInDirection(start, [offside, banner], "down")).toBe(1)
  })

  test("never moves sideways-only or backwards", () => {
    const start = box(0, 0)
    const overlappingRight = box(20, 0)
    expect(nextInDirection(start, [overlappingRight], "right")).toBe(-1)
  })
})
