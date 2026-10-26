import { expect, test } from "bun:test"
import { mergeClass } from "../src/composables/useMergedClass"

test("a consumer's kit token wins over the component's own, like any utility", () => {
  expect(mergeClass("rounded-control border bg-surface-soft", "rounded-card bg-surface-raised")).toBe("border rounded-card bg-surface-raised")
  expect(mergeClass("shadow-sm", "shadow-panel")).toBe("shadow-panel")
  expect(mergeClass("ease-out", "ease-emphasized")).toBe("ease-emphasized")
  expect(mergeClass("w-full p-2", "w-40", false, undefined)).toBe("p-2 w-40")
})
