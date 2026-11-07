import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { effectScope, ref } from "vue"
import { useFormDraft, type UseFormDraft, type UseFormDraftOptions } from "../src/composables/useFormDraft"

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

beforeEach(() => store.clear())

const DAY_MS = 24 * 60 * 60 * 1000
const stamp = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString()
const envelope = (fields: object) => JSON.stringify({ version: 1, ...fields })

function draftOf<T>(options: Partial<UseFormDraftOptions<T>> & { key: UseFormDraftOptions<T>["key"] }): UseFormDraft<T> {
  return effectScope().run(() => useFormDraft<T>({ value: () => null as T, disabled: true, ...options }))!
}

describe("useFormDraft", () => {
  test("a sound envelope is offered and read back", () => {
    store.set("k", envelope({ savedAt: stamp(), value: { name: "a" } }))
    const draft = draftOf<{ name: string }>({ key: "k" })
    expect(draft.hasDraft.value).toBe(true)
    expect(draft.read()).toEqual({ name: "a" })
  })

  for (const [name, savedAt] of [["missing", undefined], ["not a string", 5], ["not a date", "soon"]] as const) {
    test(`a ${name} stamp is damage, with or without an age limit`, () => {
      for (const maxAgeMs of [DAY_MS, 0]) {
        store.set("k", envelope({ savedAt, value: 1 }))
        const draft = draftOf<number>({ key: "k", maxAgeMs })
        expect(draft.hasDraft.value).toBe(false)
        expect(draft.read()).toBeNull()
        expect(store.has("k")).toBe(false)
      }
    })
  }

  test("a stamp from the future is held to the age limit, a small skew is not", () => {
    store.set("k", envelope({ savedAt: stamp(-2 * DAY_MS), value: 1 }))
    expect(draftOf<number>({ key: "k", maxAgeMs: DAY_MS }).hasDraft.value).toBe(false)
    store.set("k", envelope({ savedAt: stamp(-1000), value: 1 }))
    expect(draftOf<number>({ key: "k", maxAgeMs: DAY_MS }).hasDraft.value).toBe(true)
  })

  test("an envelope without a value reads as null, never undefined", () => {
    store.set("k", envelope({ savedAt: stamp() }))
    const draft = draftOf<number>({ key: "k" })
    expect(draft.hasDraft.value).toBe(false)
    expect(draft.read()).toBeNull()
  })

  test("a stored null is a value", () => {
    store.set("k", envelope({ savedAt: stamp(), value: null }))
    expect(draftOf<null>({ key: "k" }).hasDraft.value).toBe(true)
  })

  test("validate turns away a draft of an older form shape", () => {
    const validate = (value: unknown): value is { name: string } => typeof (value as { name?: unknown })?.name === "string"
    store.set("k", envelope({ savedAt: stamp(), value: { title: "old" } }))
    const draft = draftOf<{ name: string }>({ key: "k", validate })
    expect(draft.hasDraft.value).toBe(false)
    expect(draft.read()).toBeNull()
    expect(store.has("k")).toBe(false)
  })

  test("discard with the key an action started under leaves the new subject's draft", () => {
    store.set("a", envelope({ savedAt: stamp(), value: 1 }))
    store.set("b", envelope({ savedAt: stamp(), value: 2 }))
    const key = ref("a")
    const draft = draftOf<number>({ key })
    key.value = "b"
    draft.discard("a")
    expect(store.has("a")).toBe(false)
    expect(store.has("b")).toBe(true)
  })

  test("discard with no key acts on the current one, also when bound to an event", () => {
    store.set("k", envelope({ savedAt: stamp(), value: 1 }))
    const draft = draftOf<number>({ key: "k" })
    ;(draft.discard as (arg: unknown) => void)({ type: "click" })
    expect(draft.hasDraft.value).toBe(false)
    expect(store.has("k")).toBe(false)
  })
})
