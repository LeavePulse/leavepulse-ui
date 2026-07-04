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
