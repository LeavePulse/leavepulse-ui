<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from "reka-ui"

defineProps<{
  modelValue?: boolean
  disabled?: boolean
  label?: string
  id?: string
  name?: string
}>()
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
  (e: "change", value: boolean): void
}>()

function onUpdate(v: boolean | "indeterminate") {
  const checked = v === true
  emit("update:modelValue", checked)
  emit("change", checked)
}
</script>

<template>
  <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
    <CheckboxRoot
      :id="id"
      :name="name"
      :model-value="modelValue"
      :disabled="disabled"
      class="flex size-[18px] items-center justify-center rounded-[5px] border border-line-strong bg-surface-soft outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
      @update:model-value="onUpdate"
    >
      <CheckboxIndicator class="text-xs leading-none text-ink-inverse">✓</CheckboxIndicator>
    </CheckboxRoot>
    <slot>{{ label }}</slot>
  </label>
</template>
