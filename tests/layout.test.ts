import { describe, expect, test } from "bun:test"
import { serializeLayout } from "../src/layout/tree"
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
