import { describe, expect, test } from "bun:test"
import { dark, light, nord } from "../src/theme/presets"
import { normalizeTheme, parseTheme, themeEntries, themeFromCookie, themeToCssRule } from "../src/theme/useTheme"

describe("parseTheme", () => {
  test("fills tokens a theme saved by an older version lacks", () => {
    const { actionSoft: _a, accentSoft: _b, ...oldColors } = light.colors
    const saved = JSON.stringify({ ...light, name: "Old", colors: oldColors, font: undefined })
    const theme = parseTheme(saved)
    expect(theme.colors.actionSoft).toBe(light.colors.actionSoft)
    expect(theme.colors.accentSoft).toBe(light.colors.accentSoft)
    expect(theme.font).toEqual(light.font)
    expect(theme.name).toBe("Old")
  })

  test("takes the defaults from the preset of the same mode", () => {
    const theme = normalizeTheme({ mode: "dark", colors: {} as never, shape: {} as never, density: {} as never })
    expect(theme.colors.surface).toBe(dark.colors.surface)
  })

  test("never writes undefined into a variable", () => {
    const theme = parseTheme(JSON.stringify({ name: "x", mode: "light", colors: {}, shape: {}, density: {} }))
    for (const [, value] of themeEntries(theme)) expect(value).not.toContain("undefined")
  })

  test("rejects a theme without its axes", () => {
    expect(() => parseTheme(JSON.stringify({ name: "x" }))).toThrow()
  })
})

describe("themeFromCookie", () => {
  const themes = [dark, light, nord, { ...nord, name: "100% Dark" }]

  test("accepts raw and decoded values", () => {
    expect(themeFromCookie("Nord", themes)?.name).toBe("Nord")
    expect(themeFromCookie(encodeURIComponent("100% Dark"), themes)?.name).toBe("100% Dark")
    expect(themeFromCookie("100% Dark", themes)?.name).toBe("100% Dark")
  })

  test("does not throw on a malformed escape", () => {
    expect(themeFromCookie("%E0%A4%A", themes)).toBeNull()
  })

  test("resolves a follow-the-OS cookie by the colour scheme hint", () => {
    const value = encodeURIComponent(`system:${light.name}|${dark.name}`)
    expect(themeFromCookie(value, themes)?.name).toBe(dark.name)
    expect(themeFromCookie(value, themes, { prefersDark: false })?.name).toBe(light.name)
  })

  test("unknown names fall back to null", () => {
    expect(themeFromCookie("Nope", themes)).toBeNull()
    expect(themeFromCookie(undefined, themes)).toBeNull()
  })
})

describe("scoped themes", () => {
  test("carry the derived tokens with them", () => {
    const rule = themeToCssRule(light, ".panel")
    expect(rule).toContain("--color-surface-overlay: color-mix(")
    expect(rule).toContain("--color-node-edge: var(--color-brand)")
  })
})
