<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Applies a theme to a subtree instead of the whole page: a dark sidebar in a
 * light app, a live preview of a theme being edited, an embedded widget that
 * keeps its own look. Every token is declared on this element, derived ones
 * included, so kit components inside re-skin while the page around them keeps
 * the global theme. Nothing is persisted; this is presentation only.
 */
import { computed, type Component } from "vue"
import type { TokenSet } from "../theme/tokens"
import { themeEntries } from "../theme/useTheme"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    theme: TokenSet
    /** Root element. A wrapper that should not affect layout can use `class="contents"`. */
    as?: string | Component
  }>(),
  { as: "div" },
)

// Paints its own surface and text so the scoped theme reads as one; a class
// like `bg-transparent` overrides that.
const { class: rootClass, attrs: rest } = useMergedAttrs("bg-surface text-ink")

const style = computed(() => ({
  ...Object.fromEntries(themeEntries(props.theme)),
  colorScheme: props.theme.mode,
}))
</script>

<template>
  <component :is="as" :style="style" :data-theme-mode="theme.mode" :class="rootClass" v-bind="rest">
    <slot />
  </component>
</template>
