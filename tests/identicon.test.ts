import { describe, expect, test } from "bun:test"
import { hashString, identicon, identiconRects, identiconSvg } from "../src/components/identicon"

describe("identicon", () => {
  test("the same seed gives the same picture", () => {
    expect(identicon("ada@example.com")).toEqual(identicon("ada@example.com"))
    expect(identiconSvg("ada")).toBe(identiconSvg("ada"))
    // Pinned, so a change to the hash (which would re-face every user) shows up here.
    expect(hashString("ada")).toBe(943263163)
    expect(hashString("")).toBe(0x811c9dc5)
  })

  test("neighbouring seeds differ", () => {
    const a = identicon("user-1")
    const b = identicon("user-2")
    expect(a.cells).not.toEqual(b.cells)
  })

  test("grid is mirrored and sized", () => {
    for (const grid of [5, 6, 7]) {
      const { cells } = identicon("mirror", { grid })
      expect(cells.length).toBe(grid)
      for (const row of cells) {
        expect(row.length).toBe(grid)
        expect(row).toEqual([...row].reverse())
      }
    }
  })

  test("never empty, never solid", () => {
    for (let i = 0; i < 300; i++) {
      const { cells } = identicon(`seed-${i}`)
      const half = cells.flatMap((row) => row.slice(0, 3))
      const on = half.filter(Boolean).length
      expect(on).toBeGreaterThanOrEqual(5)
      expect(on).toBeLessThanOrEqual(10)
    }
  })

  test("colour stays inside the readable band", () => {
    for (let i = 0; i < 100; i++) {
      const m = identicon(`c${i}`).color.match(/^hsl\((\d+) (\d+)% (\d+)%\)$/)
      expect(m).not.toBeNull()
      const [, h, s, l] = m!.map(Number)
      expect(h).toBeLessThan(360)
      expect(s).toBeGreaterThanOrEqual(55)
      expect(s).toBeLessThanOrEqual(72)
      expect(l).toBeGreaterThanOrEqual(48)
      expect(l).toBeLessThanOrEqual(60)
    }
  })

  test("rects cover exactly the filled cells", () => {
    const { cells } = identicon("rects", { grid: 7 })
    const covered = cells.map((row) => row.map(() => false))
    for (const r of identiconRects(cells)) for (let x = r.x; x < r.x + r.w; x++) covered[r.y][x] = true
    expect(covered).toEqual(cells)
  })

  test("svg carries size and background", () => {
    const svg = identiconSvg("x", { size: 32, background: "#fff" })
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain('width="32"')
    expect(svg).toContain('fill="#fff"')
  })
})
