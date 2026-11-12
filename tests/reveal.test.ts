import { describe, expect, test } from "bun:test"
import { effectScope } from "vue"
import { useReveal } from "../src/composables/useReveal"

/*
 * The server and the hydrating client must start from the same value, or every
 * component with an entrance hydrates with a mismatch. Run with and without a
 * window: the first value may not depend on it.
 */
function firstValue(immediate?: boolean) {
  const scope = effectScope()
  const value = scope.run(() => useReveal({ immediate }).revealed.value)
  scope.stop()
  return value
}

describe("useReveal", () => {
  test("starts with the same value whether or not there is a window", () => {
    const g = globalThis as { window?: unknown }
    const had = "window" in g
    const saved = g.window
    try {
      delete g.window
      const server = firstValue()
      g.window = {}
      const client = firstValue()
      expect(server).toBe(client)
      expect(server).toBe(false)
    } finally {
      if (had) g.window = saved
      else delete g.window
    }
  })

  test("immediate starts revealed on both sides", () => {
    expect(firstValue(true)).toBe(true)
  })
})
