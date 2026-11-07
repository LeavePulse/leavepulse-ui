import { expect, test } from "bun:test"
import { contextNavItems, DENSITY_CLASS, headerCollapsedAfter, resolveNavMode, type NavBreakpoint } from "../src/components/appShell"

const wide = (...reached: NavBreakpoint[]) => (breakpoint: NavBreakpoint) => reached.includes(breakpoint)
const options = { mobileBreakpoint: "lg" as const, bottomNav: false }

test("below the mobile breakpoint it is the drawer, or the bottom bar when asked for", () => {
  expect(resolveNavMode(wide("sm"), options)).toBe("drawer")
  expect(resolveNavMode(wide("sm"), { ...options, bottomNav: true })).toBe("bottom")
})

test("the rail folds to icons only between the two breakpoints", () => {
  expect(resolveNavMode(wide("sm", "md", "lg"), { ...options, compactBelow: "xl" })).toBe("compact")
  expect(resolveNavMode(wide("sm", "md", "lg", "xl"), { ...options, compactBelow: "xl" })).toBe("rail")
})

test("without compactBelow a wide window is the full rail", () => {
  expect(resolveNavMode(wide("sm", "md", "lg"), options)).toBe("rail")
})

const MAX = 5000

test("the header leaves going down and returns going up", () => {
  expect(headerCollapsedAfter(false, 500, 600, MAX)).toBe(true)
  expect(headerCollapsedAfter(true, 600, 500, MAX)).toBe(false)
})

test("a tremble below the slop changes nothing", () => {
  expect(headerCollapsedAfter(true, 500, 496, MAX)).toBe(true)
  expect(headerCollapsedAfter(false, 500, 504, MAX)).toBe(false)
})

test("at the top of a page the header is always there", () => {
  expect(headerCollapsedAfter(true, 200, 40, MAX)).toBe(false)
  expect(headerCollapsedAfter(false, 0, 40, MAX)).toBe(false)
})

test("at the end of a page the browser's clamp is not a scroll up", () => {
  expect(headerCollapsedAfter(true, 5000, 4960, MAX)).toBe(true)
})

test("sub-pages come from the page in view or from its parent", () => {
  const items = [{ id: "/a", label: "A", children: [{ id: "/a/1", label: "One" }] }, { id: "/b", label: "B" }]
  expect(contextNavItems(items, (item) => item.id === "/a")).toEqual(items[0]!.children!)
  expect(contextNavItems(items, (item) => item.id === "/a/1")).toEqual(items[0]!.children!)
  expect(contextNavItems(items, (item) => item.id === "/b")).toEqual([])
  expect(contextNavItems([], () => true)).toEqual([])
})

test("the unset density is the shell's own padding", () => {
  expect(DENSITY_CLASS.comfortable).toBe("px-4 py-6 md:px-6")
})
