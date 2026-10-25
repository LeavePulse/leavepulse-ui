import { describe, expect, test } from "bun:test"
import { fitChips, toggledValues } from "../src/components/select"

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
