import { beforeEach, expect, test } from "bun:test"
import { effectScope } from "vue"
import { browserStorage } from "../src/composables/usePersisted"
import { useWorkspaces } from "../src/layout/useWorkspaces"

const memory = new Map<string, string>()
beforeEach(() => {
  memory.clear()
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
  }
})

const blocksOf = (spaces: ReturnType<typeof useWorkspaces>) =>
  JSON.stringify(spaces.controller.serialize())

test("the first visit starts from the defaults", () => {
  const spaces = useWorkspaces({
    initial: ["a"],
    defaults: [{ id: "one", name: "One", blocks: ["a"] }, { id: "two", name: "Two", blocks: ["b", "c"] }],
  })
  expect(spaces.workspaces.value.map((s) => s.name)).toEqual(["One", "Two"])
  expect(spaces.activeId.value).toBe("one")
})

test("a switch shows the other layout, keeps edits and leaves no undo across", () => {
  const spaces = useWorkspaces({
    initial: ["a"],
    defaults: [{ id: "one", name: "One", blocks: ["a"] }, { id: "two", name: "Two", blocks: ["b"] }],
  })
  spaces.controller.add("edited")
  const edited = blocksOf(spaces)
  spaces.switchTo("two")
  expect(blocksOf(spaces)).toContain('"b"')
  expect(spaces.controller.canUndo.value).toBe(false)
  spaces.switchTo("one")
  expect(blocksOf(spaces)).toBe(edited)
})

test("an unknown id changes nothing", () => {
  const spaces = useWorkspaces({ initial: ["a"] })
  const before = spaces.activeId.value
  spaces.switchTo("nope")
  expect(spaces.activeId.value).toBe(before)
})

test("create, duplicate, rename and remove", () => {
  const spaces = useWorkspaces({ initial: ["a"] })
  const created = spaces.create("  New  ", ["x"])
  expect(spaces.activeId.value).toBe(created)
  expect(spaces.workspaces.value.at(-1)?.name).toBe("New")
  const copy = spaces.duplicate(undefined, "Copy")!
  expect(blocksOf(spaces)).toContain('"x"')
  spaces.rename(copy, "   ")
  expect(spaces.workspaces.value.at(-1)?.name).toBe("Copy")
  spaces.remove(copy)
  expect(spaces.activeId.value).toBe(created)
  expect(spaces.workspaces.value).toHaveLength(2)
})

test("the last workspace cannot be removed", () => {
  const spaces = useWorkspaces({ initial: ["a"] })
  spaces.remove(spaces.activeId.value)
  expect(spaces.workspaces.value).toHaveLength(1)
})

test("removing another workspace keeps what is showing", () => {
  const spaces = useWorkspaces({ initial: ["a"] })
  const first = spaces.activeId.value
  const second = spaces.create("Second", ["b"])
  spaces.remove(first)
  expect(spaces.activeId.value).toBe(second)
  expect(blocksOf(spaces)).toContain('"b"')
})

test("export and import round trip; junk adds nothing", () => {
  const spaces = useWorkspaces({ initial: ["a"] })
  spaces.create("Mine", ["m"])
  const file = spaces.exportWorkspace()!
  const id = spaces.importWorkspace(file)
  expect(id).not.toBeNull()
  expect(blocksOf(spaces)).toContain('"m"')
  const count = spaces.workspaces.value.length
  expect(spaces.importWorkspace({ name: "bad", layout: { kind: "nonsense" } })).toBeNull()
  expect(spaces.importWorkspace(null)).toBeNull()
  expect(spaces.workspaces.value).toHaveLength(count)
})

test("what was saved comes back after a restart", () => {
  const scope = effectScope()
  const first = scope.run(() => useWorkspaces({ initial: ["a"], persist: "t" }))!
  first.create("Saved", ["s"])
  first.controller.add("later")
  scope.stop()
  const second = useWorkspaces({ initial: ["a"], persist: "t" })
  expect(second.workspaces.value.map((s) => s.name)).toContain("Saved")
  expect(blocksOf(second)).toContain('"later"')
})

test("a broken stored layout resets that workspace alone", () => {
  browserStorage.set(
    "lp-workspaces:t",
    JSON.stringify({
      version: 1,
      active: "bad",
      items: [{ id: "bad", name: "Bad", layout: { kind: "nonsense" } }, { id: "ok", name: "Ok", layout: null }],
    }),
  )
  const spaces = useWorkspaces({ initial: ["fallback"], persist: "t" })
  expect(spaces.activeId.value).toBe("bad")
  expect(blocksOf(spaces)).toContain('"fallback"')
})

test("a store of another shape reads as a first visit", () => {
  browserStorage.set("lp-workspaces:t", JSON.stringify({ version: 99, active: "x", items: [] }))
  const spaces = useWorkspaces({ initial: ["a"], persist: "t" })
  expect(spaces.workspaces.value).toHaveLength(1)
})
