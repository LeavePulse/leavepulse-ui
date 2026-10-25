import { describe, expect, test } from "bun:test"
import { pseudoLocalize } from "../src/composables/pseudoLocale"
import { mergeConfig } from "../src/composables/useLpConfig"

describe("pseudoLocalize", () => {
  test("accents letters, brackets the string and keeps the reading", () => {
    const out = pseudoLocalize("Save", { expand: 0 })
    expect(out).toBe("[Šåṽé]")
  })

  test("grows the text by about the requested share", () => {
    const text = "Remove this item from the list"
    const letters = text.replace(/[^a-zA-Z]/g, "").length
    const out = pseudoLocalize(text, { brackets: false })
    expect(out.length - text.length).toBe(Math.round(letters * 0.35))
    expect(pseudoLocalize(text, { expand: 0.4, brackets: false }).length - text.length).toBe(Math.round(letters * 0.4))
  })

  test("placeholders, tags and entities survive untouched", () => {
    const out = pseudoLocalize("Hello {name}, you have {{ count }} new <b>items</b> &amp; %s or %1$d")
    for (const code of ["{name}", "{{ count }}", "<b>", "</b>", "&amp;", "%s", "%1$d"]) expect(out).toContain(code)
    expect(out).not.toContain("Hello")
    expect(out).not.toContain("items")
  })

  test("a placeholder-only label stays usable", () => {
    expect(pseudoLocalize("{count}", { brackets: false })).toBe("{count}")
  })

  test("text without vowels still grows, at the end", () => {
    const out = pseudoLocalize("XML", { brackets: false, expand: 1 })
    expect(out).toBe("ẊṀĻ···")
  })

  test("custom and disabled markers; blank text is left alone", () => {
    expect(pseudoLocalize("Go", { expand: 0, brackets: ["⟦", "⟧"] })).toBe("⟦Ĝö⟧")
    expect(pseudoLocalize("Go", { expand: 0, brackets: false })).toBe("Ĝö")
    expect(pseudoLocalize("")).toBe("")
    expect(pseudoLocalize("  ")).toBe("  ")
  })

  test("deterministic", () => {
    expect(pseudoLocalize("Next page")).toBe(pseudoLocalize("Next page"))
  })
})

describe("mergeConfig pseudoLocale", () => {
  test("an inner config can turn it off again", () => {
    expect(mergeConfig({ pseudoLocale: true }, {}).pseudoLocale).toBe(true)
    expect(mergeConfig({ pseudoLocale: true }, { pseudoLocale: false }).pseudoLocale).toBe(false)
  })
})
