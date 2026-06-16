/*
 * TokenSet — the serializable shape of a theme. A theme is just this object;
 * persist it as JSON (disk / config / server) and apply it at runtime with
 * useTheme().applyTheme(). camelCase keys map 1:1 to the CSS variables the kit
 * components read (see VAR_MAP).
 */

export interface ColorTokens {
  surface: string
  surfaceRaised: string
  surfaceSoft: string
  ink: string
  inkInverse: string
  muted: string
  mutedStrong: string
  brand: string
  brandHover: string
  brandSoft: string
  action: string
  actionHover: string
  accent: string
  danger: string
  dangerHover: string
  dangerSoft: string
  line: string
  lineStrong: string
  ring: string
}

export interface ShapeTokens {
  radiusControl: number
  radiusCard: number
  radiusPill: number
}

export interface DensityTokens {
  /** base spacing unit in px */
  spacingUnit: number
  controlSm: number
  controlMd: number
  controlLg: number
}

export interface FontTokens {
  /** CSS font-family stack for UI text */
  sans: string
  /** CSS font-family stack for numerals / code */
  mono: string
}

/*
 * Surface tokens — the "skin" axis. These describe how a raised panel/card is
 * painted, as plain CSS values so a flat look and a full glass look are the
 * same shape (just different values). Components reference the vars below
 * instead of hard-coding gradients/blur/shadows, so a skin is data, not CSS.
 *
 *   flat default:  overlay none, blur 0,  shadow soft,   inset none
 *   glass:         overlay gradient, blur 36px, layered shadow, inset highlight
 */
export interface SurfaceTokens {
  /** Border width for panels/cards/controls (CSS length, e.g. "1px"). */
  borderWidth: string
  /** backdrop-filter blur radius (CSS length; "0" disables glass blur). */
  panelBlur: string
  /** backdrop-filter saturate (unitless or %, e.g. "100%" / "180%"). */
  panelSaturate: string
  /** Overlay painted over a panel's base color ("none" or a gradient). */
  panelOverlay: string
  /** Box-shadow for a raised panel (may be multi-layer for glass). */
  panelShadow: string
  /** Inset highlight line for a panel ("none" or an inset box-shadow). */
  panelInset: string
}

export interface TokenSet {
  /** human label, e.g. "Lime" */
  name: string
  /** "dark" | "light" — drives `color-scheme` and the data-theme-mode hint */
  mode: "dark" | "light"
  colors: ColorTokens
  shape: ShapeTokens
  density: DensityTokens
  font: FontTokens
  /** Optional skin axis; older themes without it fall back to a flat default. */
  surface?: SurfaceTokens
}

/** camelCase token key → CSS custom property name. */
export const COLOR_VARS: Record<keyof ColorTokens, string> = {
  surface: "--color-surface",
  surfaceRaised: "--color-surface-raised",
  surfaceSoft: "--color-surface-soft",
  ink: "--color-ink",
  inkInverse: "--color-ink-inverse",
  muted: "--color-muted",
  mutedStrong: "--color-muted-strong",
  brand: "--color-brand",
  brandHover: "--color-brand-hover",
  brandSoft: "--color-brand-soft",
  action: "--color-action",
  actionHover: "--color-action-hover",
  accent: "--color-accent",
  danger: "--color-danger",
  dangerHover: "--color-danger-hover",
  dangerSoft: "--color-danger-soft",
  line: "--color-line",
  lineStrong: "--color-line-strong",
  ring: "--color-ring",
}

export const SHAPE_VARS: Record<keyof ShapeTokens, string> = {
  radiusControl: "--radius-control",
  radiusCard: "--radius-card",
  radiusPill: "--radius-pill",
}

export const DENSITY_VARS: Record<keyof DensityTokens, string> = {
  spacingUnit: "--spacing-unit",
  controlSm: "--size-control-sm",
  controlMd: "--size-control-md",
  controlLg: "--size-control-lg",
}

export const FONT_VARS: Record<keyof FontTokens, string> = {
  sans: "--font-sans",
  mono: "--font-mono",
}

export const SURFACE_VARS: Record<keyof SurfaceTokens, string> = {
  borderWidth: "--surface-border-width",
  panelBlur: "--surface-panel-blur",
  panelSaturate: "--surface-panel-saturate",
  panelOverlay: "--surface-panel-overlay",
  panelShadow: "--surface-panel-shadow",
  panelInset: "--surface-panel-inset",
}

/** Flat default skin for themes that don't ship a `surface` axis. */
export const DEFAULT_SURFACE: SurfaceTokens = {
  borderWidth: "1px",
  panelBlur: "0px",
  panelSaturate: "100%",
  panelOverlay: "none",
  panelShadow: "0 1px 2px rgba(0, 0, 0, 0.18)",
  panelInset: "none",
}
