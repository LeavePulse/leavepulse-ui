<script setup lang="ts">
import { computed } from "vue"
import LpFormField from "./LpFormField.vue"

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number
  invalid?: boolean
  disabled?: boolean
  label?: string
  hint?: string
  error?: string
}>()

defineEmits<{ (e: "update:modelValue", value: string): void }>()

const hasField = computed(() => !!props.label || !!props.hint || !!props.error)
</script>

<template>
  <component
    :is="hasField ? LpFormField : 'div'"
    :label="hasField ? label : undefined"
    :hint="hasField ? hint : undefined"
    :error="hasField ? error : undefined"
    :class="hasField ? undefined : 'contents'"
  >
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows ?? 4"
      :disabled="disabled"
      class="w-full resize-y rounded-control border bg-surface-soft px-3 py-2 text-sm text-ink outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
      :class="(invalid || error) ? 'border-danger focus:border-danger focus:ring-danger-soft' : 'border-line'"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </component>
</template>
