import { parseColor, rgbToHex, type Rgb } from "../components/color"
import { presets } from "./presets"
import type { ColorTokens, DensityTokens, FontTokens, ShapeTokens, SurfaceTokens, TokenSet } from "./tokens"

/*
 * defineTheme — the public API for building app themes WITHOUT editing the kit.
 *
 * Consuming apps (a docs site, a console) own their themes; the kit only ships a
 * handful of neutral presets. Rather than copy a whole TokenSet to tweak two
 * colours, an app derives from a base and overrides just what differs:
 *
 *   import { defineTheme, violet } from "@leavepulse/ui"
 *
 *   export const brandDark = defineTheme(violet, {
 *     name: "Brand Dark",
 *     colors: { brand: "#7c3aed", brandHover: "#6d28d9" },
 *   })
 *
 * `base` is a TokenSet or the NAME of a built-in preset. Each axis
 * (colors/shape/density/font/surface) is shallow-merged over the base, so
 * partial overrides are enough. Pass the results straight to
 * <LpThemeSwitcher :themes="[...]"> — no kit change required.
 */

export interface ThemeOverrides {
  name?: string
  mode?: "dark" | "light"
  colors?: Partial<ColorTokens>
  shape?: Partial<ShapeTokens>
  density?: Partial<DensityTokens>
  font?: Partial<FontTokens>
  surface?: Partial<SurfaceTokens>
}

export function defineTheme(
  base: TokenSet | keyof typeof presets,
  overrides: ThemeOverrides = {},
): TokenSet {
  const src: TokenSet = typeof base === "string" ? presets[base] : base
  return {
    name: overrides.name ?? src.name,
    mode: overrides.mode ?? src.mode,
    colors: { ...src.colors, ...overrides.colors },
    shape: { ...src.shape, ...overrides.shape },
    density: { ...src.density, ...overrides.density },
    font: { ...src.font, ...overrides.font },
    surface: src.surface || overrides.surface
      ? { ...src.surface, ...overrides.surface } as SurfaceTokens
      : undefined,
  }
}

function luminance({ r, g, b }: Rgb): number {
  const lin = (n: number) => {
    const x = n / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const READABLE = 4.5

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
  a: 1,
})

// The text on a brand button keeps the theme's own colour while it still
// reads: the same token sits on the other accents too, and flipping it for a
// brand that did not need it would hurt them. Only a colour it cannot be read
// on gets dark or light text, whichever reads better.
function textOn(fill: Rgb, current: string): string {
  const now = parseColor(current)
  if (now && contrast(fill, now) >= READABLE) return current
  const dark = { r: 11, g: 15, b: 18, a: 1 }
  const light = { r: 255, g: 255, b: 255, a: 1 }
  return contrast(fill, dark) >= contrast(fill, light) ? "#0b0f12" : "#ffffff"
}

/**
 * A theme with one brand colour swapped in, and everything that follows from it
 * derived to match: the hover shade, the soft fill behind badges and selections,
 * the focus ring, and the text on a brand button where the theme's own no
 * longer reads. Lets an app offer "pick your colour" without the
 * person picking five shades that agree with each other.
 *
 *   applyTheme(withBrand(presets.dark, "#ff5ca8"))
 *
 * A colour it cannot read leaves the theme as it was.
 */
export function withBrand(base: TokenSet | keyof typeof presets, color: string): TokenSet {
  const src: TokenSet = typeof base === "string" ? presets[base] : base
  const rgb = parseColor(color)
  if (!rgb) return src
  const solid = { ...rgb, a: 1 }
  const dark = src.mode === "dark"
  const hover = mixRgb(solid, dark ? { r: 255, g: 255, b: 255, a: 1 } : { r: 0, g: 0, b: 0, a: 1 }, dark ? 0.12 : 0.1)
  const tint = (alpha: number) => `rgba(${solid.r}, ${solid.g}, ${solid.b}, ${alpha})`
  return defineTheme(src, {
    colors: {
      brand: rgbToHex(solid),
      brandHover: rgbToHex(hover),
      brandSoft: tint(dark ? 0.16 : 0.12),
      ring: tint(0.45),
      inkInverse: textOn(solid, src.colors.inkInverse),
    },
  })
}
