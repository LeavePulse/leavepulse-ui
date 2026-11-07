import { describe, expect, test } from "bun:test"
import { deserializeLayout, makeLayout, moveLeaf, serializeLayout, type Leaf, type LayoutNode, type Side, type Split } from "../src/layout/tree"
import { layoutController, useLayout } from "../src/layout/useLayout"

describe("useLayout history", () => {
  test("canvas edits found through the controller are undoable", () => {
    const layout = useLayout({ initial: ["a", "b", "c"] })
    const before = JSON.stringify(serializeLayout(layout.layout.value))
    const [first, , third] = layout.layout.value.children
    const controller = layoutController(layout.layout.value)
    expect(controller).toBeDefined()
    controller!.move(first!.id, third!.id, "right")
    expect(layout.canUndo.value).toBe(true)
    layout.undo()
    expect(JSON.stringify(serializeLayout(layout.layout.value))).toBe(before)
  })

  test("undo keeps node ids, so blocks are not remounted", () => {
    const layout = useLayout({ initial: ["a", "b"] })
    const ids = layout.layout.value.children.map((c) => c.id)
    layout.add("c")
    layout.undo()
    expect(layout.layout.value.children.map((c) => c.id)).toEqual(ids)
  })

  test("the controller follows the tree across undo and redo", () => {
    const layout = useLayout({ initial: ["a", "b"] })
    layout.add("c")
    layout.undo()
    expect(layoutController(layout.layout.value)).toBeDefined()
    layout.redo()
    expect(layoutController(layout.layout.value)).toBeDefined()
  })

  test("a resize gesture is one history step", () => {
    const layout = useLayout({ initial: ["a", "b"] })
    const root = layout.layout.value
    layout.beginResize()
    layout.resize(root, 0, 0.05)
    layout.resize(root, 0, 0.05)
    layout.endResize()
    expect(layout.canUndo.value).toBe(true)
    layout.undo()
    expect(layout.canUndo.value).toBe(false)
    expect(layout.layout.value.children[0]!.size).toBe(1)
  })

  test("fresh ids never collide with restored ones", () => {
    const layout = useLayout({ initial: ["a"] })
    layout.add("b")
    layout.undo()
    layout.add("c")
    const ids = layout.layout.value.children.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

const allIds = (node: LayoutNode): string[] =>
  node.kind === "leaf" ? [node.id] : [node.id, ...node.children.flatMap(allIds)]
const allBlocks = (node: LayoutNode): string[] =>
  node.kind === "leaf" ? [...node.blocks] : node.children.flatMap(allBlocks)
const leavesOf = (node: LayoutNode): LayoutNode[] =>
  node.kind === "leaf" ? [node] : node.children.flatMap(leavesOf)

function expectSound(root: Split, blocks: string[]) {
  expect(allBlocks(root).sort()).toEqual([...blocks].sort())
  const ids = allIds(root)
  expect(new Set(ids).size).toBe(ids.length)
  const walk = (node: LayoutNode, isRoot: boolean) => {
    expect(node.size).toBeGreaterThan(0)
    if (node.kind === "leaf") {
      expect(node.blocks.length).toBeGreaterThan(0)
      expect(node.active).toBeLessThan(node.blocks.length)
      return
    }
    if (!isRoot) expect(node.children.length).toBeGreaterThan(1)
    for (const child of node.children) walk(child, false)
  }
  walk(root, true)
}

describe("moveLeaf", () => {
  const SIDES: Side[] = ["left", "right", "top", "bottom", "center"]

  test("a move to a cell that does not exist keeps the moving cell", () => {
    const root = makeLayout(["a", "b"])
    moveLeaf(root, root.children[0]!.id, "missing", "right")
    moveLeaf(root, root.children[0]!.id, "missing", "center")
    expectSound(root, ["a", "b"])
  })

  test("a move onto itself changes nothing", () => {
    const root = makeLayout(["a", "b"])
    const before = serializeLayout(root)
    moveLeaf(root, root.children[0]!.id, root.children[0]!.id, "left")
    expect(serializeLayout(root)).toEqual(before)
  })

  test("any sequence of moves between nested cells keeps every block and the tree's shape", () => {
    const blocks = ["a", "b", "c", "d", "e", "f"]
    // A fixed-seed generator, so a failure replays.
    let seed = 12345
    const pick = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
    for (let round = 0; round < 40; round++) {
      const root = makeLayout(blocks)
      for (let move = 0; move < 60; move++) {
        const leaves = leavesOf(root)
        if (leaves.length < 2) break
        const from = leaves[pick(leaves.length)]!
        const to = leaves[pick(leaves.length)]!
        moveLeaf(root, from.id, to.id, SIDES[pick(SIDES.length)]!)
        expectSound(root, blocks)
      }
    }
  })
})

describe("deserializeLayout", () => {
  const load = (data: unknown) => deserializeLayout(data as Parameters<typeof deserializeLayout>[0])
  const cell = (extra: object = {}) => ({ kind: "leaf", blocks: ["a"], active: 0, size: 1, ...extra })

  test("round-trips a layout", () => {
    const root = makeLayout(["a", "b"])
    moveLeaf(root, root.children[0]!.id, root.children[1]!.id, "top")
    expect(serializeLayout(load(serializeLayout(root)))).toEqual(serializeLayout(root))
  })

  test("reads the legacy single-block form", () => {
    expect(allBlocks(load({ kind: "split", dir: "row", size: 1, children: [{ kind: "leaf", block: "old", size: 1 }] }))).toEqual(["old"])
  })

  test("bad sizes and directions fall back to the defaults", () => {
    for (const size of [Number.NaN, Infinity, -2, 0, "wide", undefined]) {
      const root = load({ kind: "split", dir: "sideways", size, children: [cell({ size })] })
      expect(root.size).toBe(1)
      expect(root.dir).toBe("row")
      expect(root.children[0]!.size).toBe(1)
    }
  })

  test("the active tab stays inside the stack", () => {
    for (const active of [9, -1, 0.5, "1", undefined]) {
      const leaf = load({ kind: "split", dir: "row", size: 1, children: [cell({ blocks: ["a", "b"], active })] }).children[0] as Leaf
      expect(leaf.active).toBeGreaterThanOrEqual(0)
      expect(leaf.active).toBeLessThan(2)
    }
  })

  test("what cannot be drawn is left out, the rest survives", () => {
    const root = load({
      kind: "split",
      dir: "row",
      size: 1,
      children: [
        cell(),
        cell({ blocks: [] }),
        cell({ blocks: [1, null] }),
        { kind: "split", dir: "col", size: 1, children: [] },
        { kind: "split", dir: "col", size: 1 },
        { kind: "mystery" },
        null,
      ],
    })
    expect(root.children.length).toBe(1)
  })

  test("a bare leaf at the root is wrapped, and a root with nothing valid is empty", () => {
    expect(load(cell()).children.length).toBe(1)
    expect(load({ kind: "split", dir: "row", size: 1, children: [] }).children).toEqual([])
  })

  test("data that is no layout at all throws", () => {
    for (const data of [null, undefined, 3, "x", {}, { kind: "mystery" }]) expect(() => load(data)).toThrow("Invalid layout")
  })
})
