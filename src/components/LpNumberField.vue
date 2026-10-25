<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
// Numeric input with stepper buttons (reka NumberField). Themed via tokens.
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui"
import { computed, useId } from "vue"
import LpIcon from "./LpIcon.vue"
import { useFieldControl } from "../composables/useField"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"

export interface NumberFieldLabels extends Record<string, string> {
  increase: string
  decrease: string
}

const props = withDefaults(defineProps<{
  // null = empty field (reka's native state); consumers that need a number
  // should default it themselves, the field doesn't invent a value.
  modelValue?: number | null
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  // The unit the number is in ("mm", "W", "mA"). It sits inside the field
  // rather than in the label, because a grid of bare boxes labelled "Width",
  // "Depth", "Weight" tells the reader nothing about which one wants grams.
  // Not part of the value: it is never typed, selected, or submitted.
  unit?: string
  invalid?: boolean
  /** Control height, matching LpInput. */
  size?: "sm" | "md" | "lg"
  labels?: Partial<NumberFieldLabels>
}>(), { size: "md" })

defineEmits<{ (e: "update:modelValue", value: number | null): void }>()

// The unit is described to the input rather than merely placed beside it: on
// screen the two read as one field, and without this a reader announces "380"
// and leaves out the milliamps that make it mean anything.
const unitId = useId()

// reka names the stepper buttons "Increase" / "Decrease" in English and nothing
// else; an aria-label on the button replaces its own.
const text = useLabels<NumberFieldLabels>(
  "numberField",
  { increase: "Increase", decrease: "Decrease" },
  () => props.labels,
)

const SIZE = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

const field = useFieldControl(() => ({ wrapped: false, invalid: props.invalid, disabled: props.disabled }))
const describedBy = computed(
  () => [field.value.describedBy, props.unit ? unitId : undefined].filter(Boolean).join(" ") || undefined,
)

// The field is full-width with its own control frame — the two things a consumer laying out a compact numeric column needs to change.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "flex w-full items-center rounded-control border bg-surface-soft transition-colors duration-[var(--duration-fast)] focus-within:ring-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55",
    SIZE[props.size],
    field.value.invalid
      ? "border-danger focus-within:border-danger focus-within:ring-danger-soft"
      : "border-line focus-within:border-brand focus-within:ring-ring",
  ].join(" "),
)
</script>

<template>
  <NumberFieldRoot
    :model-value="modelValue ?? undefined"
    :min="min"
    :max="max"
    :step="step"
    :disabled="field.disabled"
    :required="field.required"
    data-lp-ring-owner
    :class="rootClass"
    v-bind="rest"
    @update:model-value="(v) => $emit('update:modelValue', v ?? null)"
  >
    <NumberFieldDecrement
      :aria-label="text.decrease"
      class="group grid h-full w-8 place-items-center text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink disabled:opacity-40"
    >
      <LpIcon
        name="lucide:minus"
        :size="15"
        class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:scale-75 motion-reduce:group-active:scale-100"
      />
    </NumberFieldDecrement>
    <NumberFieldInput
      :id="field.id"
      :aria-describedby="describedBy"
      :aria-invalid="field.invalid || undefined"
      class="min-w-0 flex-1 bg-transparent text-center text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
    <!-- The unit sits between the value and the increment button, so a long one
         narrows the field rather than covering the digits. Not focusable and
         not part of the value: it is read, never typed. -->
    <span v-if="unit" :id="unitId" class="shrink-0 pr-1 text-xs text-muted">{{ unit }}</span>
    <NumberFieldIncrement
      :aria-label="text.increase"
      class="group grid h-full w-8 place-items-center text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink disabled:opacity-40"
    >
      <LpIcon
        name="lucide:plus"
        :size="15"
        class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:scale-75 motion-reduce:group-active:scale-100"
      />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
