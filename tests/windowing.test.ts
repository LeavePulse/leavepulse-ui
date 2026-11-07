import { expect, test } from "bun:test"
import {
  clampRect,
  dockAt,
  dockedRect,
  isWindowRect,
  resizeRect,
  snapRect,
  useWindowLayer,
} from "../src/composables/windowing"

const view = { width: 1000, height: 800 }
const bounds = { minWidth: 200, minHeight: 100 }
const rect = { x: 100, y: 100, width: 300, height: 200 }

test("a stored rectangle is checked", () => {
  expect(isWindowRect(rect)).toBe(true)
  expect(isWindowRect(null)).toBe(false)
  expect(isWindowRect({ ...rect, x: Number.NaN })).toBe(false)
  expect(isWindowRect({ ...rect, width: 0 })).toBe(false)
  expect(isWindowRect({ x: 1 })).toBe(false)
})

test("clamp keeps a rectangle in the view", () => {
  expect(clampRect({ ...rect, x: -50, y: 900 }, view, bounds)).toEqual({ x: 0, y: 600, width: 300, height: 200 })
})

test("clamp grows to the bounds and shrinks to the view", () => {
  expect(clampRect({ ...rect, width: 10, height: 10 }, view, bounds)).toMatchObject({ width: 200, height: 100 })
  expect(clampRect({ x: 0, y: 0, width: 5000, height: 5000 }, view, bounds)).toEqual({ x: 0, y: 0, ...view })
})

test("clamp in a view smaller than the bounds stays at the origin", () => {
  expect(clampRect(rect, { width: 100, height: 50 }, bounds)).toEqual({ x: 0, y: 0, width: 100, height: 50 })
})

test("snap pulls to view edges within the threshold only", () => {
  expect(snapRect({ ...rect, x: 6 }, view, [], 8).x).toBe(0)
  expect(snapRect({ ...rect, x: 9 }, view, [], 8).x).toBe(9)
  expect(snapRect({ ...rect, x: 695 }, view, [], 8).x).toBe(700)
})

test("snap pulls to another window's edge, the nearest one winning", () => {
  const other = { x: 500, y: 300, width: 100, height: 100 }
  expect(snapRect({ ...rect, x: 605 }, view, [other], 8).x).toBe(600)
  expect(snapRect({ ...rect, x: 197 }, view, [other], 8).x).toBe(200)
  expect(snapRect({ ...rect, y: 403 }, view, [other], 8).y).toBe(400)
})

test("the dock follows the edge the pointer reached", () => {
  expect(dockAt(500, 5, view, 12)).toBe("full")
  expect(dockAt(5, 400, view, 12)).toBe("left")
  expect(dockAt(995, 400, view, 12)).toBe("right")
  expect(dockAt(500, 795, view, 12)).toBe("bottom")
  expect(dockAt(500, 400, view, 12)).toBeNull()
})

test("every dock has its rectangle", () => {
  expect(dockedRect("left", view, 0.5)).toEqual({ x: 0, y: 0, width: 500, height: 800 })
  expect(dockedRect("right", view, 0.25)).toEqual({ x: 750, y: 0, width: 250, height: 800 })
  expect(dockedRect("top", view, 0.5)).toEqual({ x: 0, y: 0, width: 1000, height: 400 })
  expect(dockedRect("bottom", view, 0.5)).toEqual({ x: 0, y: 400, width: 1000, height: 400 })
  expect(dockedRect("full", view, 0.5)).toEqual({ x: 0, y: 0, ...view })
})

test("resizing from the east and south grows toward the view", () => {
  expect(resizeRect(rect, "se", 50, 20, view, bounds)).toEqual({ x: 100, y: 100, width: 350, height: 220 })
  expect(resizeRect(rect, "e", 5000, 0, view, bounds).width).toBe(900)
})

test("resizing from the west and north keeps the far edge", () => {
  const next = resizeRect(rect, "nw", -20, 30, view, bounds)
  expect(next).toEqual({ x: 80, y: 130, width: 320, height: 170 })
  expect(next.x + next.width).toBe(rect.x + rect.width)
})

test("resizing stops at the bounds and the view's origin", () => {
  expect(resizeRect(rect, "w", 5000, 0, view, bounds)).toMatchObject({ x: 200, width: 200 })
  expect(resizeRect(rect, "n", 0, -5000, view, bounds)).toMatchObject({ y: 0, height: 300 })
})

test("raising brings a window to the top; releasing leaves the rest", () => {
  ;(globalThis as { window?: unknown }).window = {}
  const a = useWindowLayer(() => rect)
  const b = useWindowLayer(() => ({ ...rect, x: 500 }))
  a.raise()
  b.raise()
  expect(b.top.value).toBe(true)
  a.raise()
  expect(a.top.value).toBe(true)
  expect(a.others()).toEqual([{ ...rect, x: 500 }])
  a.release()
  expect(b.top.value).toBe(true)
  expect(b.others()).toEqual([])
  b.release()
})

test("a closed window offers nothing to snap to", () => {
  ;(globalThis as { window?: unknown }).window = {}
  const a = useWindowLayer(() => rect)
  const b = useWindowLayer(() => null)
  a.raise()
  b.raise()
  expect(a.others()).toEqual([])
  a.release()
  b.release()
})
