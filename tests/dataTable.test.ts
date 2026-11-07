import { expect, test } from "bun:test"
import { compareValues } from "../src/components/tableSort"
import {
  MIN_COLUMN_PX,
  clampColumnWidth,
  groupRows,
  nextSorts,
  orderPinned,
  pinOffsets,
  presetHidden,
  rowWindow,
  sortByKeys,
} from "../src/components/tableFeatures"

test("dates sort by time, not by their string form", () => {
  const days = [new Date(2023, 0, 5), new Date(2023, 0, 1), new Date(2023, 5, 1), new Date(2023, 0, 3)]
  const sorted = [...days].sort(compareValues).map((d) => d.getTime())
  expect(sorted).toEqual([...sorted].sort((a, b) => a - b))
  expect(sorted[0]).toBe(new Date(2023, 0, 1).getTime())
})

test("empty values come first and kinds group together", () => {
  // Array#sort always moves undefined to the end itself, so it is compared directly.
  expect(compareValues(undefined, 0)).toBeLessThan(0)
  const values = ["b", 3, null, true, Number.NaN, 1, "a", false, 10n]
  expect([...values].sort(compareValues)).toEqual([
    null,
    Number.NaN,
    false,
    true,
    1,
    3,
    10n,
    "a",
    "b",
  ])
})

test("text compares numeric runs as numbers", () => {
  expect(["file 10", "file 2", "file 1"].sort(compareValues)).toEqual(["file 1", "file 2", "file 10"])
})

test("several sort keys: the first decides, later ones break its ties, stably", () => {
  const rows = [{ a: 1, b: 2, id: 1 }, { a: 1, b: 1, id: 2 }, { a: 0, b: 9, id: 3 }, { a: 1, b: 1, id: 4 }]
  const columns = [{ key: "a", sortable: true }, { key: "b", sortable: true }]
  const ids = sortByKeys(rows, [{ key: "a", dir: "desc" }, { key: "b", dir: "asc" }], columns).map((r) => r.id)
  expect(ids).toEqual([2, 4, 1, 3])
})

test("a sort key on an unsortable or missing column is skipped, and no keys keep the order", () => {
  const rows = [{ a: 2 }, { a: 1 }]
  expect(sortByKeys(rows, [{ key: "a", dir: "asc" }], [{ key: "a" }])).toEqual(rows)
  expect(sortByKeys(rows, [{ key: "gone", dir: "asc" }], [])).toEqual(rows)
  expect(sortByKeys([], [], [])).toEqual([])
})

test("a column's compare wins over its value", () => {
  const rows = [{ a: "x" }, { a: "yy" }]
  const columns = [{ key: "a", sortable: true, compare: (l: { a: string }, r: { a: string }) => r.a.length - l.a.length }]
  expect(sortByKeys(rows, [{ key: "a", dir: "asc" }], columns)[0]).toEqual({ a: "yy" })
})

test("a click replaces the keys, a Shift-click adds to them, both cycle the column", () => {
  const asc = { key: "a", dir: "asc" as const }
  expect(nextSorts([], "a", false)).toEqual([asc])
  expect(nextSorts([asc], "a", false)).toEqual([{ key: "a", dir: "desc" }])
  expect(nextSorts([{ key: "a", dir: "desc" }], "a", false)).toEqual([])
  expect(nextSorts([asc], "b", false)).toEqual([{ key: "b", dir: "asc" }])
  expect(nextSorts([asc], "b", true)).toEqual([asc, { key: "b", dir: "asc" }])
  expect(nextSorts([asc, { key: "b", dir: "desc" }], "b", true)).toEqual([asc])
})

test("a column width stays within its bounds, and min wins an impossible pair", () => {
  expect(clampColumnWidth(10)).toBe(MIN_COLUMN_PX)
  expect(clampColumnWidth(500, 100, 300)).toBe(300)
  expect(clampColumnWidth(150.4, 100, 300)).toBe(150)
  expect(clampColumnWidth(150, 200, 100)).toBe(200)
})

test("pins go to their edges and stick behind the pins outside them", () => {
  const columns = [{ key: "a", pin: "right" as const }, { key: "b" }, { key: "c", pin: "left" as const }, { key: "d", pin: "left" as const }, { key: "e", pin: "right" as const }]
  const ordered = orderPinned(columns)
  expect(ordered.map((c) => c.key)).toEqual(["c", "d", "b", "a", "e"])
  expect(pinOffsets(ordered, { a: 10, c: 20, d: 30, e: 40 })).toEqual({ c: 0, d: 20, e: 0, a: 40 })
  expect(pinOffsets([{ key: "a" }], {})).toEqual({})
})

test("groups keep the order their rows first appear in", () => {
  const rows = [{ s: "b", n: 1 }, { s: "a", n: 2 }, { s: "b", n: 3 }, { s: null, n: 4 }]
  const groups = groupRows(rows, (row) => row.s)
  expect(groups.map((g) => g.value)).toEqual(["b", "a", null])
  expect(groups[0]!.rows.map((r) => r.n)).toEqual([1, 3])
  expect(groups[2]!.id).toBe("")
  expect(groupRows([], () => 1)).toEqual([])
})

test("the row window covers the viewport plus overscan and accounts for every row", () => {
  expect(rowWindow(0, 100, 10, 1000, 2)).toEqual({ start: 0, end: 12, before: 0, after: 9880 })
  const mid = rowWindow(500, 100, 10, 1000, 2)
  expect(mid).toEqual({ start: 48, end: 62, before: 480, after: 9380 })
  expect(mid.before + (mid.end - mid.start) * 10 + mid.after).toBe(10000)
})

test("the row window survives a scroll past the end, an empty list and a list that fits", () => {
  expect(rowWindow(99999, 100, 10, 50, 0)).toEqual({ start: 40, end: 50, before: 400, after: 0 })
  expect(rowWindow(0, 100, 10, 0, 2)).toEqual({ start: 0, end: 0, before: 0, after: 0 })
  expect(rowWindow(0, 500, 10, 3, 2)).toEqual({ start: 0, end: 3, before: 0, after: 0 })
  expect(rowWindow(0, 100, 0, 7, 2)).toEqual({ start: 0, end: 7, before: 0, after: 0 })
})

test("a preset hides the rest, but never what must stay or every column", () => {
  const columns = [{ key: "a" }, { key: "b" }, { key: "c", alwaysVisible: true }]
  expect([...presetHidden({ columns: ["a"] }, columns)]).toEqual(["b"])
  expect(presetHidden({ columns: ["gone"] }, [{ key: "a" }]).size).toBe(0)
})
