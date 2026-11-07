import { afterAll, beforeAll, expect, test } from "bun:test"
import { createRenderer, defineComponent, h, ref, type App } from "vue"
import {
  commandShortcuts,
  commandToHotkey,
  commandToMenuItem,
  commandToPalette,
  useCommands,
  type AppCommand,
} from "../src/composables/useCommands"
import { activeShortcuts, hotkeySteps } from "../src/composables/useHotkeys"
import { createPaletteRegistry, type PaletteScope } from "../src/composables/usePaletteCommands"

const g = globalThis as unknown as Record<string, unknown>
const hadWindow = "window" in globalThis
const hadHtmlElement = "HTMLElement" in globalThis

beforeAll(() => {
  if (!hadWindow) g.window = new EventTarget()
  if (!hadHtmlElement) g.HTMLElement = class {}
})

afterAll(() => {
  if (!hadWindow) delete g.window
  if (!hadHtmlElement) delete g.HTMLElement
})

const { createApp } = createRenderer<object, object>({
  patchProp() {},
  insert() {},
  remove() {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText() {},
  setElementText() {},
  parentNode: () => null,
  nextSibling: () => null,
})

const restart = (over: Partial<AppCommand> = {}): AppCommand => ({
  id: "server/restart",
  label: "Restart",
  group: "Server",
  shortcut: "Ctrl+R",
  run: () => {},
  ...over,
})

function press(init: Record<string, unknown>) {
  const event = new Event("keydown", { cancelable: true }) as Event & Record<string, unknown>
  Object.assign(event, { key: "", code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, repeat: false, isComposing: false, ...init })
  ;(window as unknown as EventTarget).dispatchEvent(event)
  return event
}

function scope(): PaletteScope {
  return { registry: createPaletteRegistry(), id: "test", label: "Test", depth: 0, enabled: true, discover: true }
}

function mount(setup: () => void): App {
  const app = createApp(defineComponent({ setup() { setup(); return () => h("div") } }))
  app.mount({})
  return app
}

test("one definition gives the palette row, the menu item and the key", () => {
  const command = restart({ icon: "lucide:rotate-cw", danger: true })
  expect(commandToPalette(command)).toMatchObject({ id: "server/restart", label: "Restart", group: "Server", shortcut: "Ctrl+R", icon: "lucide:rotate-cw" })
  expect(commandToMenuItem(command)).toMatchObject({ label: "Restart", shortcut: "Ctrl+R", danger: true })
  expect(commandToHotkey(command)).toMatchObject({ key: "r", code: "KeyR", ctrl: true, help: { group: "Server", label: "Restart", combo: "Ctrl+R" } })
})

test("a command with no key binds nothing and stays out of the reference", () => {
  expect(commandToHotkey(restart({ shortcut: undefined }))).toBeNull()
  expect(commandToHotkey(restart({ shortcut: "  " }))).toBeNull()
  expect(commandShortcuts([restart({ shortcut: undefined })])).toEqual([])
  expect(commandShortcuts([])).toEqual([])
})

test("spaces in a shortcut make a sequence", () => {
  const binding = commandToHotkey(restart({ shortcut: "G I" }))!
  expect(hotkeySteps(binding).map((step) => step.key)).toEqual(["g", "i"])
})

test("a disabled command leaves its key alone", () => {
  let runs = 0
  const binding = commandToHotkey(restart({ disabled: true, run: () => runs++ }))!
  expect(binding.handler(new Event("keydown") as KeyboardEvent)).toBe(false)
  expect(runs).toBe(0)
})

test("the reference groups by section, hidden commands out", () => {
  const groups = commandShortcuts([
    restart(),
    restart({ id: "a", label: "Stop", shortcut: "Ctrl+S" }),
    restart({ id: "b", label: "Gone", shortcut: "Ctrl+G", hidden: true }),
    restart({ id: "c", label: "Other", group: undefined, shortcut: "F2" }),
  ])
  expect(groups).toEqual([
    { title: "Server", entries: [{ combo: "Ctrl+R", label: "Restart" }, { combo: "Ctrl+S", label: "Stop" }] },
    { title: "Commands", entries: [{ combo: "F2", label: "Other" }] },
  ])
})

test("a mounted command is in the palette, the key reference and on its key", () => {
  let runs = 0
  const palette = scope()
  const app = mount(() => {
    useCommands(() => [restart({ run: () => runs++ })], { palette })
  })
  expect(palette.registry.commands.value.map((command) => command.id)).toEqual(["server/restart"])
  expect(activeShortcuts.value.find((group) => group.title === "Server")?.entries).toEqual([{ combo: "Ctrl+R", label: "Restart", conflict: undefined }])
  press({ key: "r", code: "KeyR", ctrlKey: true })
  expect(runs).toBe(1)
  app.unmount()
  expect(palette.registry.commands.value).toEqual([])
  expect(activeShortcuts.value.find((group) => group.title === "Server")).toBeUndefined()
  press({ key: "r", code: "KeyR", ctrlKey: true })
  expect(runs).toBe(1)
})

test("availability stays live, and hidden removes the command everywhere", () => {
  let runs = 0
  const off = ref(false)
  const gone = ref(false)
  const palette = scope()
  let api!: ReturnType<typeof useCommands>
  const app = mount(() => {
    api = useCommands(() => [restart({ disabled: off.value, hidden: gone.value, run: () => runs++ })], { palette })
  })
  expect(api.run("server/restart")).toBe(true)
  off.value = true
  expect(api.menuItems.value[0]?.disabled).toBe(true)
  expect(palette.registry.commands.value[0]?.disabled).toBe(true)
  expect(api.run("server/restart")).toBe(false)
  press({ key: "r", code: "KeyR", ctrlKey: true })
  expect(runs).toBe(1)
  gone.value = true
  expect(api.menuItems.value).toEqual([])
  expect(palette.registry.commands.value).toEqual([])
  expect(api.run("server/restart")).toBe(false)
  expect(api.run("nothing")).toBe(false)
  app.unmount()
})
