import { describe, expect, test } from "bun:test"
import * as presets from "../src/theme/presets"
import { dark, light, nord } from "../src/theme/presets"
import { normalizeTheme, parseTheme, revealTransition, themeEntries, themeFromCookie, themeToCssRule, useTheme } from "../src/theme/useTheme"

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

describe("parseTheme validation", () => {
  const base = { name: "x", mode: "light", colors: {}, shape: {}, density: {} }
  const parse = (extra: object) => parseTheme(JSON.stringify({ ...base, ...extra }))

  test("every built-in theme passes", () => {
    for (const theme of Object.values(presets)) {
      if (theme && typeof theme === "object" && "colors" in theme) {
        expect(parseTheme(JSON.stringify(theme)).name).toBe((theme as { name: string }).name)
      }
    }
  })

  test("rejects a size that is not a number in range", () => {
    expect(() => parse({ shape: { radiusCard: "huge" } })).toThrow("shape.radiusCard")
    expect(() => parse({ density: { spacingUnit: -100 } })).toThrow("density.spacingUnit")
    expect(() => parse({ density: { spacingUnit: 1e6 } })).toThrow("density.spacingUnit")
    expect(() => parse({ shape: { radiusCard: null } })).toThrow("shape.radiusCard")
  })

  test("rejects an unknown mode and an empty or overlong name", () => {
    expect(() => parse({ mode: "sepia" })).toThrow("mode")
    expect(() => parse({ name: " " })).toThrow("name")
    expect(() => parse({ name: "x".repeat(65) })).toThrow("name")
  })

  test("rejects a value that would leave its CSS declaration", () => {
    expect(() => parse({ colors: { brand: "red; } body { display: none" } })).toThrow("colors.brand")
    expect(() => parse({ colors: { brand: "</style><script>" } })).toThrow("colors.brand")
    expect(() => parse({ colors: { brand: "" } })).toThrow("colors.brand")
    expect(() => parse({ font: { sans: 12 } })).toThrow("font.sans")
    expect(() => parse({ surface: { panelOverlay: "url(a);}" } })).toThrow("surface.panelOverlay")
  })

  test("keeps real CSS values, a data url included", () => {
    const colors = { brand: "color-mix(in srgb, red 10%, transparent)" }
    expect(parse({ colors }).colors.brand).toBe(colors.brand)
    const panelOverlay = "url(data:image/png;base64,AAAA)"
    expect(parse({ surface: { panelOverlay } }).surface?.panelOverlay).toBe(panelOverlay)
  })
})

describe("themeFromCookie with encoded names", () => {
  const piped = { ...dark, name: "Night | blue" }

  test("a | in a name stays part of the name", () => {
    const value = `system:${encodeURIComponent(light.name)}|${encodeURIComponent(piped.name)}`
    expect(themeFromCookie(value, [light, piped])).toBe(piped)
    expect(themeFromCookie(encodeURIComponent(value), [light, piped], { prefersDark: false })).toBe(light)
  })

  test("a cookie written before the encoding still resolves", () => {
    expect(themeFromCookie(`system:${light.name}|${dark.name}`, [light, dark])).toBe(dark)
  })
})

describe("revealTransition", () => {
  function fakePage(ready: Promise<void>) {
    const animated: unknown[] = []
    const page = {
      defaultView: { innerWidth: 100, innerHeight: 100 },
      documentElement: { animate: (...args: unknown[]) => animated.push(args) },
      startViewTransition: (update: () => void) => (update(), { ready, finished: Promise.resolve() }),
    }
    return { page: page as unknown as Document, animated }
  }

  test("a skipped transition leaves no rejection and still updates", async () => {
    const unhandled: unknown[] = []
    const note = (reason: unknown) => unhandled.push(reason)
    process.on("unhandledRejection", note)
    const { page, animated } = fakePage(Promise.reject(new Error("skipped")))
    let updated = false
    revealTransition(() => void (updated = true), undefined, 100, page)
    await new Promise((resolve) => setTimeout(resolve, 10))
    process.off("unhandledRejection", note)
    expect(updated).toBe(true)
    expect(animated).toHaveLength(0)
    expect(unhandled).toHaveLength(0)
  })

  test("animates the document it was given, from the origin", async () => {
    const { page, animated } = fakePage(Promise.resolve())
    revealTransition(() => {}, { x: 10, y: 20 }, 100, page)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(animated).toHaveLength(1)
    expect(JSON.stringify(animated[0])).toContain("at 10px 20px")
  })
})

describe("useTheme on the server", () => {
  test("init keeps nothing between requests", () => {
    const theme = useTheme()
    expect(theme.init(dark)).toBe(dark)
    expect(theme.init(light)).toBe(light)
    expect(useTheme().current.value).toBeNull()
    expect(useTheme().currentName.value).toBe("")
  })
})
