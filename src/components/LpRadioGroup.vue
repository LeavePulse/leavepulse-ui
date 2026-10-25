<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from "reka-ui"
import { useId } from "vue"
import { useFieldControl } from "../composables/useField"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpIcon from "./LpIcon.vue"
import type { LpOptionBase } from "./options"

export interface RadioOption extends LpOptionBase<string> {
  label: string
}

// `options` renders rows of label, optional icon and a muted description line;
// a disabled option stays visible but cannot be picked. For anything richer
// (badges, custom layout) pass <LpRadio> children in the default slot instead —
// they share the same RadioGroupRoot, so selection still flows through v-model.
const props = defineProps<{ modelValue?: string; options?: RadioOption[]; disabled?: boolean }>()
defineEmits<{ (e: "update:modelValue", value: string): void }>()

const field = useFieldControl(() => ({ wrapped: false, disabled: props.disabled }))
const uid = useId()

// A radio group stacks with a fixed gap; a dense settings list needs it smaller, and a horizontal layout needs it gone.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex flex-col gap-2",
)
</script>

<template>
  <RadioGroupRoot
    :model-value="modelValue"
    :disabled="field.disabled"
    :required="field.required"
    :aria-labelledby="field.labelId"
    :aria-describedby="field.describedBy"
    :aria-invalid="field.invalid || undefined"
    :class="rootClass"
    v-bind="rest"
    @update:model-value="(v) => $emit('update:modelValue', v as string)"
  >
    <slot>
      <!-- With a description the radio lines up with the label's first line,
           not with the middle of the two. -->
      <label
        v-for="(opt, i) in options"
        :key="opt.value"
        class="group/radio inline-flex gap-2 text-sm text-ink"
        :class="[
          opt.description ? 'items-start' : 'items-center',
          opt.disabled ? 'cursor-not-allowed text-muted' : field.disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        ]"
      >
        <RadioGroupItem
          :value="opt.value"
          :disabled="opt.disabled"
          :aria-describedby="opt.description ? `${uid}-${i}-desc` : undefined"
          :class="opt.description ? 'mt-px' : ''"
          class="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-soft outline-none transition-[color,border-color,box-shadow,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] not-data-[state=checked]:group-hover/radio:border-brand active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-brand disabled:cursor-not-allowed disabled:opacity-55"
        >
          <RadioGroupIndicator
            class="flex data-[state=checked]:animate-[indicator-in_140ms_var(--ease-emphasized)]"
          >
            <span class="size-2 rounded-full bg-brand" />
          </RadioGroupIndicator>
        </RadioGroupItem>
        <LpIcon v-if="opt.icon" :name="opt.icon" :size="16" class="shrink-0 text-muted" :class="opt.description ? 'mt-0.5' : ''" />
        <span v-if="opt.description" class="flex min-w-0 flex-col">
          <span>{{ opt.label }}</span>
          <span :id="`${uid}-${i}-desc`" class="text-xs text-muted">{{ opt.description }}</span>
        </span>
        <template v-else>{{ opt.label }}</template>
      </label>
    </slot>
  </RadioGroupRoot>
</template>
