import { afterAll, beforeAll, expect, test } from "bun:test"
import { matchesHotkey, type HotkeyBinding } from "../src/composables/useHotkeys"
import { useToast } from "../src/composables/useToast"
import { confirm, confirmQueue, settleConfirm } from "../src/components/confirm"

const g = globalThis as { window?: unknown }
const hadWindow = "window" in g
beforeAll(() => {
  if (!hadWindow) g.window = globalThis
})
afterAll(() => {
  if (!hadWindow) delete g.window
})

function key(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return { code: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init } as KeyboardEvent
}
const bind = (b: Partial<HotkeyBinding> & { key: string }): HotkeyBinding => ({ handler: () => {}, ...b })

test("a modifier-only binding matches the modifier's own keydown", () => {
  expect(matchesHotkey(key({ key: "Control", ctrlKey: true }), bind({ key: "control" }))).toBe(true)
  expect(matchesHotkey(key({ key: "Meta", metaKey: true }), bind({ key: "meta" }))).toBe(true)
  expect(matchesHotkey(key({ key: "Shift", shiftKey: true }), bind({ key: "shift" }))).toBe(true)
  expect(matchesHotkey(key({ key: "a", ctrlKey: true }), bind({ key: "control" }))).toBe(false)
})

test("a symbol binding accepts the Shift its layout needs", () => {
  expect(matchesHotkey(key({ key: "?", shiftKey: true }), bind({ key: "?" }))).toBe(true)
  expect(matchesHotkey(key({ key: "+", shiftKey: true }), bind({ key: "+" }))).toBe(true)
  expect(matchesHotkey(key({ key: "+" }), bind({ key: "+", shift: true }))).toBe(false)
})

test("letters and named keys stay strict about Shift", () => {
  expect(matchesHotkey(key({ key: "R", shiftKey: true }), bind({ key: "r" }))).toBe(false)
  expect(matchesHotkey(key({ key: "R", shiftKey: true }), bind({ key: "r", shift: true }))).toBe(true)
  expect(matchesHotkey(key({ key: "ArrowLeft", shiftKey: true }), bind({ key: "arrowleft" }))).toBe(false)
})

test("code matches across layouts and Ctrl stands for Meta", () => {
  const ctrlK = bind({ key: "k", code: "KeyK", ctrl: true })
  expect(matchesHotkey(key({ key: "\u043b", code: "KeyK", ctrlKey: true }), ctrlK)).toBe(true)
  expect(matchesHotkey(key({ key: "k", metaKey: true }), ctrlK)).toBe(true)
  expect(matchesHotkey(key({ key: "k" }), ctrlK)).toBe(false)
})

test("a toast with the same key replaces the one on screen", () => {
  const toast = useToast()
  toast.clear()
  const first = toast.success("Saved", { key: "save" })
  const second = toast.success("Saved again", { key: "save" })
  expect(second).toBe(first)
  expect(toast.queue.length).toBe(1)
  expect(toast.queue[0]?.message).toBe("Saved again")
  expect(toast.queue[0]?.rev).toBe(1)
  toast.info("Other")
  expect(toast.queue.length).toBe(2)
  toast.clear()
})

test("toast.promise turns its loading toast into the result", async () => {
  const toast = useToast()
  toast.clear()
  await toast.promise(Promise.resolve(3), { loading: "Saving", success: (n) => `Saved ${n}`, error: "Failed" })
  await Promise.resolve()
  expect(toast.queue.length).toBe(1)
  expect(toast.queue[0]?.variant).toBe("success")
  expect(toast.queue[0]?.message).toBe("Saved 3")
  await toast.promise(Promise.reject(new Error("x")), { loading: "Saving", success: "Saved", error: "Failed" }).catch(() => {})
  await Promise.resolve()
  expect(toast.queue.length).toBe(2)
  expect(toast.queue[1]?.variant).toBe("error")
  toast.clear()
})

test("confirm() resolves with the host's answer", async () => {
  const yes = confirm({ title: "Delete?" })
  const no = confirm({ title: "Discard?" })
  expect(confirmQueue.map((r) => r.title)).toEqual(["Delete?", "Discard?"])
  settleConfirm(confirmQueue[0]!.id, true)
  settleConfirm(confirmQueue[0]!.id, false)
  expect(await yes).toBe(true)
  expect(await no).toBe(false)
  expect(confirmQueue.length).toBe(0)
})
