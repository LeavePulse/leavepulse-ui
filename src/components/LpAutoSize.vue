<script setup lang="ts">
/*
 * Wraps content whose size is derived from what's inside it, and eases the box
 * between sizes instead of letting it snap.
 *
 * Reach for it wherever a change of content changes a box's measurements: a
 * toolbar that gains or loses a button, a label swapped by a translation, a
 * placeholder replaced by the loaded thing, a panel switching between states.
 * Those all resize in a single frame otherwise, and everything they push moves
 * with them.
 *
 *   <LpAutoSize axis="width">
 *     <slot name="actions" />
 *   </LpAutoSize>
 *
 * Content is measured through a wrapper that is never itself pinned, so the
 * slot keeps whatever layout it brings (flex row, grid, plain text). `axis`
 * picks which dimension is content-derived: pin only the one that actually
 * moves, so the other stays free to respond to the surrounding layout.
 *
 * The mechanism — measure the natural size, pin it in pixels, tween — lives in
 * `useSizeTransition`, and LpModal drives its panel with the same composable.
 */
import { computed } from "vue"
import { useSizeTransition, type SizeAxis } from "../composables/useSizeTransition"

const props = withDefaults(
  defineProps<{
    /**
     * Which dimension eases. `"width"` for a row that gains/loses controls,
     * `"height"` for a stack whose content grows, `"both"` when either can.
     */
    axis?: SizeAxis
    /** Tween length in ms. Defaults to the kit's `--duration-fast`. */
    duration?: number
    /**
     * Turn the easing off entirely — the wrapper stays, the box resizes
     * instantly. For a box that is being driven by something else (a drag, a
     * canvas), where a tween would fight the thing already animating it.
     */
    disabled?: boolean
  }>(),
  { axis: "height", disabled: false },
)

const { el, tweening, resizing } = useSizeTransition({
  axis: () => props.axis,
  duration: () => props.duration,
  enabled: () => !props.disabled,
})

// Only the pinned axis is transitioned: naming the other one would animate a
// dimension the layout is still free to set, so a flex row settling into place
// would ease sideways for no reason.
//
// Spelled out as whole literals rather than built from `axis`. The consuming
// app's Tailwind scans this file as TEXT, so a class assembled at runtime is a
// class it never sees — the utility simply wouldn't be emitted.
const TRANSITION_CLASS: Record<SizeAxis, string> = {
  height: "transition-[height]",
  width: "transition-[width]",
  both: "transition-[height,width]",
}
const transitionClass = computed(() => TRANSITION_CLASS[props.axis])

defineExpose({ resizing })
</script>

<template>
  <!-- `overflow-hidden` only while a tween owns the size: the box is briefly
       smaller than the content it already holds, and without the clip that
       content spills past the easing edge. Dropped once settled, so nothing
       that legitimately overflows — a dropdown, a focus ring — is clipped at
       rest. -->
  <div
    ref="el"
    :class="[
      tweening && !disabled
        ? `${transitionClass} duration-fast ease-[var(--ease-emphasized)] motion-reduce:transition-none`
        : '',
      resizing ? 'overflow-hidden' : '',
    ]"
  >
    <slot :resizing="resizing" />
  </div>
</template>
