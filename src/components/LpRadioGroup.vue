<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from "reka-ui"
import { useMergedAttrs } from "../composables/useMergedClass"

export interface RadioOption {
  value: string
  label: string
}

// `options` renders simple {value,label} rows. For rich items (icons, badges,
// multi-line) pass <LpRadio> children in the default slot instead — they share
// the same RadioGroupRoot, so selection still flows through v-model.
defineProps<{ modelValue?: string; options?: RadioOption[]; disabled?: boolean }>()
defineEmits<{ (e: "update:modelValue", value: string): void }>()

// A radio group stacks with a fixed gap; a dense settings list needs it smaller, and a horizontal layout needs it gone.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex flex-col gap-2",
)
</script>

<template>
  <RadioGroupRoot
    :model-value="modelValue"
    :disabled="disabled"
    :class="rootClass"
    v-bind="rest"
    @update:model-value="(v) => $emit('update:modelValue', v as string)"
  >
    <slot>
      <label
        v-for="opt in options"
        :key="opt.value"
        class="group inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
      >
        <RadioGroupItem
          :value="opt.value"
          class="flex size-[18px] items-center justify-center rounded-full border border-line-strong bg-surface-soft outline-none transition-[color,border-color,box-shadow,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] not-data-[state=checked]:group-hover:border-brand active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-brand disabled:cursor-not-allowed disabled:opacity-55"
        >
          <RadioGroupIndicator
            class="flex data-[state=checked]:animate-[indicator-in_140ms_var(--ease-emphasized)]"
          >
            <span class="size-2 rounded-full bg-brand" />
          </RadioGroupIndicator>
        </RadioGroupItem>
        {{ opt.label }}
      </label>
    </slot>
  </RadioGroupRoot>
</template>
