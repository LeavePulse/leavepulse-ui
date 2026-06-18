<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from "reka-ui"
import LpIcon from "./LpIcon.vue"

defineProps<{
  modelValue?: boolean
  /** Mixed state (e.g. a "select all" with a partial selection). Shows a dash. */
  indeterminate?: boolean
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
  <label class="group inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
    <CheckboxRoot
      :id="id"
      :name="name"
      :model-value="indeterminate ? 'indeterminate' : modelValue"
      :disabled="disabled"
      class="flex size-[18px] items-center justify-center rounded-[5px] border border-line-strong bg-surface-soft outline-none transition-[color,background-color,border-color,box-shadow,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] not-data-[state=checked]:not-data-[state=indeterminate]:group-hover:border-brand active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand data-[state=indeterminate]:border-transparent data-[state=indeterminate]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
      @update:model-value="onUpdate"
    >
      <CheckboxIndicator
        class="flex items-center justify-center text-ink-inverse data-[state=checked]:animate-[indicator-in_140ms_var(--ease-emphasized)] data-[state=indeterminate]:animate-[indicator-in_140ms_var(--ease-emphasized)]"
      >
        <LpIcon :name="indeterminate ? 'lucide:minus' : 'lucide:check'" :size="13" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <slot>{{ label }}</slot>
  </label>
</template>
