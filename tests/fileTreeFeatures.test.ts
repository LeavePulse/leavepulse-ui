import { expect, test } from "bun:test"
import {
  canDrop,
  fileExtension,
  filterTree,
  flattenVisible,
  isFilterEmpty,
  nodeTrail,
  rangeIds,
  renameProblem,
  renameSelectionEnd,
  rowWindow,
  topmostIds,
  withLoadedChildren,
  type FileNode,
  type FileTreeFilter,
} from "../src/components/fileTree"

const sample: FileNode[] = [
  {
    id: "src",
    name: "src",
    kind: "dir",
    children: [
      { id: "src/a.ts", name: "a.ts", kind: "file", size: 100, modified: 1000 },
      { id: "src/b.png", name: "b.png", kind: "file", size: 5000, modified: 3000 },
      { id: "src/lazy", name: "lazy", kind: "dir" },
    ],
  },
  { id: "README.md", name: "README.md", kind: "file", size: 10 },
  { id: "empty", name: "empty", kind: "dir", children: [] },
]

test("an empty filter returns the tree untouched", () => {
  expect(isFilterEmpty({ query: "  " })).toBe(true)
  expect(filterTree(sample, { query: " " }).nodes).toBe(sample)
  expect(filterTree(sample, undefined).openIds.size).toBe(0)
  expect(filterTree([], { query: "x" }).nodes).toEqual([])
})

test("a search keeps the matches and the folders leading to them, open", () => {
  const { nodes, openIds } = filterTree(sample, { query: "A.TS" })
  expect(nodes.map((n) => n.id)).toEqual(["src"])
  expect(nodes[0].children?.map((n) => n.id)).toEqual(["src/a.ts"])
  expect([...openIds]).toEqual(["src"])
  expect(sample[0].children).toHaveLength(3)
})

test("a search reads the path as well as the name", () => {
  expect(filterTree(sample, { query: "src/b" }).nodes[0].children?.map((n) => n.id)).toEqual(["src/b.png"])
})

test("a folder that matches by itself stays, and an unloaded one stays unloaded", () => {
  const found = filterTree(sample, { query: "lazy" }).nodes[0].children
  expect(found?.map((n) => n.id)).toEqual(["src/lazy"])
  expect(found?.[0].children).toBeUndefined()
  expect(filterTree(sample, { query: "empty" }).nodes[0].children).toEqual([])
})

test("type, size and date narrow together, and missing values do not match", () => {
  const ids = (filter: FileTreeFilter) =>
    filterTree(sample, filter).nodes.flatMap((n) => [n.id, ...(n.children ?? []).map((c) => c.id)])
  expect(ids({ extensions: [".PNG"] })).toEqual(["src", "src/b.png"])
  expect(ids({ kind: "dir" })).toEqual(["src", "src/lazy", "empty"])
  expect(ids({ minSize: 50, maxSize: 200 })).toEqual(["src", "src/a.ts"])
  expect(ids({ modifiedFrom: new Date(2000) })).toEqual(["src", "src/b.png"])
  expect(ids({ modifiedTo: 2000, extensions: ["png"] })).toEqual([])
})

test("a hidden file has no extension", () => {
  expect(fileExtension(".env")).toBe("")
  expect(fileExtension("a.tar.GZ")).toBe("gz")
  expect(fileExtension("noext")).toBe("")
})

test("fetched children slot in, and the app's own win", () => {
  const loaded = new Map<string, FileNode[]>([
    ["src/lazy", [{ id: "x", name: "x", kind: "file" }]],
    ["src", []],
  ])
  const merged = withLoadedChildren(sample, loaded)
  expect(merged[0].children).toHaveLength(3)
  expect(merged[0].children?.[2].children?.map((n) => n.id)).toEqual(["x"])
  expect(withLoadedChildren(sample, new Map())).toBe(sample)
})

test("flat rows carry depth and their place among siblings", () => {
  const rows = flattenVisible(sample, new Set(["src"]), true)
  expect(rows.map((r) => r.node.id)).toEqual(["empty", "src", "src/lazy", "src/a.ts", "src/b.png", "README.md"])
  const lazy = rows[2]
  expect([lazy.depth, lazy.posInSet, lazy.setSize]).toEqual([1, 1, 3])
  expect(rows[5].posInSet).toBe(3)
  expect(flattenVisible([], new Set(), true)).toEqual([])
})

test("the row window clamps at both ends and overscans", () => {
  expect(rowWindow(0, 280, 28, 1000, 5)).toEqual({ start: 0, end: 15 })
  expect(rowWindow(2800, 280, 28, 1000, 5)).toEqual({ start: 95, end: 115 })
  expect(rowWindow(1e6, 280, 28, 1000, 5)).toEqual({ start: 1000, end: 1000 })
  expect(rowWindow(-10, 0, 28, 0, 5)).toEqual({ start: 0, end: 0 })
})

test("a range runs either way, skips locked rows and survives a lost anchor", () => {
  const rows: FileNode[] = [
    { id: "1", name: "1", kind: "file" },
    { id: "2", name: "2", kind: "file", disabled: true },
    { id: "3", name: "3", kind: "file" },
  ]
  expect(rangeIds(rows, "3", "1")).toEqual(["1", "3"])
  expect(rangeIds(rows, "gone", "3")).toEqual(["3"])
  expect(rangeIds(rows, undefined, "1")).toEqual(["1"])
  expect(rangeIds(rows, "1", "gone")).toEqual([])
})

test("the trail runs from the root down", () => {
  const byId = new Map<string, FileNode>([
    ["src", sample[0]],
    ["src/a.ts", sample[0].children![0]],
  ])
  const parentOf = new Map([["src/a.ts", "src"]])
  expect(nodeTrail("src/a.ts", byId, parentOf).map((n) => n.name)).toEqual(["src", "a.ts"])
  expect(nodeTrail("gone", byId, parentOf)).toEqual([])
})

test("a drop lands only in a folder that is new to what is moved", () => {
  const parentOf = new Map([
    ["src/a.ts", "src"],
    ["src/lazy", "src"],
  ])
  const [src, , emptyDir] = sample
  const lazy = src.children![2]
  expect(canDrop(["README.md"], src, parentOf)).toBe(true)
  expect(canDrop(["src/a.ts"], src, parentOf)).toBe(false)
  expect(canDrop(["src"], lazy, parentOf)).toBe(false)
  expect(canDrop(["src"], src, parentOf)).toBe(false)
  expect(canDrop(["src/a.ts"], sample[1], parentOf)).toBe(false)
  expect(canDrop([], emptyDir, parentOf)).toBe(false)
  expect(canDrop(["src/a.ts"], { ...emptyDir, disabled: true }, parentOf)).toBe(false)
})

test("a folder moved with its content moves once", () => {
  const parentOf = new Map([["src/a.ts", "src"]])
  expect(topmostIds(["src", "src/a.ts", "README.md"], parentOf)).toEqual(["src", "README.md"])
  expect(topmostIds([], parentOf)).toEqual([])
})

test("a new name is checked against its folder", () => {
  const [a, b] = sample[0].children!
  expect(renameProblem("  ", a, [a, b])).toBe("empty")
  expect(renameProblem("x/y", a, [a, b])).toBe("separator")
  expect(renameProblem("b.png", a, [a, b])).toBe("duplicate")
  expect(renameProblem("a.ts", a, [a, b])).toBeNull()
  expect(renameProblem("c.ts", a, [a, b])).toBeNull()
})

test("renaming selects the stem of a file and all of a folder", () => {
  expect(renameSelectionEnd({ id: "f", name: "report.tar.gz", kind: "file" })).toBe(10)
  expect(renameSelectionEnd({ id: "f", name: ".env", kind: "file" })).toBe(4)
  expect(renameSelectionEnd({ id: "d", name: "v1.2", kind: "dir" })).toBe(4)
})
