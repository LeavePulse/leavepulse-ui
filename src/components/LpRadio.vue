<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem } from "reka-ui"

// A single radio item with a slot for rich content (icon, badges, multi-line).
// Must be placed inside an <LpRadioGroup> (or a reka-ui RadioGroupRoot), which
// owns the selected value. The default slot replaces the plain label.
defineProps<{ value: string; label?: string; disabled?: boolean }>()
</script>

<template>
  <label
    class="group inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
    :class="disabled && 'cursor-not-allowed opacity-55'"
  >
    <RadioGroupItem
      :value="value"
      :disabled="disabled"
      class="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-soft outline-none transition-[color,border-color,box-shadow,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] not-data-[state=checked]:group-hover:border-brand active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-brand disabled:cursor-not-allowed disabled:opacity-55"
    >
      <RadioGroupIndicator
        class="flex data-[state=checked]:animate-[indicator-in_140ms_var(--ease-emphasized)]"
      >
        <span class="size-2 rounded-full bg-brand" />
      </RadioGroupIndicator>
    </RadioGroupItem>
    <slot>{{ label }}</slot>
  </label>
</template>
