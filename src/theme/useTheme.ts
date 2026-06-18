/*
 * Theme engine. A theme is a TokenSet (plain JSON); applyTheme() writes it to
 * CSS variables at runtime so every kit component re-skins live. Includes an
 * anti-flash bootstrap (paint the cached theme before mount) and JSON
 * serialize/parse with validation.
 */
import {
  COLOR_VARS,
  DEFAULT_SURFACE,
  DENSITY_VARS,
  FONT_VARS,
  SHAPE_VARS,
  SURFACE_VARS,
  type ColorTokens,
  type DensityTokens,
  type FontTokens,
  type ShapeTokens,
  type SurfaceTokens,
  type TokenSet,
} from "./tokens"

const CACHE_KEY = "leavepulse-ui-theme"

export function applyTheme(theme: TokenSet, root: HTMLElement = document.documentElement): void {
  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    root.style.setProperty(cssVar, theme.colors[key as keyof ColorTokens])
  }
  for (const [key, cssVar] of Object.entries(SHAPE_VARS)) {
    root.style.setProperty(cssVar, `${theme.shape[key as keyof ShapeTokens]}px`)
  }
  for (const [key, cssVar] of Object.entries(DENSITY_VARS)) {
    root.style.setProperty(cssVar, `${theme.density[key as keyof DensityTokens]}px`)
  }
  for (const [key, cssVar] of Object.entries(FONT_VARS)) {
    root.style.setProperty(cssVar, theme.font[key as keyof FontTokens])
  }
  // Skin axis is optional; fall back to a flat default so themes saved before
  // it existed still paint correctly.
  const surface = theme.surface ?? DEFAULT_SURFACE
  for (const [key, cssVar] of Object.entries(SURFACE_VARS)) {
    root.style.setProperty(cssVar, surface[key as keyof SurfaceTokens])
  }
  root.dataset.themeMode = theme.mode
  root.style.colorScheme = theme.mode
}

export function serializeTheme(theme: TokenSet): string {
  return JSON.stringify(theme)
}

/*
 * Render a theme as CSS custom-property declarations (the body of a rule, e.g.
 * `--color-brand: #00bcff; …`). Same var mapping as applyTheme, so a server can
 * inline the theme into a <style> for the first paint while the client uses
 * applyTheme — no duplicated values, the TokenSet stays the single source.
 */
export function themeToCssVars(theme: TokenSet): string {
  const decls: string[] = []
  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    decls.push(`${cssVar}: ${theme.colors[key as keyof ColorTokens]}`)
  }
  for (const [key, cssVar] of Object.entries(SHAPE_VARS)) {
    decls.push(`${cssVar}: ${theme.shape[key as keyof ShapeTokens]}px`)
  }
  for (const [key, cssVar] of Object.entries(DENSITY_VARS)) {
    decls.push(`${cssVar}: ${theme.density[key as keyof DensityTokens]}px`)
  }
  for (const [key, cssVar] of Object.entries(FONT_VARS)) {
    decls.push(`${cssVar}: ${theme.font[key as keyof FontTokens]}`)
  }
  const surface = theme.surface ?? DEFAULT_SURFACE
  for (const [key, cssVar] of Object.entries(SURFACE_VARS)) {
    decls.push(`${cssVar}: ${surface[key as keyof SurfaceTokens]}`)
  }
  return decls.join("; ")
}

/** Render a theme as a complete CSS rule (default selector `:root`). */
export function themeToCssRule(theme: TokenSet, selector = ":root"): string {
  return `${selector} { color-scheme: ${theme.mode}; ${themeToCssVars(theme)}; }`
}

const DEFAULT_FONT = {
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
}

/** Parse + shallow-validate a theme JSON; throws on a malformed shape. */
export function parseTheme(json: string): TokenSet {
  const raw = JSON.parse(json) as Partial<TokenSet>
  if (!raw || typeof raw !== "object" || !raw.colors || !raw.shape || !raw.density) {
    throw new Error("Invalid theme: missing colors/shape/density")
  }
  // font is a newer axis — fill it in for configs saved before it existed.
  return { ...raw, font: raw.font ?? DEFAULT_FONT } as TokenSet
}

// ── anti-flash bootstrap ─────────────────────────────────────
// Call once before mount with your default theme; paints the cached theme (if
// any) synchronously so the first frame already matches the saved look.
export function bootstrapTheme(fallback: TokenSet): TokenSet {
  let theme = fallback
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) theme = parseTheme(cached)
  } catch {
    /* ignore, use fallback */
  }
  applyTheme(theme)
  return theme
}

export function cacheTheme(theme: TokenSet): void {
  try {
    localStorage.setItem(CACHE_KEY, serializeTheme(theme))
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function useTheme() {
  return {
    apply: (theme: TokenSet) => {
      applyTheme(theme)
      cacheTheme(theme)
    },
    serialize: serializeTheme,
    parse: parseTheme,
    bootstrap: bootstrapTheme,
  }
}
