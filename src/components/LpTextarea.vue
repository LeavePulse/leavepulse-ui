<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { usePaletteControl, type PaletteControlOptions } from "../composables/usePaletteCommands"
import { computed, nextTick, onMounted, ref, useAttrs, watch } from "vue"
import { useFieldControl } from "../composables/useField"
import { mergeClass } from "../composables/useMergedClass"
import FieldWrapper from "./FieldWrapper.vue"

const props = withDefaults(defineProps<{
    /** Contextual palette metadata; false excludes this control. */
    palette?: PaletteControlOptions
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
  /**
   * Grows with what is typed, wrapped lines included, from `rows` up to
   * `maxRows`, then scrolls; the drag handle goes, since the height is the
   * text's. For a composer, where a fixed box is either cramped or empty.
   */
  autosize?: boolean
  maxRows?: number
}>(), { palette: undefined, maxRows: 8 })

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

const box = ref<HTMLTextAreaElement | null>(null)

// Measured rather than styled with `field-sizing: content`, which WebKit does
// not have: an app in a WebKitGTK window would keep a fixed box.
function fit() {
  const el = box.value
  if (!props.autosize || !el) return
  const style = getComputedStyle(el)
  const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4
  const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
  el.style.height = "auto"
  const max = line * props.maxRows + padding + borders
  el.style.height = `${Math.min(el.scrollHeight + borders, max)}px`
  el.style.overflowY = el.scrollHeight + borders > max + 1 ? "auto" : "hidden"
}
watch(() => props.modelValue, () => nextTick(fit))
onMounted(fit)

defineExpose({ el: box, fit })

const textareaClass = computed(() =>
  mergeClass(
    props.autosize ? "w-full resize-none" : "w-full resize-y",
    "rounded-control border bg-surface-soft px-3 py-2 text-sm text-ink outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-55",
    field.value.invalid ? "border-danger focus:border-danger focus:ring-danger-soft" : "border-line",
    hasField.value ? "" : (attrs.class as string),
  ),
)

usePaletteControl({ label: () => props.label, disabled: () => field.value.disabled, invalid: () => field.value.invalid, editorProps: () => ({ label: undefined, hint: undefined, error: undefined }) })
</script>

<template>
  <FieldWrapper
    :wrapped="hasField"
    :id="field.id"
    :label="label"
    :hint="hint"
    :error="error"
    :required="required"
    :class="attrs.class"
    :style="attrs.style"
  >
    <textarea
      ref="box"
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
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value); fit()"
    />
  </FieldWrapper>
</template>
