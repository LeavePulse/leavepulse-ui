import { expect, test } from "bun:test"
import { pickTab } from "../src/components/tabs"

const items = [
  { value: "a", disabled: true },
  { value: "b" },
  { value: "c" },
]

test("keeps the current tab while it is there and enabled", () => {
  expect(pickTab(items, "c")).toBe("c")
})

test("falls to the first enabled tab, skipping disabled ones", () => {
  expect(pickTab(items, undefined)).toBe("b")
  expect(pickTab(items, "a")).toBe("b")
  expect(pickTab(items, "gone")).toBe("b")
})

test("an empty list keeps the current value, so a default waits for its items", () => {
  expect(pickTab([], "c")).toBe("c")
  expect(pickTab([], undefined)).toBeUndefined()
})

test("all disabled leaves the current value alone", () => {
  expect(pickTab([{ value: "x", disabled: true }], "x")).toBe("x")
})
