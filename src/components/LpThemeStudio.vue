<script setup lang="ts">
import { usePaletteTheme } from "../theme/palette"
/*
 * The theme, tuned in place: a base theme, any brand colour, corners, control
 * size and motion speed, all applied live, and the result ready to take away
 * as code, JSON or CSS. State lives in useThemeStudio (remembered, shared with
 * an LpThemeSwitcher opened with `studio`), so the panel can sit in a popover,
 * a settings page or a drawer.
 *
 * An app adds its own rows through `#start` and `#end` (LpThemeStudioSection
 * gives them the panel's look) and drops built-in ones with `hide`.
 */
import { computed, h, ref, type FunctionalComponent } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { STUDIO_BRANDS, STUDIO_SYSTEM, useThemeStudio, type StudioState, type ThemeStudio } from "../theme/studio"
import type { TokenSet } from "../theme/tokens"
import type { RevealOrigin } from "../theme/useTheme"
import LpButton from "./LpButton.vue"
import LpCodeBlock from "./LpCodeBlock.vue"
import LpColorPicker from "./LpColorPicker.vue"
import LpIcon from "./LpIcon.vue"
import LpSegmented from "./LpSegmented.vue"
import LpDisclosure from "./LpDisclosure.vue"
import LpThemeProvider from "./LpThemeProvider.vue"
import LpThemeStudioSection from "./LpThemeStudioSection.vue"
import { withBrand } from "../theme/define"

export type ThemeStudioPart = "themes" | "brand" | "corners" | "size" | "motion" | "export"

export interface ThemeStudioLabels extends Record<string, string> {
  title: string
  reset: string
  themes: string
  system: string
  brand: string
  anyBrand: string
  corners: string
  sharp: string
  round: string
  size: string
  compact: string
  comfortable: string
  motion: string
  fast: string
  normal: string
  slow: string
  default: string
  export: string
}

const props = defineProps<{
  /** A studio from useThemeStudio; by default the shared one for `storageKey`. */
  studio?: ThemeStudio
  /** Base themes, when the panel makes its own studio. */
  themes?: TokenSet[]
  storageKey?: string
  /** Brand swatches offered beside the free colour picker. */
  brands?: string[]
  /** Built-in rows to leave out. */
  hide?: ThemeStudioPart[]
  labels?: Partial<ThemeStudioLabels>
}>()

const studio = props.studio ?? useThemeStudio({ themes: props.themes, storageKey: props.storageKey })
const { state, brand, changed, exported } = studio
// Assigned through the ref: a destructured binding assigned in the template
// would replace the local name, not write the studio's state.
const setBrand = (color: string) => (brand.value = color)

const text = useLabels<ThemeStudioLabels>(
  "themeStudio",
  {
    title: "Theme",
    reset: "Reset",
    themes: "Theme",
    system: "System",
    brand: "Brand colour",
    anyBrand: "Any brand colour",
    corners: "Corners",
    sharp: "Sharp",
    round: "Round",
    size: "Control size",
    compact: "Compact",
    comfortable: "Roomy",
    motion: "Motion",
    fast: "Fast",
    normal: "Normal",
    slow: "Slow",
    default: "Default",
    export: "Use this theme",
  },
  () => props.labels,
)

const shows = (part: ThemeStudioPart) => !props.hide?.includes(part)
const swatches = computed(() => props.brands ?? STUDIO_BRANDS)
const format = ref<"code" | "json" | "css">("code")

// A new base theme reveals from the swatch that picked it; Reset from itself.
function origin(event: Event): RevealOrigin | undefined {
  const r = (event.currentTarget as Element | null)?.getBoundingClientRect()
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined
}

const TILE =
  "group flex min-w-0 flex-col gap-1.5 text-left text-xs text-muted transition-colors duration-(--duration-fast) hover:text-ink aria-pressed:text-ink"
const FRAME = "relative block aspect-[8/5] w-full overflow-hidden rounded-control transition-[box-shadow] duration-(--duration-fast)"
const ring = (name: string) =>
  state.value.theme === name ? "ring-2 ring-brand" : "ring-1 ring-line group-hover:ring-line-strong"

/** A theme as it would look with the tuning picked here: the brand rides on whichever theme is chosen. */
const tuned = (theme: TokenSet): TokenSet => (state.value.brand ? withBrand(theme, state.value.brand) : theme)

// A window of the theme in miniature: its surfaces, text and a button in its
// brand. Painted through LpThemeProvider, so it shows the tokens as the app
// would, rather than a guess made from a few of them.
const Miniature: FunctionalComponent<{ theme: TokenSet }> = (p) =>
  h(LpThemeProvider, { theme: p.theme, class: "absolute inset-0 flex bg-surface" }, () => [
    h("span", { class: "h-full w-1/4 border-r border-line bg-surface-raised" }),
    h("span", { class: "flex min-w-0 flex-1 flex-col gap-[10%] p-[10%]" }, [
      h("span", { class: "h-[12%] w-3/4 rounded-full bg-ink/80" }),
      h("span", { class: "h-[10%] w-1/2 rounded-full bg-muted/60" }),
      h("span", { class: "mt-auto h-[24%] w-1/2 rounded-control bg-brand" }),
    ]),
  ])

const tuneTo = <K extends keyof Omit<StudioState, "theme">>(key: K, value: string) => studio.tune({ [key]: value } as Partial<StudioState>)

usePaletteTheme(() => studio ?? undefined, { hide: props.hide })
</script>

<template>
  <div class="@container flex flex-col gap-4">
    <!-- An app that titles the studio itself (a settings section) passes an
         empty title; the row then shows only while Reset has something to undo. -->
    <div v-if="text.title || changed" class="flex items-center justify-between">
      <p class="text-sm font-semibold text-ink">{{ text.title }}</p>
      <LpButton v-if="changed" variant="ghost" size="xs" @click="studio.reset(origin($event))">
        <LpIcon name="lucide:rotate-ccw" :size="12" />{{ text.reset }}
      </LpButton>
    </div>

    <slot name="start" :studio="studio" />

    <LpThemeStudioSection v-if="shows('themes')" :label="text.themes">
      <div class="grid grid-cols-3 gap-2 @md:grid-cols-4 @2xl:grid-cols-8">
        <!-- Follows the OS between its pair: both halves, split corner to corner. -->
        <button
          v-if="studio.system.value"
          type="button"
          :class="TILE"
          :aria-pressed="state.theme === STUDIO_SYSTEM"
          @click="studio.pickTheme(STUDIO_SYSTEM, origin($event))"
        >
          <span :class="[FRAME, ring(STUDIO_SYSTEM)]">
            <Miniature :theme="tuned(studio.system.value.light)" />
            <span class="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
              <Miniature :theme="tuned(studio.system.value.dark)" />
            </span>
          </span>
          <span class="max-w-full truncate">{{ text.system }}</span>
        </button>
        <button
          v-for="t in studio.themes.value"
          :key="t.name"
          type="button"
          :class="TILE"
          :aria-pressed="state.theme === t.name"
          @click="studio.pickTheme(t.name, origin($event))"
        >
          <span :class="[FRAME, ring(t.name)]"><Miniature :theme="tuned(t)" /></span>
          <span class="max-w-full truncate">{{ t.name }}</span>
        </button>
      </div>
    </LpThemeStudioSection>

    <LpThemeStudioSection v-if="shows('brand')" :label="text.brand">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="color in swatches"
          :key="color"
          type="button"
          class="size-6 rounded-full ring-2 ring-offset-2 ring-offset-surface-raised transition-[box-shadow,scale] duration-(--duration-fast) hover:scale-110"
          :class="brand === color ? 'ring-ink' : 'ring-transparent'"
          :style="{ background: color }"
          :aria-label="`${text.brand} ${color}`"
          :aria-pressed="brand === color"
          @click="setBrand(color)"
        />
        <LpColorPicker
          variant="swatch"
          size="sm"
          :selected="!swatches.includes(brand)"
          :swatches="[]"
          :model-value="brand"
          :aria-label="text.anyBrand"
          @update:model-value="setBrand"
        />
      </div>
    </LpThemeStudioSection>

    <div v-if="shows('corners') || shows('size') || shows('motion')" class="flex flex-col gap-1.5">
      <LpThemeStudioSection v-if="shows('corners')" inline :label="text.corners">
        <LpSegmented
          :model-value="state.corners"
          size="sm"
          :options="[{ value: 'sharp', label: text.sharp }, { value: 'default', label: text.default }, { value: 'round', label: text.round }]"
          @update:model-value="tuneTo('corners', $event)"
        />
      </LpThemeStudioSection>
      <LpThemeStudioSection v-if="shows('size')" inline :label="text.size">
        <LpSegmented
          :model-value="state.size"
          size="sm"
          :options="[{ value: 'compact', label: text.compact }, { value: 'default', label: text.default }, { value: 'comfortable', label: text.comfortable }]"
          @update:model-value="tuneTo('size', $event)"
        />
      </LpThemeStudioSection>
      <LpThemeStudioSection v-if="shows('motion')" inline :label="text.motion">
        <LpSegmented
          :model-value="state.motion"
          size="sm"
          :options="[{ value: 'fast', label: text.fast }, { value: 'normal', label: text.normal }, { value: 'slow', label: text.slow }]"
          @update:model-value="tuneTo('motion', $event)"
        />
      </LpThemeStudioSection>
    </div>

    <slot name="end" :studio="studio" />

    <!-- Taking the theme into code is the developer's errand, not the person
         picking colours: folded, it no longer opened every studio with an
         empty block of code. -->
    <LpDisclosure v-if="shows('export')">
      <template #trigger>
        <span class="text-xs font-medium text-muted-strong">{{ text.export }}</span>
      </template>
      <div class="flex flex-col gap-2 pt-1">
        <LpSegmented
          v-model="format"
          size="sm"
          class="self-start"
          :options="[{ value: 'code', label: 'Code' }, { value: 'json', label: 'JSON' }, { value: 'css', label: 'CSS' }]"
        />
        <LpCodeBlock
          :model-value="exported[format]"
          :lang="format === 'json' ? 'json' : format === 'css' ? 'plain' : 'ts'"
          copyable
          height="140px"
          class="text-[11px]"
        />
      </div>
    </LpDisclosure>
  </div>
</template>
