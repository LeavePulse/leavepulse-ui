/*
 * The site theme as the person tuned it: a preset plus brand colour, corners
 * and control size. One module so the studio panel and the palette's theme
 * rows change the same thing.
 */
import { computed, watch, watchEffect } from "vue"
import { defineTheme, presets, serializeTheme, themeToCssRule, usePersisted, useTheme, withBrand, type PresetName, type RevealOrigin } from "../src"

export const PRESETS = Object.keys(presets) as PresetName[]
export const BRANDS = ["#00bcff", "#7c5cff", "#ff5ca8", "#ff6b3d", "#f0b35a", "#c6ff3d", "#39e58c", "#2dd4bf"]
export const CORNERS = {
  sharp: { radiusControl: 3, radiusCard: 6 },
  default: {},
  round: { radiusControl: 12, radiusCard: 22 },
} as const
export const SIZES = {
  compact: { controlSm: 28, controlMd: 34, controlLg: 40 },
  default: {},
  comfortable: { controlSm: 36, controlMd: 42, controlLg: 48 },
} as const

export const MOTION = { fast: 0.6, normal: 1, slow: 1.8 } as const
const DURATIONS = { "--duration-fast": 160, "--duration-medium": 220, "--duration-slow": 320 }

export interface Studio {
  preset: PresetName
  brand: string | null
  corners: keyof typeof CORNERS
  size: keyof typeof SIZES
  motion?: keyof typeof MOTION
}
export const DEFAULT_STUDIO: Studio = { preset: "dark", brand: null, corners: "default", size: "default", motion: "normal" }

function build(s: Studio) {
  const base = defineTheme(presets[s.preset], { shape: CORNERS[s.corners], density: SIZES[s.size] })
  return s.brand ? withBrand(base, s.brand) : base
}

let shared: ReturnType<typeof create> | null = null

/** The one studio state of the site, made on first use. */
export function useStudio() {
  shared ??= create()
  return shared
}

function create() {
  const studio = usePersisted<Studio>("lp-preview-studio", DEFAULT_STUDIO, {
    validate: (v): v is Studio => !!v && typeof v === "object" && (v as Studio).preset in presets,
  })
  const kitTheme = useTheme()
  kitTheme.init(build(studio.value))

  // A preset is another theme and reveals from where it was picked. Colour,
  // corners and size tune the same one and apply at once, so a drag follows.
  function pickPreset(name: PresetName, origin?: RevealOrigin) {
    if (name === studio.value.preset) return
    studio.value = { ...studio.value, preset: name }
    kitTheme.setTheme(build(studio.value), origin)
  }
  function reset(origin?: RevealOrigin) {
    studio.value = { ...DEFAULT_STUDIO }
    kitTheme.setTheme(build(DEFAULT_STUDIO), origin)
  }
  watch(
    () => [studio.value.brand, studio.value.corners, studio.value.size],
    () => kitTheme.apply(build(studio.value)),
  )

  const brand = computed({
    get: () => studio.value.brand ?? presets[studio.value.preset].colors.brand,
    set: (value: string) => (studio.value = { ...studio.value, brand: value }),
  })
  const changed = computed(() => JSON.stringify(studio.value) !== JSON.stringify(DEFAULT_STUDIO))

  // Motion speed rescales the duration tokens, so every transition in the kit
  // runs faster or slower at once: the quickest way to see what animates.
  watchEffect(() => {
    const scale = MOTION[studio.value.motion ?? "normal"]
    for (const [name, ms] of Object.entries(DURATIONS)) {
      if (scale === 1) document.documentElement.style.removeProperty(name)
      else document.documentElement.style.setProperty(name, `${Math.round(ms * scale)}ms`)
    }
  })

  // The tuned theme as an app would take it: the code that builds it, the
  // JSON the kit stores, and the CSS rule for a page without the engine.
  const exported = computed(() => {
    const s = studio.value
    const overrides: string[] = []
    if (s.corners !== "default") overrides.push(`shape: ${JSON.stringify(CORNERS[s.corners])}`)
    if (s.size !== "default") overrides.push(`density: ${JSON.stringify(SIZES[s.size])}`)
    const base = overrides.length ? `defineTheme("${s.preset}", { ${overrides.join(", ")} })` : `"${s.preset}"`
    const theme = build(s)
    return {
      code: s.brand ? `withBrand(${base}, "${s.brand}")` : overrides.length ? base : `presets.${s.preset}`,
      json: serializeTheme(theme),
      css: themeToCssRule(theme),
    }
  })
  return { studio, brand, changed, exported, pickPreset, reset }
}
