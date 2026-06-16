<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed, useAttrs, useSlots } from "vue"

// Single source of truth for the field shell — bare input and adorned input
// (e.g. LpPasswordInput) both use it, so the look never drifts.
const shell = tv({
  base: [
    "flex w-full items-center bg-surface-soft text-ink",
    "rounded-control border border-line",
    "transition-colors duration-[var(--duration-fast)]",
    "focus-within:border-brand focus-within:ring-2 focus-within:ring-ring",
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55",
  ],
  variants: {
    size: {
      sm: "h-(--size-control-sm) text-xs",
      md: "h-(--size-control-md) text-sm",
      lg: "h-(--size-control-lg) text-sm",
    },
    invalid: {
      true: "border-danger focus-within:border-danger focus-within:ring-danger-soft",
    },
  },
  defaultVariants: { size: "md" },
})

const padX = { sm: "px-2.5", md: "px-3", lg: "px-3.5" } as const

type InputVariants = VariantProps<typeof shell>

const props = withDefaults(
  defineProps<{
    modelValue?: string
    size?: InputVariants["size"]
    invalid?: boolean
    placeholder?: string
    type?: string
    disabled?: boolean
  }>(),
  { type: "text", size: "md" },
)

defineEmits<{ (e: "update:modelValue", value: string): void }>()

const slots = useSlots()
const attrs = useAttrs()
const hasLeading = computed(() => !!slots.leading)
const hasTrailing = computed(() => !!slots.trailing)
const shellClass = computed(() => shell({ size: props.size, invalid: props.invalid }))

// class/style belong to the wrapper (so `<LpInput class="...">` lays out the
// whole field); every other attr (autocomplete, name, @keyup, inputmode…) goes
// to the real <input>.
const rootClass = computed(() => attrs.class)
const rootStyle = computed(() => attrs.style)
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})
</script>

<template>
  <div :class="[shellClass, hasLeading ? 'pl-2.5' : '', hasTrailing ? 'pr-1.5' : '', rootClass]" :style="rootStyle">
    <span v-if="hasLeading" class="flex shrink-0 items-center text-muted">
      <slot name="leading" />
    </span>
    <input
      v-bind="inputAttrs"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="[
        'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted',
        hasLeading ? 'pl-2' : padX[size ?? 'md'],
        hasTrailing ? '' : padX[size ?? 'md'],
      ]"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <slot name="trailing" />
  </div>
</template>
