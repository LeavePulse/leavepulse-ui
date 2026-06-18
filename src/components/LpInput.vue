<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed, ref, useAttrs, useSlots } from "vue"
import { useInputFilter } from "../composables/useInputFilter"
import LpFormField from "./LpFormField.vue"
import LpIcon from "./LpIcon.vue"

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
    // Optional label/hint/error wraps the field in LpFormField. `icon` renders
    // a leading icon (ignored when the `leading` slot is provided).
    label?: string
    hint?: string
    error?: string
    icon?: string
    /**
     * RegExp/string the whole value must match to be valid. Validation only —
     * never blocks typing; a non-matching non-empty value shows the invalid
     * style + aria-invalid. A bare string is anchored, like HTML `pattern`.
     */
    pattern?: RegExp | string
    /**
     * One-char RegExp of allowed characters (e.g. /[0-9]/). Hard-blocks
     * disallowed input/paste at the source — cursor- and IME-safe.
     */
    restrict?: RegExp
  }>(),
  { type: "text", size: "md" },
)

defineEmits<{ (e: "update:modelValue", value: string): void }>()

const { isInvalid, onBeforeInput, onPaste } = useInputFilter({
  pattern: () => props.pattern,
  restrict: () => props.restrict,
})

// Pattern failure folds into the same invalid state as the explicit prop/error.
const patternInvalid = computed(() => isInvalid(props.modelValue))

const slots = useSlots()
const attrs = useAttrs()
const hasLeading = computed(() => !!slots.leading || !!props.icon)
const hasTrailing = computed(() => !!slots.trailing)
const hasField = computed(
  () => !!props.label || !!props.hint || !!props.error,
)
const isInvalidState = computed(
  () => props.invalid || !!props.error || patternInvalid.value,
)
const shellClass = computed(() =>
  shell({ size: props.size, invalid: isInvalidState.value }),
)

// class/style belong to the wrapper (so `<LpInput class="...">` lays out the
// whole field); every other attr (autocomplete, name, @keyup, inputmode…) goes
// to the real <input>.
const rootClass = computed(() => attrs.class)
const rootStyle = computed(() => attrs.style)
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})

const inputEl = ref<HTMLInputElement | null>(null)
defineExpose({
  focus: (options?: FocusOptions) => inputEl.value?.focus(options),
  blur: () => inputEl.value?.blur(),
  select: () => inputEl.value?.select(),
  input: inputEl,
})
</script>

<template>
  <component
    :is="hasField ? LpFormField : 'div'"
    :label="hasField ? label : undefined"
    :hint="hasField ? hint : undefined"
    :error="hasField ? error : undefined"
    :class="hasField ? rootClass : undefined"
    :style="hasField ? rootStyle : undefined"
  >
    <div
      :class="[shellClass, hasLeading ? 'pl-2.5' : '', hasTrailing ? 'pr-1.5' : '', hasField ? '' : rootClass]"
      :style="hasField ? undefined : rootStyle"
    >
      <span v-if="hasLeading" class="flex shrink-0 items-center text-muted">
        <slot name="leading"><LpIcon v-if="icon" :name="icon" :size="16" /></slot>
      </span>
      <input
        ref="inputEl"
        v-bind="inputAttrs"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="isInvalidState || undefined"
        :class="[
          'min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted',
          hasLeading ? 'pl-2' : padX[size ?? 'md'],
          hasTrailing ? '' : padX[size ?? 'md'],
        ]"
        @beforeinput="onBeforeInput"
        @paste="onPaste"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <slot name="trailing" />
    </div>
  </component>
</template>
