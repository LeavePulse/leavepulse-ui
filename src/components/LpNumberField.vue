<script setup lang="ts">
// Numeric input with stepper buttons (reka NumberField). Themed via tokens.
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui"
import { useId } from "vue"
import LpIcon from "./LpIcon.vue"

defineProps<{
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
}>()

defineEmits<{ (e: "update:modelValue", value: number | null): void }>()

// The unit is described to the input rather than merely placed beside it: on
// screen the two read as one field, and without this a reader announces "380"
// and leaves out the milliamps that make it mean anything.
const unitId = useId()
</script>

<template>
  <NumberFieldRoot
    :model-value="modelValue ?? undefined"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    data-lp-ring-owner
    class="flex h-(--size-control-md) w-full items-center rounded-control border border-line bg-surface-soft transition-colors duration-[var(--duration-fast)] focus-within:border-brand focus-within:ring-2 focus-within:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55"
    @update:model-value="(v) => $emit('update:modelValue', v ?? null)"
  >
    <NumberFieldDecrement
      class="group grid h-full w-8 place-items-center text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink disabled:opacity-40"
    >
      <LpIcon
        name="lucide:minus"
        :size="15"
        class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:scale-75 motion-reduce:group-active:scale-100"
      />
    </NumberFieldDecrement>
    <NumberFieldInput
      :aria-describedby="unit ? unitId : undefined"
      class="min-w-0 flex-1 bg-transparent text-center text-sm text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
    <!-- The unit sits between the value and the increment button, so a long one
         narrows the field rather than covering the digits. Not focusable and
         not part of the value: it is read, never typed. -->
    <span v-if="unit" :id="unitId" class="shrink-0 pr-1 text-xs text-muted">{{ unit }}</span>
    <NumberFieldIncrement
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
