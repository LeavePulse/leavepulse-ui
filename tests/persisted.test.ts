import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { nextTick, ref } from "vue"
import { usePersisted } from "../src/composables/usePersisted"

const store = new Map<string, string>()
const fake = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}
const g = globalThis as { window?: { localStorage?: unknown } }
const hadWindow = "window" in globalThis
let saved: unknown

beforeAll(() => {
  g.window ??= {}
  saved = g.window.localStorage
  Object.defineProperty(g.window, "localStorage", { value: fake, configurable: true, writable: true })
})

afterAll(() => {
  if (!hadWindow) delete g.window
  else Object.defineProperty(g.window!, "localStorage", { value: saved, configurable: true, writable: true })
})

describe("usePersisted", () => {
  test("a key with nothing usable starts from the initial value, not the previous key's", async () => {
    store.clear()
    store.set("a", JSON.stringify({ open: ["x"] }))
    store.set("broken", "{")
    const key = ref("a")
    const value = usePersisted(key, { open: [] as string[] })
    expect(value.value).toEqual({ open: ["x"] })
    value.value.open.push("y")
    await nextTick()
    key.value = "b"
    await nextTick()
    expect(value.value).toEqual({ open: [] })
    key.value = "a"
    await nextTick()
    expect(value.value).toEqual({ open: ["x", "y"] })
    key.value = "broken"
    await nextTick()
    expect(value.value).toEqual({ open: [] })
  })

  test("a value the validator rejects reads as nothing stored", async () => {
    store.clear()
    store.set("good", JSON.stringify(3))
    store.set("bad", JSON.stringify("three"))
    const key = ref("good")
    const value = usePersisted(key, 0, { validate: (v): v is number => typeof v === "number" })
    expect(value.value).toBe(3)
    key.value = "bad"
    await nextTick()
    expect(value.value).toBe(0)
  })
})
