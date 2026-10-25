import { expect, test } from "bun:test"
import { checkStateOf, computeStats, formatSize, type FileNode } from "../src/components/fileTree"

const tree: FileNode[] = [
  {
    id: "d",
    name: "d",
    kind: "dir",
    children: [
      { id: "a", name: "a", kind: "file" },
      { id: "b", name: "b", kind: "file", disabled: true },
    ],
  },
]

test("a locked, unticked child does not hold its folder at indeterminate", () => {
  const checked = new Set(["d", "a"])
  expect(computeStats(tree, checked).get("d")?.state).toBe("checked")
  expect(checkStateOf(tree[0], checked)).toBe("checked")
  expect(computeStats(tree, new Set()).get("d")?.state).toBe("unchecked")
})

test("a locked, ticked child still counts", () => {
  const checked = new Set(["b"])
  expect(computeStats(tree, checked).get("d")?.state).toBe("indeterminate")
})

test("sizes roll over at the unit boundary", () => {
  expect(formatSize(1023, "en")).toBe("1023\u00a0B")
  expect(formatSize(1048000, "en")).toBe("1023\u00a0kB")
  expect(formatSize(1048575, "en")).toBe("1.0\u00a0MB")
  expect(formatSize(2.5 * 1024 * 1024, "en")).toBe("2.5\u00a0MB")
  expect(formatSize(-1)).toBe("—")
})
