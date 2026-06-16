import type { TokenSet } from "./tokens"

/*
 * Built-in theme presets — plain TokenSet objects (JSON). These ARE the themes;
 * there are no [data-theme] CSS rules. Apps ship these, let users tweak them,
 * and persist the result as JSON.
 */

const sharedShape = { radiusControl: 8, radiusCard: 14, radiusPill: 9999 }
const sharedDensity = { spacingUnit: 4, controlSm: 32, controlMd: 38, controlLg: 44 }
const interFont = {
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
}

export const dark: TokenSet = {
  name: "Dark",
  mode: "dark",
  colors: {
    surface: "#080b0d",
    surfaceRaised: "#12171d",
    surfaceSoft: "#172027",
    ink: "#eef5f1",
    inkInverse: "#06100b",
    muted: "#9aa8a2",
    mutedStrong: "#c7d2cc",
    brand: "#00bcff",
    brandHover: "#19c6ff",
    brandSoft: "rgba(0, 188, 255, 0.16)",
    action: "#39e58c",
    actionHover: "#4dffa1",
    accent: "#f0b35a",
    danger: "#ff6f6f",
    dangerHover: "#ff8585",
    dangerSoft: "rgba(255, 111, 111, 0.14)",
    line: "rgba(255, 255, 255, 0.1)",
    lineStrong: "rgba(255, 255, 255, 0.18)",
    ring: "rgba(0, 188, 255, 0.45)",
  },
  shape: { ...sharedShape },
  density: { ...sharedDensity },
  font: { ...interFont },
}

export const light: TokenSet = {
  name: "Light",
  mode: "light",
  colors: {
    surface: "#f6f8f7",
    surfaceRaised: "#ffffff",
    surfaceSoft: "#eceff0",
    ink: "#0d1714",
    inkInverse: "#f8fff9",
    muted: "#5d6b65",
    mutedStrong: "#34433d",
    brand: "#0086c7",
    brandHover: "#0095db",
    brandSoft: "rgba(0, 134, 199, 0.12)",
    action: "#1f9d5f",
    actionHover: "#23b06b",
    accent: "#aa6f1d",
    danger: "#c2333b",
    dangerHover: "#d23b44",
    dangerSoft: "rgba(194, 51, 59, 0.12)",
    line: "rgba(13, 23, 20, 0.12)",
    lineStrong: "rgba(13, 23, 20, 0.22)",
    ring: "rgba(0, 134, 199, 0.4)",
  },
  shape: { ...sharedShape },
  density: { ...sharedDensity },
  font: { ...interFont },
}

export const lime: TokenSet = {
  name: "Lime",
  mode: "dark",
  colors: {
    surface: "#050505",
    surfaceRaised: "#0c0d0a",
    surfaceSoft: "#14160f",
    ink: "#f4f7ee",
    inkInverse: "#0a0c05",
    muted: "#8b8f80",
    mutedStrong: "#c3c8b6",
    brand: "#c4f042",
    brandHover: "#d2ff5c",
    brandSoft: "rgba(196, 240, 66, 0.14)",
    action: "#c4f042",
    actionHover: "#d2ff5c",
    accent: "#c4f042",
    danger: "#ff6f6f",
    dangerHover: "#ff8585",
    dangerSoft: "rgba(255, 111, 111, 0.14)",
    line: "rgba(255, 255, 255, 0.08)",
    lineStrong: "rgba(196, 240, 66, 0.3)",
    ring: "rgba(196, 240, 66, 0.4)",
  },
  // a sharper theme — overrides the shape axis too
  shape: { radiusControl: 4, radiusCard: 6, radiusPill: 4 },
  density: { ...sharedDensity },
  // a distinct typeface so the theme has its own voice (not just colour)
  font: {
    sans: '"Space Grotesk", "Inter", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  },
}

export const presets = { dark, light, lime } as const
export type PresetName = keyof typeof presets
