import { describe, expect, test } from "bun:test"
import { presets } from "../src/theme/presets"
import { withBrand } from "../src/theme/define"

describe("withBrand", () => {
  test("derives the hover, soft fill, ring and the text on it from one colour", () => {
    const t = withBrand(presets.dark, "#ff5ca8")
    expect(t.colors.brand).toBe("#ff5ca8")
    expect(t.colors.brandHover).not.toBe("#ff5ca8")
    expect(t.colors.brandSoft).toBe("rgba(255, 92, 168, 0.16)")
    expect(t.colors.ring).toBe("rgba(255, 92, 168, 0.45)")
    expect(t.colors.action).toBe(presets.dark.colors.action)
  })

  test("the text on the button changes only where the theme's own does not read", () => {
    expect(withBrand("dark", "#ff5ca8").colors.inkInverse).toBe(presets.dark.colors.inkInverse)
    expect(withBrand("dark", "#1d3a8a").colors.inkInverse).toBe("#ffffff")
    expect(withBrand("dark", "#c6ff3d").colors.inkInverse).toBe(presets.dark.colors.inkInverse)
  })

  test("a colour it cannot read leaves the theme alone", () => {
    expect(withBrand(presets.light, "nope")).toBe(presets.light)
  })
})
