<script setup lang="ts">
// Single-value slider (reka Slider). reka models value as an array; we expose
// a plain number for the common single-thumb case. Themed via tokens.
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui"

const props = withDefaults(
  defineProps<{
    modelValue?: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
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
</script>

<template>
  <SliderRoot
    :model-value="[props.modelValue]"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    class="relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-55"
    @update:model-value="onUpdate"
    @value-commit="onCommit"
  >
    <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-pill bg-surface-soft">
      <SliderRange class="absolute h-full rounded-pill bg-brand" />
    </SliderTrack>
    <SliderThumb
      class="block size-4 rounded-pill border-2 border-brand bg-surface shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  </SliderRoot>
</template>
