<script lang="ts">
// The consumer's `class` is merged into the track's own rather than appended.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * The line between two steps, filled once the step it leaves is behind.
 * Internal: LpStepper and LpPipeline both draw it, and it was two copies of
 * the same track, fill and transition that had started to drift apart.
 *
 * The fill grows from the step it leaves towards the next one (scaled, so it
 * eases on the compositor), which reads as moving forward. `flowing` runs a
 * light along the empty line: the step is running and the work is on its way
 * to the next. Thickness and margins are the caller's, through `class`.
 */
import { computed } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    filled: boolean
    orientation?: "horizontal" | "vertical"
    /** The fill's colour class: what the travelled part says (passed, skipped, done). */
    fill?: string
    flowing?: boolean
  }>(),
  { orientation: "horizontal", fill: "bg-brand", flowing: false },
)

const across = computed(() => props.orientation === "horizontal")

const { class: trackClass, attrs: rest } = useMergedAttrs(() =>
  `relative flex-1 overflow-hidden rounded-pill bg-line ${across.value ? "h-0.5" : "w-0.5"}`,
)
</script>

<template>
  <span :class="trackClass" aria-hidden="true" v-bind="rest">
    <span
      class="absolute inset-0 transition-[scale,background-color] duration-(--duration-slow) ease-(--ease-emphasized) motion-reduce:transition-none"
      :class="[
        fill,
        across ? 'origin-left rtl:origin-right' : 'origin-top',
        filled ? (across ? 'scale-x-100' : 'scale-y-100') : across ? 'scale-x-0' : 'scale-y-0',
      ]"
    />
    <span
      v-if="flowing"
      class="lp-sweep absolute from-transparent via-brand to-transparent [--sweep-to:200%]"
      :class="across ? 'inset-y-0 left-0 w-1/2 bg-linear-to-r' : 'lp-sweep--y inset-x-0 top-0 h-1/2 bg-linear-to-b'"
    />
  </span>
</template>
