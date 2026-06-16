<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui"

defineProps<{ modelValue?: boolean; disabled?: boolean }>()
defineEmits<{ (e: "update:modelValue", value: boolean): void }>()
</script>

<template>
  <SwitchRoot
    :model-value="modelValue"
    :disabled="disabled"
    class="inline-flex h-5 w-9 shrink-0 items-center rounded-pill border border-line bg-surface-soft px-0.5 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <SwitchThumb
      class="size-3.5 rounded-full bg-ink shadow transition-transform duration-[var(--duration-fast)] data-[state=checked]:translate-x-4 data-[state=checked]:bg-ink-inverse"
    />
  </SwitchRoot>
</template>
