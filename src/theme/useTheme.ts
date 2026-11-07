/*
 * Theme engine. A theme is a TokenSet (plain JSON); applyTheme() writes it to
 * CSS variables at runtime so every kit component re-skins live. Includes an
 * anti-flash bootstrap (paint the cached theme before mount) and JSON
 * serialize/parse with validation.
 */
import { computed, readonly, shallowRef, type ComputedRef, type DeepReadonly, type Ref } from "vue"
import { easingToken, prefersReducedMotion } from "../composables/easing"
import { detectBackdropFilter } from "./backdrop"
import { dark as darkPreset, light as lightPreset } from "./presets"
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

/** A light/dark pair followed by the operating system's colour scheme. */
export interface SystemThemes {
  light: TokenSet
  dark: TokenSet
}

type Cached = { theme: TokenSet; system?: undefined } | { system: SystemThemes; theme?: undefined }

// ── self-managed theme state (singleton) ─────────────────────────────────
// The kit owns the active theme, like an i18n locale, so every consumer shares
// one source of truth. Lazily hydrated from the cache on the client; on the
// server `current` stays null and `init` writes nothing, because this module
// outlives a request and one visitor's theme must not reach the next. A server
// renders from `themeFromCookie` + `themeToCssRule`; the setters are client-only.
const _current = shallowRef<TokenSet | null>(null)
const _system = shallowRef<SystemThemes | null>(null)
let _hydrated = false
let _fallback: TokenSet | null = null

const DARK_QUERY = "(prefers-color-scheme: dark)"
let _media: MediaQueryList | null = null

/** Whether the OS asks for dark. True where it cannot be asked (server, old engines). */
export function prefersDarkScheme(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true
  return window.matchMedia(DARK_QUERY).matches || !window.matchMedia("(prefers-color-scheme: light)").matches
}

function pick(system: SystemThemes, dark = prefersDarkScheme()): TokenSet {
  return dark ? system.dark : system.light
}

function onSchemeChange(event: MediaQueryListEvent): void {
  const system = _system.value
  if (!system) return
  const theme = pick(system, event.matches)
  applyTheme(theme)
  _current.value = theme
}

function followSystem(system: SystemThemes | null): void {
  _system.value = system
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
  if (system && !_media) {
    _media = window.matchMedia(DARK_QUERY)
    _media.addEventListener("change", onSchemeChange)
  } else if (!system && _media) {
    _media.removeEventListener("change", onSchemeChange)
    _media = null
  }
}

function readCache(): Cached | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const raw = JSON.parse(cached) as { system?: { light?: unknown; dark?: unknown } }
    if (raw && typeof raw === "object" && raw.system) {
      return {
        system: {
          light: parseTheme(JSON.stringify(raw.system.light)),
          dark: parseTheme(JSON.stringify(raw.system.dark)),
        },
      }
    }
    return { theme: parseTheme(cached) }
  } catch {
    return null
  }
}

function hydrateOnce(): void {
  if (_hydrated || typeof window === "undefined") return
  _hydrated = true
  const cached = readCache()
  if (cached?.system) {
    followSystem(cached.system)
    _current.value = pick(cached.system)
    writeThemeCookie(systemCookieValue(cached.system))
  } else if (cached?.theme) {
    _current.value = cached.theme
    writeThemeCookie(cached.theme.name)
  } else if (_fallback) {
    _current.value = _fallback
  } else {
    return
  }
  applyTheme(_current.value)
}

/*
 * Tokens defined in terms of other tokens. A custom property holding `var()` is
 * resolved where it is declared, so the stylesheet's `:root` copies only ever
 * see the root theme. Re-declaring them next to a theme makes a theme applied
 * to a subtree (applyTheme(theme, el), themeToCssRule(theme, ".x")) carry them.
 */
const DERIVED_VARS: readonly (readonly [string, string])[] = [
  ["--color-surface-overlay", "color-mix(in srgb, var(--color-surface-raised) 94%, transparent)"],
  ["--color-node-compute", "var(--color-action)"],
  ["--color-node-transit", "var(--color-accent)"],
  ["--color-node-edge", "var(--color-brand)"],
  ["--color-node-unknown", "var(--color-line-strong)"],
]

/** Every CSS variable a theme sets, in application order. */
export function themeEntries(input: TokenSet): [string, string][] {
  const theme = normalizeTheme(input)
  const out: [string, string][] = []
  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    out.push([cssVar, theme.colors[key as keyof ColorTokens]])
  }
  for (const [key, cssVar] of Object.entries(SHAPE_VARS)) {
    out.push([cssVar, `${theme.shape[key as keyof ShapeTokens]}px`])
  }
  for (const [key, cssVar] of Object.entries(DENSITY_VARS)) {
    out.push([cssVar, `${theme.density[key as keyof DensityTokens]}px`])
  }
  for (const [key, cssVar] of Object.entries(FONT_VARS)) {
    out.push([cssVar, theme.font[key as keyof FontTokens]])
  }
  const surface = theme.surface ?? DEFAULT_SURFACE
  for (const [key, cssVar] of Object.entries(SURFACE_VARS)) {
    out.push([cssVar, surface[key as keyof SurfaceTokens]])
  }
  for (const [cssVar, value] of DERIVED_VARS) out.push([cssVar, value])
  return out
}

export function applyTheme(theme: TokenSet, root: HTMLElement = document.documentElement): void {
  for (const [cssVar, value] of themeEntries(theme)) root.style.setProperty(cssVar, value)
  root.dataset.themeMode = theme.mode
  root.style.colorScheme = theme.mode
  // Engine capability, not theme data — but this is the one path every consumer
  // already calls, so the glass fallback lands without extra wiring.
  detectBackdropFilter(root)
}

/** Point a circular theme reveal expands from (viewport px). */
export interface RevealOrigin {
  x: number
  y: number
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => { ready: Promise<void>; finished: Promise<void> }
}

/*
 * Run `update` behind a "circular reveal": a clip-path circle grows from
 * `origin` (viewport px, the centre when omitted) and shows the repainted page
 * underneath. Only what `update` changed looks different, so repainting one
 * subtree reveals just that subtree. Uses the View Transitions API and falls
 * back to a plain update when it's unsupported or the user prefers reduced
 * motion. `update` may be async (a framework flush); the snapshot waits for it.
 */
export function revealTransition(
  update: () => void | Promise<void>,
  origin?: RevealOrigin,
  durationMs = 480,
  page: Document = document,
): void {
  const doc = page as ViewTransitionDocument
  const win = page.defaultView ?? window
  if (typeof doc.startViewTransition !== "function" || prefersReducedMotion(win)) {
    void update()
    return
  }

  const x = origin?.x ?? win.innerWidth / 2
  const y = origin?.y ?? win.innerHeight / 2
  // Radius that reaches the farthest viewport corner from the origin.
  const endRadius = Math.hypot(
    Math.max(x, win.innerWidth - x),
    Math.max(y, win.innerHeight - y),
  )

  const transition = doc.startViewTransition(update)
  /*
   * `ready` rejects when there will be nothing to animate: a newer transition
   * replaced this one (the browser skips it by itself, and its `update` still
   * runs, so quick switches land in order) or the page went hidden. An `update`
   * that throws still reports, through `finished`.
   */
  const skipped = () => {}
  transition.ready.then(() => {
    // Animate the OLD snapshot shrinking to a point, revealing the (already
    // repainted) live page underneath through the growing hole. Clipping the
    // old layer — not growing the new one — avoids a one-frame flash of the new
    // theme before the circle starts, which read as the theme "changing twice".
    // The pseudo-elements belong to the document element whatever was updated,
    // so the animation always targets it.
    page.documentElement.animate(
      {
        clipPath: [`circle(${endRadius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`],
      },
      {
        duration: durationMs,
        easing: easingToken("ease-emphasized", undefined, page),
        // Hold the fully-shrunk circle after the keyframes end. Without it the
        // old snapshot snaps back to its default (un-clipped) state for the one
        // frame between animation-end and the browser tearing down the
        // view-transition pseudo-elements — that flash is the old theme
        // "blinking" at the very end.
        fill: "forwards",
        pseudoElement: "::view-transition-old(root)",
      },
    )
  }, skipped)
}

/*
 * Apply a theme with the circular reveal, usually from the toggle button's
 * centre. `root` scopes the theme to a subtree; the reveal still runs on the
 * document, since that is where the transition snapshots live.
 */
export function applyThemeWithTransition(
  theme: TokenSet,
  origin?: RevealOrigin,
  root: HTMLElement = document.documentElement,
  durationMs = 480,
): void {
  revealTransition(() => applyTheme(theme, root), origin, durationMs, root.ownerDocument)
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
  return themeEntries(theme)
    .map(([cssVar, value]) => `${cssVar}: ${value}`)
    .join("; ")
}

/** Render a theme as a complete CSS rule (default selector `:root`). */
export function themeToCssRule(theme: TokenSet, selector = ":root"): string {
  return `${selector} { color-scheme: ${theme.mode}; ${themeToCssVars(theme)}; }`
}

/*
 * Fill every axis a theme leaves out from the built-in preset of the same mode.
 * Themes are stored by consumers and live longer than a kit version: a theme
 * saved before a token existed would otherwise write `undefined` into that
 * variable and blank out every utility that reads it.
 */
export function normalizeTheme(raw: Partial<TokenSet> & { name?: string }): TokenSet {
  const mode = raw.mode === "light" ? "light" : "dark"
  const base = mode === "light" ? lightPreset : darkPreset
  return {
    name: typeof raw.name === "string" ? raw.name : base.name,
    mode,
    colors: { ...base.colors, ...raw.colors },
    shape: { ...base.shape, ...raw.shape },
    density: { ...base.density, ...raw.density },
    font: { ...base.font, ...raw.font },
    surface: raw.surface ? { ...DEFAULT_SURFACE, ...raw.surface } : undefined,
  }
}

const THEME_NAME_MAX = 64
/* Past the 9999 a pill radius is spelt with: beyond that a size is a typo, not a design. */
const THEME_SIZE_MAX = 99_999
/* A value goes into a stylesheet as text (themeToCssRule), so it must not be able to leave its declaration. */
const CSS_BREAKOUT = /[{}<>]/
const CSS_URL = /url\([^()]*\)/g

function cssValueProblem(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "must be a non-empty string"
  // A `;` belongs inside a data: url, and nowhere else in a value.
  if (CSS_BREAKOUT.test(value) || value.replace(CSS_URL, "").includes(";")) return "is not a single CSS value"
  return null
}

function sizeProblem(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return "must be a finite number"
  if (value < 0 || value > THEME_SIZE_MAX) return `must be between 0 and ${THEME_SIZE_MAX}`
  return null
}

function axisProblem(
  axis: string,
  values: unknown,
  keys: object,
  check: (value: unknown) => string | null,
): string | null {
  if (values === undefined) return null
  if (!values || typeof values !== "object") return `${axis} must be an object`
  for (const key of Object.keys(keys)) {
    const value = (values as Record<string, unknown>)[key]
    if (value === undefined) continue
    const problem = check(value)
    if (problem) return `${axis}.${key} ${problem}`
  }
  return null
}

/*
 * What is wrong with a theme read from storage or a file, or null. Types stop
 * at the JSON boundary: `radiusCard: "huge"` would reach the page as `hugepx`.
 * A token that is simply missing is fine: normalizeTheme fills it, which is how
 * a theme saved before that token existed keeps working.
 */
export function themeProblem(raw: Partial<TokenSet>): string | null {
  const { name, mode } = raw as { name?: unknown; mode?: unknown }
  if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > THEME_NAME_MAX)) {
    return `name must be 1 to ${THEME_NAME_MAX} characters`
  }
  if (mode !== undefined && mode !== "light" && mode !== "dark") return 'mode must be "light" or "dark"'
  return (
    axisProblem("colors", raw.colors, COLOR_VARS, cssValueProblem) ??
    axisProblem("shape", raw.shape, SHAPE_VARS, sizeProblem) ??
    axisProblem("density", raw.density, DENSITY_VARS, sizeProblem) ??
    axisProblem("font", raw.font, FONT_VARS, cssValueProblem) ??
    axisProblem("surface", raw.surface, SURFACE_VARS, cssValueProblem)
  )
}

/** Parse + validate a theme JSON; throws on a malformed shape or a bad token value. */
export function parseTheme(json: string): TokenSet {
  const raw = JSON.parse(json) as Partial<TokenSet>
  if (!raw || typeof raw !== "object" || !raw.colors || !raw.shape || !raw.density) {
    throw new Error("Invalid theme: missing colors/shape/density")
  }
  const problem = themeProblem(raw)
  if (problem) throw new Error(`Invalid theme: ${problem}`)
  return normalizeTheme(raw)
}

// ── anti-flash bootstrap ─────────────────────────────────────
// Call once before mount with your default theme; paints the cached theme (if
// any) synchronously so the first frame already matches the saved look.
export function bootstrapTheme(fallback: TokenSet): TokenSet {
  const cached = typeof window === "undefined" ? null : readCache()
  const theme = cached?.system ? pick(cached.system) : (cached?.theme ?? fallback)
  if (cached?.system) followSystem(cached.system)
  if (typeof document !== "undefined") applyTheme(theme)
  return theme
}

export function cacheTheme(theme: TokenSet): void {
  try {
    localStorage.setItem(CACHE_KEY, serializeTheme(theme))
  } catch {
    /* storage unavailable, non-fatal */
  }
  writeThemeCookie(theme.name)
}

/** Persist "follow the OS" with the pair it switches between. */
export function cacheSystemThemes(system: SystemThemes): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ system }))
  } catch {
    /* storage unavailable, non-fatal */
  }
  writeThemeCookie(systemCookieValue(system))
}

/*
 * SSR handoff. localStorage is invisible to the server, so the theme NAME rides
 * along in a cookie and the server resolves it against the themes it knows
 * (see themeFromCookie). "Follow the OS" is stored as `system:<light>|<dark>`,
 * each name encoded on its own so a `|` in a name stays part of that name.
 */
export const THEME_COOKIE = "lp-theme"
const SYSTEM_PREFIX = "system:"

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function systemCookieValue(system: SystemThemes): string {
  return `${SYSTEM_PREFIX}${encodeURIComponent(system.light.name)}|${encodeURIComponent(system.dark.name)}`
}

function writeThemeCookie(value: string): void {
  if (typeof document === "undefined") return
  document.cookie =
    `${THEME_COOKIE}=${encodeURIComponent(value)}` +
    `; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Resolve a theme name (as read from the `lp-theme` cookie) against a set of
 * known themes. Returns `null` when the name is absent or unknown, so the caller
 * can fall back to its own default.
 *
 * Accepts both a raw and an already-decoded value: frameworks differ on whether
 * their cookie helpers decode, and a name containing `%` must not throw.
 * A "follow the OS" cookie resolves to its dark member unless `prefersDark` is
 * false (pass it from the `Sec-CH-Prefers-Color-Scheme` request header).
 */
export function themeFromCookie(
  cookieValue: string | null | undefined,
  themes: readonly TokenSet[],
  options: { prefersDark?: boolean } = {},
): TokenSet | null {
  if (!cookieValue) return null
  const find = (name: string) => themes.find((theme) => theme.name === name) ?? null
  for (const value of [cookieValue, safeDecode(cookieValue)]) {
    if (value.startsWith(SYSTEM_PREFIX)) {
      const [lightName = "", darkName = ""] = value.slice(SYSTEM_PREFIX.length).split("|")
      const wanted = options.prefersDark === false ? lightName : darkName
      // Raw too: a cookie from before the names were encoded.
      const found = find(safeDecode(wanted)) ?? find(wanted)
      if (found) return found
      continue
    }
    const found = find(value)
    if (found) return found
  }
  return null
}

export interface UseTheme {
  /** The active theme, kept in sync by the kit. Null until hydrated (SSR/first
   *  paint), reactive, so a switcher binds straight to it. */
  current: DeepReadonly<Ref<TokenSet | null>>
  /** The active theme's name (""="not yet hydrated"). */
  currentName: ComputedRef<string>
  /** True while the theme follows the OS colour scheme (see setSystem). */
  system: ComputedRef<boolean>
  /** Set + persist a theme (with the circular reveal). Stops following the OS. */
  setTheme: (theme: TokenSet, origin?: RevealOrigin) => void
  /**
   * Follow the OS colour scheme, switching between `themes.light` and
   * `themes.dark` as it changes. Persisted like any other choice.
   */
  setSystem: (themes: SystemThemes, origin?: RevealOrigin) => void
  /** Seed the fallback (used when nothing is cached) and hydrate now. */
  init: (fallback: TokenSet) => TokenSet
  apply: (theme: TokenSet) => void
  applyWithTransition: (theme: TokenSet, origin?: RevealOrigin) => void
  serialize: typeof serializeTheme
  parse: typeof parseTheme
  bootstrap: typeof bootstrapTheme
}

export function useTheme(): UseTheme {
  hydrateOnce()

  const commit = (theme: TokenSet) => {
    followSystem(null)
    cacheTheme(theme)
    _current.value = theme
  }

  return {
    current: readonly(_current),
    currentName: computed(() => _current.value?.name ?? ""),
    system: computed(() => _system.value !== null),
    setTheme: (theme, origin) => {
      applyThemeWithTransition(theme, origin)
      commit(theme)
    },
    setSystem: (themes, origin) => {
      const theme = pick(themes)
      applyThemeWithTransition(theme, origin)
      followSystem(themes)
      cacheSystemThemes(themes)
      _current.value = theme
    },
    init: (fallback: TokenSet) => {
      if (typeof window === "undefined") return fallback
      _fallback = fallback
      hydrateOnce()
      if (!_current.value) _current.value = bootstrapTheme(fallback)
      return _current.value
    },
    apply: (theme: TokenSet) => {
      applyTheme(theme)
      commit(theme)
    },
    applyWithTransition: (theme: TokenSet, origin?: RevealOrigin) => {
      applyThemeWithTransition(theme, origin)
      commit(theme)
    },
    serialize: serializeTheme,
    parse: parseTheme,
    bootstrap: bootstrapTheme,
  }
}
