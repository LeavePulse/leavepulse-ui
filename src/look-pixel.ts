/*
 * The pixel look: a retro, terminal-flavoured style in one import.
 *
 *   import { pixelLook, pixelTheme } from "@leavepulse/ui/look-pixel"
 *   app.use(lpConfig({ look: pixelLook }))
 *   useTheme().setTheme(pixelTheme)       // optional: the look's own palette
 *
 * The look draws lucide names with pixelarticons where a pair exists (the rest
 * stay lucide), moves in steps instead of curves, and makes LpLoader a grid,
 * LpProgress an ascii bar and LpShaderBackdrop a dithered field unless a
 * component is told otherwise. It is its own entry so the pixel icons (about
 * 100 KB) only reach apps that use it.
 *
 * pixelTheme is the palette it was drawn against: near-black greys, a light
 * monochrome brand, square corners. The look works over any theme; the theme
 * is separate so an app can keep its colours and take only the drawing.
 */
import type { Look } from "./looks/look"
import { PIXEL_ICON_MAP, PIXEL_ICONS } from "./looks/pixel-icons"
import { defineTheme } from "./theme/define"
import { dark } from "./theme/presets"
import type { TokenSet } from "./theme/tokens"

export const pixelLook: Look = {
  name: "pixel",
  icons: { prefix: "pixelarticons", map: PIXEL_ICON_MAP, collection: PIXEL_ICONS },
  motion: "stepped",
  loader: "grid",
  progress: "ascii",
  backdrop: "dither",
}

export const pixelTheme: TokenSet = defineTheme(dark, {
  name: "Pixel",
  colors: {
    surface: "#0a0a0a",
    surfaceRaised: "#141414",
    surfaceSoft: "#1c1c1c",
    ink: "#ededed",
    inkInverse: "#0a0a0a",
    muted: "#8f8f8f",
    mutedStrong: "#bdbdbd",
    brand: "#e8e8e8",
    brandHover: "#ffffff",
    brandSoft: "rgba(232, 232, 232, 0.12)",
    line: "rgba(255, 255, 255, 0.08)",
    lineStrong: "rgba(255, 255, 255, 0.16)",
    ring: "rgba(232, 232, 232, 0.4)",
  },
  shape: { radiusControl: 2, radiusCard: 4 },
  font: { mono: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace' },
})

export type { Look }
