import type { SurfaceTokens, TokenSet } from "./tokens"

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
    action: "#5fd97a",
    actionHover: "#74e88d",
    accent: "#ffb84d",
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

/*
 * Glass skin — frosted panels with backdrop blur, a faint top-down highlight
 * overlay, a layered drop shadow and an inset highlight line. Opt a theme into
 * it by setting its `surface` axis to this (the LeavePulse site uses it).
 */
const glassSurface: SurfaceTokens = {
  borderWidth: "1px",
  panelBlur: "10px",
  panelSaturate: "120%",
  panelOverlay:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.01))",
  panelShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
  panelInset: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
}

/*
 * LeavePulse site theme — the colours the website shipped before the kit
 * migration (deep navy surfaces, cyan brand, teal accent), with the glass skin.
 * Distinct from `dark` (which is a near-black neutral) so the site keeps its
 * look when it switches its CSS-var dictionary over to the kit.
 */
export const leavepulse: TokenSet = {
  name: "LeavePulse",
  mode: "dark",
  colors: {
    surface: "#020618",
    surfaceRaised: "#0b1222",
    surfaceSoft: "rgba(11, 18, 34, 0.7)",
    ink: "#f3f6ff",
    inkInverse: "#0b1222",
    muted: "#94a3bf",
    mutedStrong: "#cad5e2",
    brand: "#00bcff",
    brandHover: "#19c3ff",
    brandSoft: "rgba(0, 188, 255, 0.2)",
    action: "#44c2ad",
    actionHover: "#56d3be",
    accent: "#d36a2c",
    danger: "#f87171",
    dangerHover: "#fca5a5",
    dangerSoft: "rgba(248, 113, 113, 0.14)",
    line: "#1c2740",
    lineStrong: "rgba(255, 255, 255, 0.15)",
    ring: "rgba(0, 188, 255, 0.35)",
  },
  shape: { ...sharedShape, radiusControl: 12 },
  density: { ...sharedDensity },
  font: {
    sans: '"Inter", "IBM Plex Sans", "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
  },
  surface: glassSurface,
}

export const rose: TokenSet = {
  name: "Rose",
  mode: "dark",
  colors: {
    surface: "#120a0d",
    surfaceRaised: "#1c1014",
    surfaceSoft: "#26161b",
    ink: "#fdeef1",
    inkInverse: "#1a0d11",
    muted: "#a98a92",
    mutedStrong: "#d8c0c6",
    brand: "#fb7185",
    brandHover: "#fd8a9b",
    brandSoft: "rgba(251, 113, 133, 0.14)",
    action: "#34d399",
    actionHover: "#4adeaa",
    accent: "#fbbf24",
    danger: "#ef4444",
    dangerHover: "#f56565",
    dangerSoft: "rgba(239, 68, 68, 0.14)",
    line: "rgba(255, 255, 255, 0.1)",
    lineStrong: "rgba(251, 113, 133, 0.3)",
    ring: "rgba(251, 113, 133, 0.4)",
  },
  shape: { ...sharedShape },
  density: { ...sharedDensity },
  font: { ...interFont },
}

export const amber: TokenSet = {
  name: "Amber",
  mode: "dark",
  colors: {
    surface: "#0f0b06",
    surfaceRaised: "#1a130a",
    surfaceSoft: "#241a0e",
    ink: "#fdf3e6",
    inkInverse: "#1a1206",
    muted: "#a3927a",
    mutedStrong: "#d6c6ad",
    brand: "#f59e0b",
    brandHover: "#fbb024",
    brandSoft: "rgba(245, 158, 11, 0.14)",
    action: "#4ade80",
    actionHover: "#5cea90",
    accent: "#38bdf8",
    danger: "#f87171",
    dangerHover: "#fa8a8a",
    dangerSoft: "rgba(248, 113, 113, 0.14)",
    line: "rgba(255, 255, 255, 0.1)",
    lineStrong: "rgba(245, 158, 11, 0.3)",
    ring: "rgba(245, 158, 11, 0.4)",
  },
  shape: { ...sharedShape },
  density: { ...sharedDensity },
  font: { ...interFont },
}

export const violet: TokenSet = {
  name: "Violet",
  mode: "dark",
  colors: {
    surface: "#0c0a14",
    surfaceRaised: "#15111f",
    surfaceSoft: "#1d1729",
    ink: "#f1eefb",
    inkInverse: "#100b1a",
    muted: "#948aa9",
    mutedStrong: "#c6bedb",
    brand: "#a78bfa",
    brandHover: "#b69dfc",
    brandSoft: "rgba(167, 139, 250, 0.14)",
    action: "#34d399",
    actionHover: "#4adeaa",
    accent: "#fbbf24",
    danger: "#f87171",
    dangerHover: "#fa8a8a",
    dangerSoft: "rgba(248, 113, 113, 0.14)",
    line: "rgba(255, 255, 255, 0.1)",
    lineStrong: "rgba(167, 139, 250, 0.3)",
    ring: "rgba(167, 139, 250, 0.4)",
  },
  shape: { ...sharedShape },
  density: { ...sharedDensity },
  font: { ...interFont },
}

export const nord: TokenSet = {
  name: "Nord",
  mode: "dark",
  colors: {
    surface: "#2e3440",
    surfaceRaised: "#3b4252",
    surfaceSoft: "#434c5e",
    ink: "#eceff4",
    inkInverse: "#2e3440",
    muted: "#9aa4b8",
    mutedStrong: "#d8dee9",
    brand: "#88c0d0",
    brandHover: "#9bccd9",
    brandSoft: "rgba(136, 192, 208, 0.16)",
    action: "#a3be8c",
    actionHover: "#b3cb9f",
    accent: "#ebcb8b",
    danger: "#bf616a",
    dangerHover: "#cb727b",
    dangerSoft: "rgba(191, 97, 106, 0.16)",
    line: "rgba(236, 239, 244, 0.1)",
    lineStrong: "rgba(136, 192, 208, 0.35)",
    ring: "rgba(136, 192, 208, 0.45)",
  },
  shape: { ...sharedShape },
  density: { ...sharedDensity },
  font: { ...interFont },
}

export const presets = { dark, light, lime, leavepulse, rose, amber, violet, nord } as const
export type PresetName = keyof typeof presets
