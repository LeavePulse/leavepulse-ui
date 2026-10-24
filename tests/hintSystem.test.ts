import { beforeEach, describe, expect, test } from "bun:test"
import { HINT_SIGNALS, contextMenuTip, hintKey, hintSummary, localHintStorage, paletteTip } from "../src/composables/useHintSystem"

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

describe("hintSummary", () => {
  const features = {
    "p.a": { page: "p", title: "A", text: "" },
    "p.b": { page: "p", title: "B", text: "", required: true },
    "p.c": { page: "p", title: "C", text: "", required: true, rev: 2 },
  }

  test("counts explained and used, and lists required ones not shown", () => {
    const records = new Map([
      [hintKey.feature("p.a"), { state: "used" as const, dismissed: false, count: 1 }],
      [hintKey.feature("p.c", 1), { state: "explained" as const, dismissed: false, count: 0 }],
      [hintKey.page("p"), { state: "seen" as const, dismissed: true, count: 2 }],
    ])
    expect(hintSummary(records, features, "p")).toEqual({ tour: "declined", offers: 2, known: 1, total: 3, missing: ["B", "C"] })
  })

  test("an assigned tour reads as assigned until it is done", () => {
    const records = new Map([[hintKey.page("p"), { state: "seen" as const, dismissed: false, count: 0, assigned: true }]])
    expect(hintSummary(records, features, "p").tour).toBe("assigned")
  })
})

describe("tips", () => {
  const counter = (counts: Record<string, number>) => (signal: string) => counts[signal] ?? 0

  test("right-click tip waits for repeated \"…\" use and stops once right-click is used", () => {
    const tip = contextMenuTip()
    expect(tip.when(counter({ [HINT_SIGNALS.menuButton]: 4 }))).toBe(false)
    expect(tip.when(counter({ [HINT_SIGNALS.menuButton]: 5 }))).toBe(true)
    expect(tip.when(counter({ [HINT_SIGNALS.contextTarget]: 25 }))).toBe(true)
    expect(tip.when(counter({ [HINT_SIGNALS.menuButton]: 9, [HINT_SIGNALS.contextMenu]: 1 }))).toBe(false)
  })

  test("palette tip is for those who navigate a lot and never opened it", () => {
    const tip = paletteTip("Ctrl+K", { title: "T" })
    expect(tip).toMatchObject({ keys: "Ctrl+K", title: "T" })
    expect(tip.when(counter({ [HINT_SIGNALS.navigate]: 15 }))).toBe(true)
    expect(tip.when(counter({ [HINT_SIGNALS.navigate]: 15, [HINT_SIGNALS.palette]: 1 }))).toBe(false)
  })
})
