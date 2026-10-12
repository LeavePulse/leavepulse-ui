<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed, useAttrs } from "vue"
import { useFieldControl } from "../composables/useField"
import { mergeClass } from "../composables/useMergedClass"
import LpFormField from "./LpFormField.vue"

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  rows?: number
  invalid?: boolean
  disabled?: boolean
  label?: string
  hint?: string
  error?: string
  /**
   * Marks the label with the required indicator; the attribute still reaches
   * the <textarea> for native validation.
   */
  required?: boolean
}>()

defineEmits<{ (e: "update:modelValue", value: string): void }>()

const hasField = computed(() => !!props.label || !!props.hint || !!props.error)

// class/style lay out the field when there is one, and style the <textarea>
// when it stands alone; every other attr (name, maxlength, autofocus, @blur…)
// belongs to the <textarea> itself.
const attrs = useAttrs()
const textareaAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})

const field = useFieldControl(() => ({
  wrapped: hasField.value,
  hasMessage: !!props.error || !!props.hint,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid || !!props.error,
  required: props.required,
  disabled: props.disabled,
}))

const textareaClass = computed(() =>
  mergeClass(
    "w-full resize-y rounded-control border bg-surface-soft px-3 py-2 text-sm text-ink outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-55",
    field.value.invalid ? "border-danger focus:border-danger focus:ring-danger-soft" : "border-line",
    hasField.value ? "" : (attrs.class as string),
  ),
)
</script>

<template>
  <component
    :is="hasField ? LpFormField : 'div'"
    :id="hasField ? field.id : undefined"
    :label="hasField ? label : undefined"
    :hint="hasField ? hint : undefined"
    :error="hasField ? error : undefined"
    :required="hasField ? required : undefined"
    :class="hasField ? attrs.class : 'contents'"
    :style="hasField ? attrs.style : undefined"
  >
    <textarea
      v-bind="textareaAttrs"
      :id="field.id"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows ?? 4"
      :disabled="field.disabled"
      :required="field.required || undefined"
      :aria-invalid="field.invalid || undefined"
      :aria-describedby="field.describedBy"
      :class="textareaClass"
      :style="hasField ? undefined : (attrs.style as never)"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </component>
</template>
