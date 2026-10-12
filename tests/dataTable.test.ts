import { expect, test } from "bun:test"
import { compareValues } from "../src/components/tableSort"

test("dates sort by time, not by their string form", () => {
  const days = [new Date(2023, 0, 5), new Date(2023, 0, 1), new Date(2023, 5, 1), new Date(2023, 0, 3)]
  const sorted = [...days].sort(compareValues).map((d) => d.getTime())
  expect(sorted).toEqual([...sorted].sort((a, b) => a - b))
  expect(sorted[0]).toBe(new Date(2023, 0, 1).getTime())
})

test("empty values come first and kinds group together", () => {
  // Array#sort always moves undefined to the end itself, so it is compared directly.
  expect(compareValues(undefined, 0)).toBeLessThan(0)
  const values = ["b", 3, null, true, Number.NaN, 1, "a", false, 10n]
  expect([...values].sort(compareValues)).toEqual([
    null,
    Number.NaN,
    false,
    true,
    1,
    3,
    10n,
    "a",
    "b",
  ])
})

test("text compares numeric runs as numbers", () => {
  expect(["file 10", "file 2", "file 1"].sort(compareValues)).toEqual(["file 1", "file 2", "file 10"])
})
