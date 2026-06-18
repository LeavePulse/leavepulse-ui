<script setup lang="ts">
// Numeric input with stepper buttons (reka NumberField). Themed via tokens.
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui"
import LpIcon from "./LpIcon.vue"

defineProps<{
  // null = empty field (reka's native state); consumers that need a number
  // should default it themselves, the field doesn't invent a value.
  modelValue?: number | null
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>()

defineEmits<{ (e: "update:modelValue", value: number | null): void }>()
</script>

<template>
  <NumberFieldRoot
    :model-value="modelValue ?? undefined"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
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
      class="min-w-0 flex-1 bg-transparent text-center text-sm text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
    />
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
