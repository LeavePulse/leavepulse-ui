<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from "reka-ui"

export interface RadioOption {
  value: string
  label: string
}

defineProps<{ modelValue?: string; options: RadioOption[]; disabled?: boolean }>()
defineEmits<{ (e: "update:modelValue", value: string): void }>()
</script>

<template>
  <RadioGroupRoot
    :model-value="modelValue"
    :disabled="disabled"
    class="flex flex-col gap-2"
    @update:model-value="(v) => $emit('update:modelValue', v as string)"
  >
    <label
      v-for="opt in options"
      :key="opt.value"
      class="inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
    >
      <RadioGroupItem
        :value="opt.value"
        class="flex size-[18px] items-center justify-center rounded-full border border-line-strong bg-surface-soft outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-brand disabled:cursor-not-allowed disabled:opacity-55"
      >
        <RadioGroupIndicator
          class="flex data-[state=checked]:animate-[indicator-in_140ms_var(--ease-emphasized)]"
        >
          <span class="size-2 rounded-full bg-brand" />
        </RadioGroupIndicator>
      </RadioGroupItem>
      {{ opt.label }}
    </label>
  </RadioGroupRoot>
</template>
