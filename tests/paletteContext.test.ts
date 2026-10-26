import { expect, test } from "bun:test"
import { effectScope, ref } from "vue"
import { createPaletteRegistry, mergePaletteCommands, usePaletteCommands } from "../src/composables/usePaletteCommands"
import { searchCommandItems, parseCommandQuery, swapCommandLayout } from "../src/components/commandSearch"

test("layout fallback works in either direction and retains operator filters", () => {
  const items = [{ id: "branches", label: "Ветки", group: "Navigation" }, { id: "theme", label: "Theme", group: "Settings" }]
  expect(searchCommandItems(items, parseCommandQuery("dtnrb in:navigation")).items.map(c => c.id)).toEqual(["branches"])
  expect(searchCommandItems(items, parseCommandQuery("еруыу")).items.map(c => c.id)).toEqual(["theme"])
  expect(searchCommandItems(items, parseCommandQuery("dtnrb -Ветки")).items).toEqual([])
  expect(searchCommandItems(items, parseCommandQuery("dtnrb")).terms).toEqual(["ветки"])
  expect(swapCommandLayout("Dtnrb")).toBe("Ветки")
})

test("an exact query wins over keyboard-layout guesses", () => {
  const items = [{ id: "literal", label: "dtnrb" }, { id: "branches", label: "Ветки" }]
  expect(searchCommandItems(items, parseCommandQuery("dtnrb")).items.map(c => c.id)).toEqual(["literal"])
})

test("context registrations are reactive, prioritised and removed on disposal", () => {
  const registry = createPaletteRegistry()
  const active = ref(true)
  const label = ref("First")
  registry.register({ priority: 0, commands: () => [{ id: "global", label: "Global" }] })
  const stop = registry.register({ priority: 100, commands: () => active.value ? [{ id: "page", label: label.value }] : [] })
  expect(registry.commands.value.map(c => c.id)).toEqual(["page", "global"])
  label.value = "Updated"
  expect(registry.commands.value[0]!.label).toBe("Updated")
  active.value = false
  expect(registry.commands.value.map(c => c.id)).toEqual(["global"])
  active.value = true
  stop()
  expect(registry.commands.value.map(c => c.id)).toEqual(["global"])
})

test("registries isolate applications and deduplicate by command identity", () => {
  const a = createPaletteRegistry(), b = createPaletteRegistry()
  a.register({ priority: 0, commands: () => [{ id: "same", label: "Generated" }] })
  a.register({ priority: 10, commands: () => [{ id: "same", label: "Manual" }] })
  expect(a.commands.value.map(c => c.label)).toEqual(["Manual"])
  expect(b.commands.value).toEqual([])
  expect(mergePaletteCommands(a.commands.value, [{ id: "same", label: "Override" }, { id: "extra", label: "Extra" }]).map(c => c.label)).toEqual(["Override", "Extra"])
})

test("discovered commands keep their id across remounts and number a shared label", () => {
  const registry = createPaletteRegistry()
  const field = (label: string) => registry.register({ priority: 0, automatic: true, commands: () => [{ id: `page/${label}`, label, actions: [{ id: `page/${label}/focus`, label: "Go to field" }] }] })
  const first = field("Region")
  field("Region")
  field("CPU")
  expect(registry.commands.value.map(c => c.id)).toEqual(["page/Region", "page/Region~2", "page/CPU"])
  expect(registry.commands.value[1]!.actions?.[0]!.id).toBe("page/Region~2/focus")
  first()
  field("Region")
  expect(registry.commands.value.map(c => c.id)).toContain("page/CPU")
  registry.register({ priority: 10, commands: () => [{ id: "page/CPU", label: "Manual CPU" }] })
  expect(registry.commands.value.filter(c => c.id === "page/CPU").map(c => c.label)).toEqual(["Manual CPU"])
})

test("a discovered command is found by the name of the scope it sits in", () => {
  const registry = createPaletteRegistry()
  const scope = { registry, id: "settings", label: "Settings", depth: 1, enabled: true, discover: true }
  const run = effectScope()
  run.run(() => {
    usePaletteCommands(() => [{ id: "settings/save", label: "Save" }], { automatic: true, scope })
    usePaletteCommands(() => [{ id: "settings/export", label: "Export", keywords: ["csv"] }], { scope })
  })
  const [manual, found] = registry.commands.value
  expect(found!.keywords).toEqual(["Settings"])
  expect(manual!.keywords).toEqual(["csv"])
  expect(searchCommandItems(registry.commands.value, parseCommandQuery("settings save")).items.map(c => c.id)).toEqual(["settings/save"])
  run.stop()
})

test("one manual command registered twice is listed once", () => {
  const registry = createPaletteRegistry()
  registry.register({ priority: 10, commands: () => [{ id: "app/theme", label: "Theme" }] })
  registry.register({ priority: 10, commands: () => [{ id: "app/theme", label: "Theme" }] })
  expect(registry.commands.value.map(c => c.id)).toEqual(["app/theme"])
})
