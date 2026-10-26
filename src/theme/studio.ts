import { computed, ref, shallowRef, watch, watchEffect, type ComputedRef, type Ref } from "vue"
import { usePersisted } from "../composables/usePersisted"
import { defineTheme, withBrand } from "./define"
import { presets } from "./presets"
import type { TokenSet } from "./tokens"
import { serializeTheme, themeToCssRule, useTheme, type RevealOrigin } from "./useTheme"

/*
 * The theme as a person tunes it: a base theme plus a brand colour, corners,
 * control size and motion speed, remembered and applied live. The base list is
 * the app's themes (the kit's presets by default), the rest are the kit's
 * shape, density and duration tokens, so whatever an app themes with, the
 * studio tunes on top of it. LpThemeStudio is the panel for it and
 * LpThemeSwitcher opens that panel on right-click with `studio`; both share
 * one state per storage key, so the switcher's left-click and the panel's
 * picks change the same theme.
 */

export const STUDIO_BRANDS = ["#00bcff", "#7c5cff", "#ff5ca8", "#ff6b3d", "#f0b35a", "#c6ff3d", "#39e58c", "#2dd4bf"]
export const STUDIO_CORNERS = {
  sharp: { radiusControl: 3, radiusCard: 6 },
  default: {},
  round: { radiusControl: 12, radiusCard: 22 },
} as const
export const STUDIO_SIZES = {
  compact: { controlSm: 28, controlMd: 34, controlLg: 40 },
  default: {},
  comfortable: { controlSm: 36, controlMd: 42, controlLg: 48 },
} as const
export const STUDIO_MOTION = { fast: 0.6, normal: 1, slow: 1.8 } as const

/** The `theme` of a studio that follows the OS between its `system` pair. */
export const STUDIO_SYSTEM = "system"

export interface StudioState {
  /** Name of the base theme in the offered list, or STUDIO_SYSTEM. */
  theme: string
  /** Brand colour over the theme's own; null keeps the theme's. */
  brand: string | null
  corners: keyof typeof STUDIO_CORNERS
  size: keyof typeof STUDIO_SIZES
  motion: keyof typeof STUDIO_MOTION
}

export interface ThemeStudioOptions {
  /** Base themes to offer. Defaults to the kit's presets. */
  themes?: TokenSet[]
  /** Where the tuning is remembered. One state per key is shared by every caller. */
  storageKey?: string
  /**
   * Offer "System": the base theme follows the OS colour scheme between these
   * two (names from `themes`), with the tuning kept on top of either.
   */
  system?: { light: string; dark: string }
}

export interface ThemeStudio {
  state: Ref<StudioState>
  themes: ComputedRef<TokenSet[]>
  /** The light/dark pair "System" follows, when offered. */
  system: ComputedRef<{ light: TokenSet; dark: TokenSet } | null>
  /** The tuned theme as it is applied. */
  theme: ComputedRef<TokenSet>
  /** The brand in effect: the picked one, else the base theme's. */
  brand: Ref<string>
  /** Anything differs from the defaults. */
  changed: ComputedRef<boolean>
  /** The tuned theme as an app takes it: code that builds it, the stored JSON, a CSS rule. */
  exported: ComputedRef<{ code: string; json: string; css: string }>
  /** Another base theme, revealed from `origin`; brand, corners and size stay. */
  pickTheme(name: string, origin?: RevealOrigin): void
  /** Change the tuning (not the base theme): applied at once, so a drag follows. */
  tune(patch: Partial<Omit<StudioState, "theme">>): void
  reset(origin?: RevealOrigin): void
}

export interface PreviewableThemeStudio extends ThemeStudio {
  /** Build a draft for a scoped preview, without applying or persisting it. */
  preview(state: StudioState): { theme: TokenSet; exported: { code: string; json: string; css: string } }
}

const DURATIONS = ["--duration-fast", "--duration-medium", "--duration-slow"] as const
const studios = new Map<string, { config: Ref<Omit<ThemeStudioOptions, "storageKey">>; studio: PreviewableThemeStudio }>()

/**
 * The studio state for `storageKey`, made on first use and shared after. A
 * later caller's `themes` or `system` fill in what the first one left out:
 * the page may make the studio before the switcher that offers "System".
 */
export function useThemeStudio(options: ThemeStudioOptions = {}): PreviewableThemeStudio {
  const key = options.storageKey ?? "lp-theme-studio"
  let entry = studios.get(key)
  if (!entry) {
    const config = shallowRef<Omit<ThemeStudioOptions, "storageKey">>({})
    entry = { config, studio: create(key, config) }
    studios.set(key, entry)
  }
  const { themes, system } = entry.config.value
  if ((!themes && options.themes) || (!system && options.system)) {
    entry.config.value = { themes: themes ?? options.themes, system: system ?? options.system }
  }
  return entry.studio
}

function create(key: string, config: Ref<Omit<ThemeStudioOptions, "storageKey">>): PreviewableThemeStudio {
  const themes = computed(() => (config.value.themes?.length ? config.value.themes : Object.values(presets)))
  const system = computed(() => {
    const pair = config.value.system
    const light = pair && themes.value.find((t) => t.name === pair.light)
    const dark = pair && themes.value.find((t) => t.name === pair.dark)
    return light && dark ? { light, dark } : null
  })
  const prefersDark = ref(typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches)
  if (typeof window !== "undefined") {
    window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", (e) => (prefersDark.value = e.matches))
  }
  const engine = useTheme()
  const defaults = (): StudioState => ({
    theme: engine.currentName.value || themes.value[0]?.name || "",
    brand: null,
    corners: "default",
    size: "default",
    motion: "normal",
  })
  const initial = defaults()
  const state = usePersisted<StudioState>(key, initial, {
    validate: (v): v is StudioState => !!v && typeof v === "object" && typeof (v as StudioState).theme === "string",
  })

  const base = (s: StudioState): TokenSet => {
    if (s.theme === STUDIO_SYSTEM && system.value) return prefersDark.value ? system.value.dark : system.value.light
    return themes.value.find((t) => t.name === s.theme) ?? themes.value[0]!
  }
  function build(s: StudioState): TokenSet {
    const shaped = defineTheme(base(s), { shape: STUDIO_CORNERS[s.corners], density: STUDIO_SIZES[s.size] })
    return s.brand ? withBrand(shaped, s.brand) : shaped
  }
  const theme = computed(() => build(state.value))

  if (state.value.theme !== initial.theme || state.value.brand || state.value.corners !== "default" || state.value.size !== "default") {
    engine.apply(theme.value)
  }

  function pickTheme(name: string, origin?: RevealOrigin) {
    if (name === state.value.theme) return
    state.value = { ...state.value, theme: name }
    engine.setTheme(theme.value, origin)
  }
  function tune(patch: Partial<Omit<StudioState, "theme">>) {
    state.value = { ...state.value, ...patch }
  }
  function reset(origin?: RevealOrigin) {
    state.value = { ...initial }
    engine.setTheme(theme.value, origin)
  }
  // Compared as a string: an array getter is a new value on every state
  // change, so a theme pick also ran this and applied the new theme at once,
  // before the reveal could snapshot the old one, and the circle never showed.
  watch(
    () => `${state.value.brand}|${state.value.corners}|${state.value.size}`,
    () => engine.apply(theme.value),
  )
  // Following the OS: its switch reveals like a pick.
  watch(prefersDark, () => {
    if (state.value.theme === STUDIO_SYSTEM) engine.setTheme(theme.value)
  })
  // "System" restored before its pair was known applies once the pair is.
  watch(system, () => {
    if (state.value.theme === STUDIO_SYSTEM) engine.apply(theme.value)
  })

  const brand = computed({
    get: () => state.value.brand ?? base(state.value).colors.brand,
    set: (value: string) => tune({ brand: value }),
  })
  const changed = computed(() => JSON.stringify(state.value) !== JSON.stringify(initial))

  // Motion rescales the duration tokens from their stylesheet values, so every
  // transition in the kit runs faster or slower at once.
  if (typeof document !== "undefined") {
    watchEffect(() => {
      const scale = STUDIO_MOTION[state.value.motion ?? "normal"]
      const root = document.documentElement
      for (const name of DURATIONS) root.style.removeProperty(name)
      if (scale === 1) return
      const style = getComputedStyle(root)
      for (const name of DURATIONS) {
        const ms = parseFloat(style.getPropertyValue(name))
        if (Number.isFinite(ms)) root.style.setProperty(name, `${Math.round(ms * scale)}ms`)
      }
    })
  }

  function exportState(s: StudioState) {
    const built = build(s)
    const preset = Object.entries(presets).find(([, p]) => p.name === base(s).name)?.[0]
    const source = preset ? `"${preset}"` : "yourTheme"
    const overrides: string[] = []
    if (s.corners !== "default") overrides.push(`shape: ${JSON.stringify(STUDIO_CORNERS[s.corners])}`)
    if (s.size !== "default") overrides.push(`density: ${JSON.stringify(STUDIO_SIZES[s.size])}`)
    const shaped = overrides.length ? `defineTheme(${source}, { ${overrides.join(", ")} })` : source
    const code = s.brand ? `withBrand(${shaped}, "${s.brand}")` : overrides.length ? shaped : preset ? `presets.${preset}` : source
    return { code, json: serializeTheme(built), css: themeToCssRule(built) }
  }
  const exported = computed(() => exportState(state.value))
  const preview = (draft: StudioState) => ({ theme: build(draft), exported: exportState(draft) })

  return { state, themes, system, theme, brand, changed, exported, pickTheme, tune, reset, preview }
}
