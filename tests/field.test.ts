import { expect, test } from "bun:test"
import { isAttrOn, mergeDescribedBy } from "../src/composables/useField"

test("mergeDescribedBy keeps every id once, in order", () => {
  expect(mergeDescribedBy("outer", "hint")).toBe("outer hint")
  expect(mergeDescribedBy("a b", "b c", "a")).toBe("a b c")
  expect(mergeDescribedBy("  a   b ", undefined, "")).toBe("a b")
})

test("mergeDescribedBy is undefined with nothing to say, and ignores what is no string", () => {
  expect(mergeDescribedBy()).toBeUndefined()
  expect(mergeDescribedBy(undefined, "", "  ")).toBeUndefined()
  expect(mergeDescribedBy(null, 7, true, "a")).toBe("a")
})

test("isAttrOn reads a boolean attribute as Vue renders it", () => {
  for (const on of ["", true, "readonly", "false"]) expect(isAttrOn(on)).toBe(true)
  for (const off of [false, undefined, null, 0]) expect(isAttrOn(off)).toBe(false)
})
