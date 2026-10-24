import { beforeEach, describe, expect, test } from "bun:test"
import { localHintStorage } from "../src/composables/useHintSystem"

const memory = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  get length() {
    return memory.size
  },
} as Storage

describe("localHintStorage", () => {
  beforeEach(() => memory.clear())

  test("state only climbs: used is never lowered back to seen", () => {
    const storage = localHintStorage("t")
    storage.save([{ key: "f:a:1", state: "used" }])
    storage.save([{ key: "f:a:1", state: "seen" }])
    expect((storage.load() as Record<string, { state: string }>)["f:a:1"]!.state).toBe("used")
  })

  test("counts add up and dismissal sticks until changed", () => {
    const storage = localHintStorage("t")
    storage.save([{ key: "t:p", add: 1 }])
    storage.save([{ key: "t:p", add: 1, dismissed: true }])
    storage.save([{ key: "t:p", state: "explained" }])
    const rec = (storage.load() as Record<string, { count: number; dismissed: boolean; state: string }>)["t:p"]!
    expect(rec).toMatchObject({ count: 2, dismissed: true, state: "explained" })
  })

  test("a broken stored value reads as empty instead of throwing", () => {
    memory.set("t", "{nope")
    expect(localHintStorage("t").load()).toEqual({})
  })
})
