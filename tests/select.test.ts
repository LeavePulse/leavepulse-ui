import { describe, expect, test } from "bun:test"
import { evictOldest, fitChips, toggledValues } from "../src/components/select"

describe("fitChips", () => {
  test("shows everything that fits", () => {
    expect(fitChips([40, 40, 40], 128, 4, 30)).toBe(3)
  })
  test("keeps room for the +N chip once something overflows", () => {
    // 40 + 4 + 40 + 4 + 30 = 118 fits; a third chip would not.
    expect(fitChips([40, 40, 40, 40], 120, 4, 30)).toBe(2)
  })
  test("never shows fewer than one chip", () => {
    expect(fitChips([200, 40], 100, 4, 30)).toBe(1)
  })
  test("nothing to fit", () => {
    expect(fitChips([], 100, 4, 30)).toBe(0)
  })
})

describe("toggledValues", () => {
  test("an added value", () => {
    expect(toggledValues([1, 2], [1, 2, 3])).toEqual([3])
  })
  test("a removed value", () => {
    expect(toggledValues(["a", "b"], ["b"])).toEqual(["a"])
  })
  test("several moved at once: added first, then removed", () => {
    expect(toggledValues(["a", "b"], ["b", "c"])).toEqual(["c", "a"])
  })
})

describe("evictOldest", () => {
  test("drops the oldest past the limit and keeps what is selected", () => {
    const cache = new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4]])
    evictOldest(cache, new Set(["a"]), 2)
    expect([...cache.keys()]).toEqual(["a", "d"])
  })

  test("never drops a kept entry, even over the limit", () => {
    const cache = new Map([["a", 1], ["b", 2]])
    evictOldest(cache, new Set(["a", "b"]), 1)
    expect(cache.size).toBe(2)
  })

  test("leaves an empty or small cache alone", () => {
    const empty = new Map<string, number>()
    evictOldest(empty, new Set(), 2)
    expect(empty.size).toBe(0)
    const small = new Map([["a", 1]])
    evictOldest(small, new Set(), 2)
    expect(small.size).toBe(1)
  })
})
