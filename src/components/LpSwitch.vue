<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui"

defineProps<{ modelValue?: boolean; disabled?: boolean }>()
defineEmits<{ (e: "update:modelValue", value: boolean): void }>()
</script>

<template>
  <SwitchRoot
    :model-value="modelValue"
    :disabled="disabled"
    class="group inline-flex h-5 w-9 shrink-0 items-center rounded-pill border border-line bg-surface-soft px-0.5 outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-transparent data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-55"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <SwitchThumb
      class="h-3.5 w-3.5 rounded-full bg-ink shadow transition-[translate,width,background-color] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:w-5 group-data-[state=checked]:translate-x-4 group-data-[state=checked]:bg-ink-inverse group-data-[state=checked]:group-active:-translate-x-1 motion-reduce:group-active:w-3.5"
    />
  </SwitchRoot>
</template>
