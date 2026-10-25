<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * LpGlowBorder — a gradient that runs round the edge of whatever it wraps.
 *
 *   <LpGlowBorder><LpCard>Recommended build</LpCard></LpGlowBorder>
 *
 * For the ONE item in a list that should be noticed first: a new release, the
 * recommended option. Several glowing borders on one screen cancel each other
 * out, so this is a highlight, not a style.
 *
 * Pure CSS (`.lp-glow-border` in tokens/effects.css): a conic gradient whose
 * angle is an animated registered property. Without @property support (older
 * WebKitGTK) the ring stays still as a static gradient border, and reduced
 * motion stops it the same way. The ring takes no layout space: it sits just
 * outside the wrapped element's edge, following `rounded-card` by default —
 * pass a radius class matching the child if it is not a card.
 */
import { computed } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    /** Leading colour of the gradient. Defaults to the brand colour. */
    from?: string
    /** Trailing colour of the gradient. Defaults to the action colour. */
    to?: string
    /** Ring thickness in px. */
    width?: number
    /** Seconds per revolution. Slower reads as calm, faster as urgent. */
    speed?: number
    /**
     * Light the ring. Off keeps the wrapper (so the layout does not change when
     * an item stops being "new") and removes only the ring.
     */
    active?: boolean
    /** Element to render as. */
    as?: string
  }>(),
  { width: 1.5, speed: 4, active: true, as: "div" },
)

const { class: classes, attrs: rest } = useMergedAttrs(() => "lp-glow-border rounded-card")

const style = computed(() => ({
  "--lp-glow-width": `${props.width}px`,
  "--lp-glow-speed": `${props.speed}s`,
  ...(props.from ? { "--lp-glow-from": props.from } : {}),
  ...(props.to ? { "--lp-glow-to": props.to } : {}),
}))
</script>

<template>
  <component :is="as" :class="classes" :style="style" :data-lp-glow-off="active ? undefined : ''" v-bind="rest">
    <slot />
  </component>
</template>
