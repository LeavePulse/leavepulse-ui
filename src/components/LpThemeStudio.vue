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
import { computed, ref } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { STUDIO_BRANDS, STUDIO_SYSTEM, useThemeStudio, type StudioState, type ThemeStudio } from "../theme/studio"
import type { TokenSet } from "../theme/tokens"
import type { RevealOrigin } from "../theme/useTheme"
import LpButton from "./LpButton.vue"
import LpCodeBlock from "./LpCodeBlock.vue"
import LpColorPicker from "./LpColorPicker.vue"
import LpIcon from "./LpIcon.vue"
import LpSegmented from "./LpSegmented.vue"
import LpThemeStudioSection from "./LpThemeStudioSection.vue"

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
  "flex min-w-0 flex-col items-center gap-1 rounded-control p-1.5 text-[11px] text-muted transition-colors duration-(--duration-fast) hover:bg-surface-soft hover:text-ink"
const SWATCH = "relative size-8 overflow-hidden rounded-full ring-2 transition-[box-shadow] duration-(--duration-fast)"

const tuneTo = <K extends keyof Omit<StudioState, "theme">>(key: K, value: string) => studio.tune({ [key]: value } as Partial<StudioState>)

usePaletteTheme(() => studio ?? undefined)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <p class="text-sm font-semibold text-ink">{{ text.title }}</p>
      <LpButton v-if="changed" variant="ghost" size="xs" @click="studio.reset(origin($event))">
        <LpIcon name="lucide:rotate-ccw" :size="12" />{{ text.reset }}
      </LpButton>
    </div>

    <slot name="start" :studio="studio" />

    <LpThemeStudioSection v-if="shows('themes')" :label="text.themes">
      <div class="grid grid-cols-4 gap-2">
        <!-- Follows the OS between its pair: drawn as both halves. -->
        <button
          v-if="studio.system.value"
          type="button"
          :class="[TILE, state.theme === STUDIO_SYSTEM && 'bg-surface-soft text-ink']"
          :aria-pressed="state.theme === STUDIO_SYSTEM"
          @click="studio.pickTheme(STUDIO_SYSTEM, origin($event))"
        >
          <span
            :class="[SWATCH, state.theme === STUDIO_SYSTEM ? 'ring-brand' : 'ring-line']"
            :style="{ background: `linear-gradient(135deg, ${studio.system.value.light.colors.surface} 50%, ${studio.system.value.dark.colors.surface} 50%)` }"
          />
          <span class="max-w-full truncate">{{ text.system }}</span>
        </button>
        <button
          v-for="t in studio.themes.value"
          :key="t.name"
          type="button"
          :class="[TILE, state.theme === t.name && 'bg-surface-soft text-ink']"
          :aria-pressed="state.theme === t.name"
          @click="studio.pickTheme(t.name, origin($event))"
        >
          <span :class="[SWATCH, state.theme === t.name ? 'ring-brand' : 'ring-line']" :style="{ background: t.colors.surface }">
            <span class="absolute inset-x-0 bottom-0 h-1/2" :style="{ background: t.colors.brand }" />
          </span>
          <span class="max-w-full truncate">{{ t.name }}</span>
        </button>
      </div>
    </LpThemeStudioSection>

    <LpThemeStudioSection v-if="shows('brand')" :label="text.brand">
      <div class="flex flex-wrap items-center gap-1.5">
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
        <LpColorPicker :model-value="brand" size="sm" :aria-label="text.anyBrand" @update:model-value="setBrand" />
      </div>
    </LpThemeStudioSection>

    <LpThemeStudioSection v-if="shows('corners')" :label="text.corners">
      <LpSegmented
        :model-value="state.corners"
        size="sm"
        :options="[{ value: 'sharp', label: text.sharp }, { value: 'default', label: text.default }, { value: 'round', label: text.round }]"
        @update:model-value="tuneTo('corners', $event)"
      />
    </LpThemeStudioSection>

    <LpThemeStudioSection v-if="shows('size')" :label="text.size">
      <LpSegmented
        :model-value="state.size"
        size="sm"
        :options="[{ value: 'compact', label: text.compact }, { value: 'default', label: text.default }, { value: 'comfortable', label: text.comfortable }]"
        @update:model-value="tuneTo('size', $event)"
      />
    </LpThemeStudioSection>

    <LpThemeStudioSection v-if="shows('motion')" :label="text.motion">
      <LpSegmented
        :model-value="state.motion"
        size="sm"
        :options="[{ value: 'fast', label: text.fast }, { value: 'normal', label: text.normal }, { value: 'slow', label: text.slow }]"
        @update:model-value="tuneTo('motion', $event)"
      />
    </LpThemeStudioSection>

    <slot name="end" :studio="studio" />

    <div v-if="shows('export')" class="flex flex-col gap-2 border-t border-line pt-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[11px] font-medium tracking-wide text-muted uppercase">{{ text.export }}</span>
        <LpSegmented
          v-model="format"
          size="sm"
          :options="[{ value: 'code', label: 'Code' }, { value: 'json', label: 'JSON' }, { value: 'css', label: 'CSS' }]"
        />
      </div>
      <LpCodeBlock
        :model-value="exported[format]"
        :lang="format === 'json' ? 'json' : format === 'css' ? 'plain' : 'ts'"
        copyable
        height="140px"
        class="text-[11px]"
      />
    </div>
  </div>
</template>
