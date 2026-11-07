import { afterAll, beforeAll, expect, test } from "bun:test"
import { createRenderer, defineComponent, h, type App } from "vue"
import { pendingHotkey, useHotkeys, type HotkeyBinding } from "../src/composables/useHotkeys"

/*
 * The pending-sequence state lives behind the window listener, so these drive
 * it the way a page does: a mounted component and keydown events. A renderer
 * with no DOM is enough, since nothing here looks at what is drawn.
 */
const SEQUENCE_TIMEOUT_MS = 20
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

function mountHotkeys(bindings: HotkeyBinding[]): App {
  const app = createApp(defineComponent({
    setup() {
      useHotkeys(bindings)
      return () => h("div")
    },
  }))
  app.mount({})
  return app
}

function press(key: string, repeat = false) {
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    key, code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, repeat, isComposing: false,
  })
  ;(g.window as EventTarget).dispatchEvent(event)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test("a key held for a sequence does not run once its owner unmounts", async () => {
  let single = 0
  const app = mountHotkeys([
    { key: "g", handler: () => void single++ },
    { sequence: "g i", timeout: SEQUENCE_TIMEOUT_MS, handler: () => {} },
  ])
  const keeper = mountHotkeys([{ key: "z", handler: () => {} }])
  press("g")
  expect(pendingHotkey.value).toEqual(["G"])
  app.unmount()
  expect(pendingHotkey.value).toEqual([])
  await wait(SEQUENCE_TIMEOUT_MS * 2)
  expect(single).toBe(0)
  keeper.unmount()
})

test("auto-repeat of a held key neither ends the wait nor completes a sequence", async () => {
  let double = 0
  let single = 0
  const app = mountHotkeys([
    { key: "g", handler: () => void single++ },
    { sequence: "g g", timeout: SEQUENCE_TIMEOUT_MS, handler: () => void double++ },
  ])
  press("g")
  press("g", true)
  press("g", true)
  expect(double).toBe(0)
  expect(single).toBe(0)
  await wait(SEQUENCE_TIMEOUT_MS * 2)
  expect(single).toBe(1)
  press("g")
  press("g")
  expect(double).toBe(1)
  app.unmount()
})

test("a sequence and a single key on its first key each still run", async () => {
  const ran: string[] = []
  const app = mountHotkeys([
    { key: "g", handler: () => void ran.push("single") },
    { sequence: "g i", timeout: SEQUENCE_TIMEOUT_MS, handler: () => void ran.push("sequence") },
  ])
  press("g")
  press("i")
  expect(ran).toEqual(["sequence"])
  press("g")
  press("x")
  expect(ran).toEqual(["sequence", "single"])
  app.unmount()
})
