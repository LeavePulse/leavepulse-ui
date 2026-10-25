<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * LpSpotlight — a soft glow that follows the pointer inside whatever it wraps.
 *
 *   <LpSpotlight class="rounded-card"><MyTile /></LpSpotlight>
 *
 * For a grid of tiles the eye should scan with the mouse: the lit one is the
 * one about to be clicked, without a hover border shouting it. LpCard has the
 * same effect as its `spotlight` prop; reach for this wrapper around anything
 * that is not a card. Mouse only; reduced motion draws nothing. The glow is
 * painted by `.lp-spotlight` in tokens/effects.css.
 */
import { computed } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useSpotlight } from "../composables/useSpotlight"

const props = withDefaults(
  defineProps<{
    /** Any CSS colour. Defaults to the brand colour, so it follows the theme. */
    color?: string
    /** Diameter of the lit circle, in px. Larger reads as ambient, smaller as a torch. */
    size?: number
    /** How much of the colour mixes in, 0–100. Keep it low on text-heavy surfaces. */
    strength?: number
    /** Keep the wrapper but draw nothing — for a tile that is disabled or busy. */
    disabled?: boolean
    /** Element to render as. */
    as?: string
  }>(),
  { size: 280, strength: 18, disabled: false, as: "div" },
)

const { el } = useSpotlight({ disabled: () => props.disabled })
const { class: classes, attrs: rest } = useMergedAttrs(() => "lp-spotlight rounded-card")

const style = computed(() => ({
  "--lp-spot-size": `${props.size}px`,
  "--lp-spot-strength": `${Math.min(100, Math.max(0, props.strength))}%`,
  ...(props.color ? { "--lp-spot-color": props.color } : {}),
}))
</script>

<template>
  <component :is="as" ref="el" :class="classes" :style="style" v-bind="rest">
    <slot />
  </component>
</template>
