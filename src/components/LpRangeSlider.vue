<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Two thumbs on one track: a range rather than a value. A price "from – to",
 * a stretch of a clip to loop, a span of years. The model is `[low, high]`;
 * the thumbs cannot cross, and `minGap` keeps them that many units apart.
 * Each thumb can carry a label above it (`format`), shown while it is hovered,
 * focused or dragged, so the numbers are readable without a second readout.
 */
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui"
import { useFieldControl } from "../composables/useField"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    modelValue?: [number, number]
    min?: number
    max?: number
    step?: number
    /** The least distance the two ends keep between them, in model units. */
    minGap?: number
    disabled?: boolean
    /** Accessible names for the two thumbs when there's no visible label. */
    ariaLabels?: [string, string]
    /** Label over each thumb while it is in use: `(value) => "1:05"`. */
    format?: (value: number) => string
  }>(),
  { modelValue: () => [0, 100], min: 0, max: 100, step: 1, minGap: 0 },
)

const emit = defineEmits<{
  // fires live while dragging
  (e: "update:modelValue", value: [number, number]): void
  // fires once on release (reka valueCommit) — for commit-vs-preview splits
  (e: "change", value: [number, number]): void
}>()

function pair(v: number[] | undefined): [number, number] | null {
  return v && v.length >= 2 ? [v[0]!, v[1]!] : null
}
function onUpdate(v: number[] | undefined) {
  const value = pair(v)
  if (value) emit("update:modelValue", value)
}
function onCommit(v: number[] | undefined) {
  const value = pair(v)
  if (value) emit("change", value)
}

const field = useFieldControl(() => ({ wrapped: false, disabled: props.disabled }))

const { class: rootClass, attrs: rest } = useMergedAttrs(
  "relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-55",
)

const thumbClass =
  "group/thumb relative block size-4 rounded-pill border-2 border-brand bg-surface shadow outline-none transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
const labelClass =
  "pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 translate-y-0.5 rounded-control bg-surface-raised px-1.5 py-0.5 text-[11px] whitespace-nowrap text-ink tabular-nums opacity-0 shadow-sm transition-[opacity,translate] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-hover/thumb:translate-y-0 group-hover/thumb:opacity-100 group-focus-visible/thumb:translate-y-0 group-focus-visible/thumb:opacity-100 group-active/thumb:translate-y-0 group-active/thumb:opacity-100 motion-reduce:transition-none"
</script>

<template>
  <SliderRoot
    :model-value="[props.modelValue[0], props.modelValue[1]]"
    :min="min"
    :max="max"
    :step="step"
    :min-steps-between-thumbs="Math.round(minGap / step)"
    :disabled="field.disabled"
    :class="rootClass"
    v-bind="rest"
    @update:model-value="onUpdate"
    @value-commit="onCommit"
  >
    <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-pill bg-surface-soft">
      <SliderRange class="absolute h-full rounded-pill bg-brand" />
    </SliderTrack>
    <SliderThumb
      v-for="index in [0, 1] as const"
      :key="index"
      :id="index === 0 ? field.id : undefined"
      :aria-label="ariaLabels?.[index]"
      :aria-labelledby="ariaLabels ? undefined : field.labelId"
      :aria-describedby="field.describedBy"
      :class="thumbClass"
    >
      <span v-if="format" :class="labelClass">{{ format(props.modelValue[index]) }}</span>
    </SliderThumb>
  </SliderRoot>
</template>
