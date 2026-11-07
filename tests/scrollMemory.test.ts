import { expect, test } from "bun:test"
import { hashTargetId, rememberPosition } from "../src/composables/scrollMemory"

test("a hash names its decoded id, and a malformed escape does not throw", () => {
  expect(hashTargetId("#install")).toBe("install")
  expect(hashTargetId("#%D1%83%D1%81%D1%82")).toBe("уст")
  expect(hashTargetId("#%E0%A4%A")).toBe("%E0%A4%A")
})

test("positions stay bounded and drop the address visited longest ago", () => {
  const store = new Map<string, number>()
  rememberPosition(store, "/a", 1, 2)
  rememberPosition(store, "/b", 2, 2)
  rememberPosition(store, "/a", 3, 2)
  rememberPosition(store, "/c", 4, 2)
  expect([...store]).toEqual([["/a", 3], ["/c", 4]])
})
