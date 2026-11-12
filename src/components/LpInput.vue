<script lang="ts">
export default { inheritAttrs: false }

/** Wording of the input's clear button. */
export type InputLabels = {
  clear: string
}
</script>

<script setup lang="ts">
import { CONTROL_SIZE } from "./controlSize"
import { usePaletteControl, type PaletteControlOptions } from "../composables/usePaletteCommands"
import { tv, type VariantProps } from "tailwind-variants"
import { computed, ref, useAttrs, useSlots } from "vue"
import { fieldWrapperBinds, isAttrOn, mergeDescribedBy, useField, useFieldControl, wrapsItself } from "../composables/useField"
import { useLabels } from "../composables/useLpConfig"
import { useInputFilter } from "../composables/useInputFilter"
import { DEFAULT_MASK_TOKENS, useInputMask, type MaskSpec, type MaskTokens } from "../composables/useInputMask"
import { mergeClass } from "../composables/useMergedClass"
import FieldWrapper from "./FieldWrapper.vue"
import FieldLeading from "./FieldLeading.vue"
import LpIcon from "./LpIcon.vue"

// Single source of truth for the field shell — bare input and adorned input
// (e.g. LpPasswordInput) both use it, so the look never drifts.
const shell = tv({
  base: [
    "flex w-full items-center bg-surface-soft text-ink",
    // `overflow-hidden` because rounding a box does NOT clip what is inside it:
    // the shell carries the radius while the bare <input> is square, so any
    // paint of its own — the background a browser applies to an autofilled
    // field, most visibly — reached into the rounded corners.
    "overflow-hidden rounded-control border border-line",
    "transition-colors duration-[var(--duration-fast)]",
    "focus-within:border-brand focus-within:ring-2 focus-within:ring-ring",
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55",
  ],
  variants: {
    size: CONTROL_SIZE,
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
    /** Contextual palette metadata; false excludes this control. */
    palette?: PaletteControlOptions
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
    /** Show an accessible clear button, returning focus to the input. */
    clearable?: boolean
    labels?: Partial<InputLabels>
    /**
     * Marks the label with the required indicator. The attribute still reaches
     * the underlying <input> for native validation; this only makes the field
     * read as required.
     */
    required?: boolean
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
    /**
     * Format-as-you-type mask ("+0 (000) 000-00-00", a list, or a function of
     * the raw value). The model holds the masked text; `update:raw` carries
     * the accepted characters alone.
     */
    mask?: MaskSpec
    /** Extra or replacement mask tokens, one-character RegExps by key. */
    maskTokens?: MaskTokens
  }>(),
  { palette: undefined, type: "text", size: "md" },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "update:raw", value: string): void
}>()

const { isInvalid, onBeforeInput, onInput: filterInput, onCompositionEnd, onPaste } = useInputFilter({
  pattern: () => props.pattern,
  restrict: () => props.restrict,
})

const masking = useInputMask({
  mask: () => props.mask,
  tokens: () => (props.maskTokens ? { ...DEFAULT_MASK_TOKENS, ...props.maskTokens } : undefined),
  onChange: (_masked, raw) => emit("update:raw", raw),
})
const shown = computed(() => (masking.active.value ? masking.format(props.modelValue).masked : props.modelValue))

function onBefore(event: InputEvent): void {
  onBeforeInput(event)
  if (!event.defaultPrevented) masking.onBeforeInput(event)
  if (event.defaultPrevented && masking.active.value) {
    emit("update:modelValue", (event.target as HTMLInputElement).value)
  }
}

function onInputEvent(event: Event): void {
  // `restrict` first: it sees what was typed, and the mask then lays out what
  // is left, putting back any literal the clean-up took along.
  filterInput(event)
  if (masking.active.value) masking.onInput(event)
  emit("update:modelValue", (event.target as HTMLInputElement).value)
}

function onComposed(event: CompositionEvent): void {
  onCompositionEnd(event)
  if (!masking.active.value) return
  masking.onCompositionEnd(event)
  emit("update:modelValue", (event.target as HTMLInputElement).value)
}

// Pattern failure folds into the same invalid state as the explicit prop/error.
const patternInvalid = computed(() => isInvalid(props.modelValue))

const slots = useSlots()
const attrs = useAttrs()
const hasLeading = computed(() => !!slots.leading || !!props.icon)
const hasTrailing = computed(() => !!slots.trailing || showClear.value)
const outerFieldOf = useField()
const hasField = computed(() => wrapsItself(props, outerFieldOf))
const field = useFieldControl(() => ({
  wrapped: hasField.value,
  hasMessage: !!props.error || !!props.hint,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid || !!props.error || patternInvalid.value,
  required: props.required,
  disabled: props.disabled,
}))
const text = useLabels<InputLabels>("input", { clear: "Clear" }, () => props.labels)
const showClear = computed(() => props.clearable && !!props.modelValue && !field.value.disabled && !isAttrOn(attrs.readonly) && !isAttrOn(attrs.readOnly))
const isInvalidState = computed(() => field.value.invalid)
const shellClass = computed(() =>
  shell({ size: props.size, invalid: isInvalidState.value }),
)

// class/style belong to the wrapper (so `<LpInput class="...">` lays out the
// whole field); every other attr (autocomplete, name, @keyup, inputmode…) goes
// to the real <input>.
const inputAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})

const inputEl = ref<HTMLInputElement | null>(null)
function clear() {
  if (!showClear.value) return
  emit("update:modelValue", "")
  if (masking.active.value) emit("update:raw", "")
  inputEl.value?.focus()
}
defineExpose({
  focus: (options?: FocusOptions) => inputEl.value?.focus(options),
  blur: () => inputEl.value?.blur(),
  select: () => inputEl.value?.select(),
  input: inputEl,
})

usePaletteControl({ label: () => props.label, disabled: () => field.value.disabled, invalid: () => field.value.invalid, available: () => !['password', 'hidden'].includes(props.type), editorProps: () => ({ label: undefined, hint: undefined, error: undefined }) })
</script>

<template>
  <FieldWrapper
    v-bind="fieldWrapperBinds(hasField, field, $props, attrs)"
  >
    <div
      data-lp-ring-owner
      :class="mergeClass(shellClass, hasLeading ? 'pl-2.5' : '', hasTrailing ? 'pr-1.5' : '', hasField ? '' : (attrs.class as string))"
      :style="hasField ? undefined : attrs.style"
    >
      <FieldLeading :icon="icon">
        <template v-if="$slots.leading" #default><slot name="leading" /></template>
      </FieldLeading>
      <input
        ref="inputEl"
        v-bind="inputAttrs"
        :id="field.id"
        :type="type"
        :value="shown"
        :placeholder="placeholder"
        :disabled="field.disabled"
        :required="field.required || undefined"
        :aria-invalid="isInvalidState || undefined"
        :aria-describedby="mergeDescribedBy(attrs['aria-describedby'], field.describedBy)"
        :class="[
          'lp-autofill lp-entry min-w-0 flex-1 self-stretch bg-transparent outline-none placeholder:text-muted',
          clearable && '[&::-webkit-search-cancel-button]:hidden',
          hasLeading ? 'pl-2' : padX[size ?? 'md'],
          hasTrailing ? '' : padX[size ?? 'md'],
        ]"
        @beforeinput="onBefore"
        @paste="onPaste"
        @compositionend="onComposed"
        @input="onInputEvent"
      />
      <slot name="trailing" />
      <button v-if="showClear" type="button" :aria-label="text.clear" class="shrink-0 rounded-inner p-1 text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring" @pointerdown.prevent @click="clear">
        <LpIcon name="lucide:x" :size="size === 'sm' ? 12 : 16" />
      </button>
    </div>
  </FieldWrapper>
</template>
