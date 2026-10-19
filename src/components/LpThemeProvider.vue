<script lang="ts">
// The last press anywhere on the page: a theme change triggered by a toggle
// reveals from the toggle the user just pressed.
const PRESS_FRESH_MS = 1500
let lastPress: { x: number; y: number; at: number } | null = null
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointerdown",
    (event) => (lastPress = { x: event.clientX, y: event.clientY, at: performance.now() }),
    { capture: true, passive: true },
  )
}

export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Applies a theme to a subtree instead of the whole page: a dark sidebar in a
 * light app, a live preview of a theme being edited, an embedded widget that
 * keeps its own look. Every token is declared on this element, derived ones
 * included, so kit components inside re-skin while the page around them keeps
 * the global theme. Nothing is persisted; this is presentation only.
 *
 * With `transition`, a change of `theme` repaints the subtree behind the same
 * circular reveal the global theme switch uses, growing from where the user
 * last pressed, or from the subtree's centre.
 */
import { computed, nextTick, ref, shallowRef, watch, type Component, type ComponentPublicInstance } from "vue"
import type { TokenSet } from "../theme/tokens"
import { revealTransition, themeEntries, type RevealOrigin } from "../theme/useTheme"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    theme: TokenSet
    /** Root element. A wrapper that should not affect layout can use `class="contents"`. */
    as?: string | Component
    /** Reveal a change of `theme` with the circular transition. */
    transition?: boolean
  }>(),
  { as: "div", transition: false },
)

// Paints its own surface and text so the scoped theme reads as one; a class
// like `bg-transparent` overrides that.
const { class: rootClass, attrs: rest } = useMergedAttrs("bg-surface text-ink")

const root = ref<HTMLElement | ComponentPublicInstance | null>(null)
const shown = shallowRef(props.theme)

const style = computed(() => ({
  ...Object.fromEntries(themeEntries(shown.value)),
  colorScheme: shown.value.mode,
}))

function originOf(): RevealOrigin | undefined {
  if (lastPress && performance.now() - lastPress.at < PRESS_FRESH_MS) return lastPress
  const value = root.value
  const el = value instanceof HTMLElement ? value : (value?.$el as Element | undefined)
  const box = el?.getBoundingClientRect?.()
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined
}

watch(
  () => props.theme,
  (next) => {
    if (!props.transition) {
      shown.value = next
      return
    }
    revealTransition(async () => {
      shown.value = next
      await nextTick()
    }, originOf())
  },
)
</script>

<template>
  <component :is="as" ref="root" :style="style" :data-theme-mode="shown.mode" :class="rootClass" v-bind="rest">
    <slot />
  </component>
</template>
