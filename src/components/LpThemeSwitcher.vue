<script setup lang="ts">
/*
 * Theme switcher. The kit convention for theming, so consumers stop hand-rolling
 * their own. Default behaviour mirrors LeaveHosting: LEFT-click cycles to the
 * next theme in the list (with the circular-reveal transition from the click
 * point); RIGHT-click opens a menu to pick any theme directly. Fully data-driven
 * and configurable — pass your own `themes`, bind `v-model` to the active name,
 * and pick how the trigger looks.
 *
 * Applying + caching goes through useTheme() so every kit component re-skins live
 * and the choice survives a reload (anti-flash bootstrap). The component never
 * fetches; it just drives the theme engine.
 */
import { computed, onMounted } from "vue"
import { presets } from "../theme/presets"
import type { TokenSet } from "../theme/tokens"
import { useTheme } from "../theme/useTheme"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Active theme NAME (v-model). Falls back to the first theme. */
    modelValue?: string
    /** Themes to offer. Defaults to all built-in presets. */
    themes?: TokenSet[]
    /**
     * Trigger style:
     *  - "swatch" (default): a square showing the active theme's brand colour.
     *  - "icon": a sun/moon icon following the active theme's mode.
     *  - "pill": swatch + the theme name in a pill (always shows the label).
     */
    variant?: "swatch" | "icon" | "pill"
    /** Show the active theme's name next to the trigger (forced on for "pill"). */
    showLabel?: boolean
    /**
     * Default theme applied on mount when nothing is cached yet — the theme NAME
     * (must be in `themes`) or a TokenSet. Lets a consuming app pick its default
     * declaratively (<LpThemeSwitcher :default="'Violet'">) with no separate
     * bootstrap plugin; a previously saved choice still wins over it.
     */
    default?: string | TokenSet
    /** Animate theme changes with the circular reveal. On by default. */
    transition?: boolean
    size?: "sm" | "md" | "lg"
    "aria-label"?: string
  }>(),
  {
    variant: "swatch",
    transition: true,
    size: "md",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", name: string): void
  (e: "change", theme: TokenSet): void
}>()

const theme = useTheme()

const list = computed<TokenSet[]>(() =>
  props.themes && props.themes.length ? props.themes : Object.values(presets),
)
// Active theme name: an explicit modelValue wins (controlled use); otherwise the
// kit's self-managed `currentName` (so a consumer needs NO ref/bootstrap — the
// kit remembers the theme like an i18n locale). Falls back to the first theme.
const activeName = computed(
  () => props.modelValue ?? (theme.currentName.value || list.value[0]?.name || ""),
)
const active = computed<TokenSet | undefined>(
  () => list.value.find((t) => t.name === activeName.value) ?? list.value[0],
)

// Apply the consumer's default on mount when nothing is cached yet. init()
// hydrates from the cache first (a saved choice wins), so this only takes effect
// on a first visit / cleared storage. Resolving a name goes through the offered
// list, so <LpThemeSwitcher :default="'Violet'"> just works.
onMounted(() => {
  if (props.default == null) return
  const fallback =
    typeof props.default === "string"
      ? list.value.find((t) => t.name === props.default)
      : props.default
  if (fallback) theme.init(fallback)
})

const SIZES = { sm: "size-7", md: "size-8", lg: "size-9" } as const
const ICON_SIZE = { sm: 15, md: 16, lg: 18 } as const

const wantsLabel = computed(() => props.showLabel || props.variant === "pill")

// Apply a theme through the kit's self-managed setter (it persists + updates
// the shared `current`), then notify. The reveal animates from the click point.
function applyTheme(t: TokenSet, ev?: MouseEvent) {
  if (props.transition) {
    theme.setTheme(t, ev ? { x: ev.clientX, y: ev.clientY } : undefined)
  } else {
    theme.apply(t)
  }
  emit("update:modelValue", t.name)
  emit("change", t)
}

// Left-click → next theme in the list (wraps), revealing from the click point.
function cycle(ev: MouseEvent) {
  const arr = list.value
  if (!arr.length) return
  const i = arr.findIndex((t) => t.name === activeName.value)
  const next = arr[(i + 1) % arr.length]
  if (next) applyTheme(next, ev)
}

// Right-click menu: every theme, the active one checked. A circular-reveal from
// the (saved) click point isn't available here, so the menu picks reveal from
// the trigger centre via applyWithTransition's default origin.
const menu = computed<ContextMenuItemDef[]>(() =>
  list.value.map((t) => ({
    label: t.name,
    icon:
      t.name === activeName.value
        ? "lucide:check"
        : t.mode === "dark"
          ? "lucide:moon"
          : "lucide:sun",
    onSelect: () => applyTheme(t),
  })),
)

const triggerLabel = computed(
  () => props["aria-label"] ?? `Theme: ${activeName.value}. Click to switch, right-click to choose.`,
)
</script>

<template>
  <LpContextMenu :items="menu">
    <button
      type="button"
      :aria-label="triggerLabel"
      :title="triggerLabel"
      class="inline-flex items-center gap-2 rounded-control border border-line bg-surface-raised px-1.5 text-ink outline-none transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ring"
      :class="wantsLabel ? 'py-1 pr-2.5' : ''"
      @click="cycle"
    >
      <!-- swatch: brand over surface, hinting the theme at a glance -->
      <span
        v-if="variant !== 'icon'"
        class="grid shrink-0 place-items-center rounded-control border border-line/60"
        :class="SIZES[size]"
        :style="{ background: active?.colors.surface }"
      >
        <span
          class="size-3 rounded-full"
          :style="{ background: active?.colors.brand }"
        />
      </span>
      <!-- icon: sun/moon by mode -->
      <span v-else class="grid shrink-0 place-items-center" :class="SIZES[size]">
        <LpIcon
          :name="active?.mode === 'dark' ? 'lucide:moon' : 'lucide:sun'"
          :size="ICON_SIZE[size]"
        />
      </span>

      <span v-if="wantsLabel" class="text-sm font-medium">{{ activeName }}</span>
    </button>
  </LpContextMenu>
</template>
