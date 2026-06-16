<script setup lang="ts">
defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number
  invalid?: boolean
  disabled?: boolean
}>()

defineEmits<{ (e: "update:modelValue", value: string): void }>()
</script>

<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows ?? 4"
    :disabled="disabled"
    class="w-full resize-y rounded-control border bg-surface-soft px-3 py-2 text-sm text-ink outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
    :class="invalid ? 'border-danger focus:border-danger focus:ring-danger-soft' : 'border-line'"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
