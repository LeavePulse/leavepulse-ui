<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
// Single-value slider (reka Slider). reka models value as an array; we expose
// a plain number for the common single-thumb case. Themed via tokens.
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    modelValue?: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    /** Accessible name for the thumb when there's no visible label. */
    ariaLabel?: string
  }>(),
  { modelValue: 0, min: 0, max: 100, step: 1 },
)

const emit = defineEmits<{
  // fires live while dragging
  (e: "update:modelValue", value: number): void
  // fires once on release (reka valueCommit) — for commit-vs-preview splits
  (e: "change", value: number): void
}>()

function onUpdate(v: number[] | undefined) {
  if (v && v.length) emit("update:modelValue", v[0])
}
function onCommit(v: number[] | undefined) {
  if (v && v.length) emit("change", v[0])
}

// A slider is full-width by default; putting one in a toolbar means constraining it, and a fixed h-5 has to yield to a denser row.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-55",
)
</script>

<template>
  <SliderRoot
    :model-value="[props.modelValue]"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :class="rootClass"
    v-bind="rest"
    @update:model-value="onUpdate"
    @value-commit="onCommit"
  >
    <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-pill bg-surface-soft">
      <SliderRange class="absolute h-full rounded-pill bg-brand" />
    </SliderTrack>
    <SliderThumb
      :aria-label="ariaLabel"
      class="block size-4 rounded-pill border-2 border-brand bg-surface shadow outline-none transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
    />
  </SliderRoot>
</template>
