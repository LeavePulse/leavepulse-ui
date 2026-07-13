<script setup lang="ts">
/*
 * LpTilt — a tactile 3D-tilt wrapper. Its slot content rotates toward the
 * pointer and lifts on hover (see useTilt), so any element — a card, a stat
 * tile, a floating island illustration — gains hand-held depth by wrapping it.
 *
 *   <LpTilt :max="12" :lift="14" glare>
 *     <LpCard>…</LpCard>
 *   </LpTilt>
 *
 * The wrapper owns the `perspective` stage; the inner element is what actually
 * tilts, so sibling content outside the wrapper is unaffected. Honors reduced
 * motion (falls back to a flat, still element).
 */
import { computed } from "vue"
import { useTilt } from "../composables/useTilt"

const props = withDefaults(
  defineProps<{
    /** Max rotation toward the pointer, in degrees. */
    max?: number
    /** Upward lift on hover, in px. */
    lift?: number
    /** Scale on hover. */
    scale?: number
    /** Render a pointer-tracking glare highlight over the content. */
    glare?: boolean
    /** Perspective depth for the 3D stage, in px. Lower = stronger. */
    perspective?: number
  }>(),
  { max: 10, lift: 8, scale: 1.03, glare: false, perspective: 900 },
)

const tilt = useTilt({
  max: props.max,
  lift: props.lift,
  scale: props.scale,
  glare: props.glare,
})

const stageStyle = computed(() => ({ perspective: `${props.perspective}px` }))
</script>

<template>
  <div :style="stageStyle" class="lp-tilt-stage">
    <div
      class="lp-tilt-inner relative"
      :style="tilt.style.value"
      @pointermove="tilt.onPointerMove"
      @pointerenter="tilt.onPointerEnter"
      @pointerleave="tilt.onPointerLeave"
    >
      <slot />
      <div
        v-if="glare"
        class="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-overlay"
        :style="tilt.glareStyle.value"
      />
    </div>
  </div>
</template>
