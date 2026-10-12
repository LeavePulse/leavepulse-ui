import { describe, expect, test } from "bun:test"
import { mergeConfig } from "../src/composables/useLpConfig"

describe("mergeConfig", () => {
  test("inner labels refine the outer scope instead of replacing it", () => {
    const merged = mergeConfig(
      { linkComponent: "nuxt-link", labels: { toast: { dismiss: "Close", undo: "Undo" } } },
      { labels: { toast: { dismiss: "Hide" }, lightbox: { previous: "Back" } } },
    )
    expect(merged.linkComponent).toBe("nuxt-link")
    expect(merged.labels).toEqual({
      toast: { dismiss: "Hide", undo: "Undo" },
      lightbox: { previous: "Back" },
    })
  })
})
