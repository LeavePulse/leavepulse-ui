<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { usePaletteControl, type PaletteControlOptions } from "../composables/usePaletteCommands"
// Numeric input with stepper buttons (reka NumberField). Themed via tokens.
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui"
import { computed, useAttrs, useId } from "vue"
import LpIcon from "./LpIcon.vue"
import { focusLeft, useFieldControl } from "../composables/useField"
import { useLabels } from "../composables/useLpConfig"
import { useMergedClass } from "../composables/useMergedClass"

export interface NumberFieldLabels extends Record<string, string> {
  increase: string
  decrease: string
}

const props = withDefaults(defineProps<{
    /** Contextual palette metadata; false excludes this control. */
    palette?: PaletteControlOptions
  // null = empty field (reka's native state); consumers that need a number
  // should default it themselves, the field doesn't invent a value.
  modelValue?: number | null
  min?: number
  max?: number
  /**
   * What the steppers and arrow keys add. A typed value is snapped to the
   * nearest step from `min` (or 0) when it is committed, unless `stepSnapping`
   * is false: then 0.37 stays 0.37 in a field that steps by 0.5.
   */
  step?: number
  stepSnapping?: boolean
  /**
   * How the value is shown and, with it, how far it is rounded: the field
   * commits the number it displays, so `{ maximumFractionDigits: 0 }` makes it
   * an integer field. Intl options, read in `locale` (the document's by default).
   */
  formatOptions?: Intl.NumberFormatOptions
  locale?: string
  /** Shown and focusable, not changed: typing, the steppers, arrows and the wheel all stop. */
  readonly?: boolean
  /** The wheel over a focused field steps the value unless this is set. */
  disableWheelChange?: boolean
  invertWheelChange?: boolean
  /** A step from the buttons moves focus to the input (reka's default); false keeps it on the button. */
  focusOnChange?: boolean
  /**
   * The − and + buttons. Off, the field is a plain numeric input; arrow keys
   * still step. A field narrower than 8.5rem drops them by itself: two 32 px
   * buttons left a 100 px column eleven pixels for the digits.
   */
  steppers?: boolean
  disabled?: boolean
  // The unit the number is in ("mm", "W", "mA"). It sits inside the field
  // rather than in the label, because a grid of bare boxes labelled "Width",
  // "Depth", "Weight" tells the reader nothing about which one wants grams.
  // Not part of the value: it is never typed, selected, or submitted.
  unit?: string
  invalid?: boolean
  /** Control height, matching LpInput. */
  size?: "sm" | "md" | "lg"
  labels?: Partial<NumberFieldLabels>
}>(), { palette: undefined, size: "md", stepSnapping: true, steppers: true, focusOnChange: true })

// The value is committed when the field loses focus or Enter is pressed, and on
// every step, not on each keystroke: "1." or "-" is not a number yet, and a
// model that followed the keys would flicker through them.
const emit = defineEmits<{
  (e: "update:modelValue", value: number | null): void
  (e: "blur", event: FocusEvent): void
}>()

// The unit is described to the input rather than merely placed beside it: on
// screen the two read as one field, and without this a reader announces "380"
// and leaves out the milliamps that make it mean anything.
const unitId = useId()

// reka names the stepper buttons "Increase" / "Decrease" in English and nothing
// else; an aria-label on the button replaces its own.
const text = useLabels<NumberFieldLabels>(
  "numberField",
  { increase: "Increase", decrease: "Decrease" },
  () => props.labels,
)

const SIZE = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

const attrs = useAttrs()
const field = useFieldControl(() => ({
  wrapped: false,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid,
  disabled: props.disabled,
}))
const describedBy = computed(
  () => [field.value.describedBy, props.unit ? unitId : undefined].filter(Boolean).join(" ") || undefined,
)

// The frame takes the consumer's class and style, and `name` goes to reka's
// hidden input, which submits the number itself rather than its formatted
// text and carries `required` for the form's own check; every other attribute
// (placeholder, name, aria-label, inputmode, listeners) belongs to the input,
// which is what a form, a reader and a test reach for.
const inputAttrs = computed(() => {
  const { class: _c, style: _s, id: _i, name: _n, ...rest } = attrs
  return rest
})

function onFocusOut(event: FocusEvent) {
  if (focusLeft(event)) emit("blur", event)
}

// The field is full-width with its own control frame — the two things a consumer laying out a compact numeric column needs to change.
const rootClass = useMergedClass(() =>
  [
    "@container flex w-full items-center rounded-control border bg-surface-soft transition-colors duration-[var(--duration-fast)] focus-within:ring-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55",
    SIZE[props.size],
    field.value.invalid
      ? "border-danger focus-within:border-danger focus-within:ring-danger-soft"
      : "border-line focus-within:border-brand focus-within:ring-ring",
  ].join(" "),
)

usePaletteControl({ disabled: () => field.value.disabled, invalid: () => field.value.invalid })
</script>

<template>
  <NumberFieldRoot
    :model-value="modelValue ?? undefined"
    :min="min"
    :max="max"
    :step="step"
    :step-snapping="stepSnapping"
    :readonly="readonly"
    :disable-wheel-change="disableWheelChange"
    :invert-wheel-change="invertWheelChange"
    :focus-on-change="focusOnChange"
    :format-options="formatOptions"
    :locale="locale"
    :disabled="field.disabled"
    :required="field.required"
    data-lp-ring-owner
    :class="rootClass"
    :style="attrs.style"
    :name="typeof attrs.name === 'string' ? attrs.name : undefined"
    @update:model-value="(v) => emit('update:modelValue', Number.isNaN(v) ? null : (v ?? null))"
    @focusout="onFocusOut"
  >
    <NumberFieldDecrement
      v-if="steppers"
      :aria-label="text.decrease"
      class="group grid h-full w-8 shrink-0 place-items-center @max-[8.5rem]:hidden text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink disabled:opacity-40"
    >
      <LpIcon
        name="lucide:minus"
        :size="15"
        class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:scale-75 motion-reduce:group-active:scale-100"
      />
    </NumberFieldDecrement>
    <NumberFieldInput
      v-bind="inputAttrs"
      :id="field.id"
      :aria-describedby="describedBy"
      :aria-invalid="field.invalid || undefined"
      class="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      :class="steppers ? 'text-center @max-[8.5rem]:px-3 @max-[8.5rem]:text-left' : 'px-3'"
    />
    <!-- The unit sits between the value and the increment button, so a long one
         narrows the field rather than covering the digits. Not focusable and
         not part of the value: it is read, never typed. -->
    <span v-if="unit" :id="unitId" class="shrink-0 pr-1 text-xs text-muted" :class="!steppers && 'pr-3'">{{ unit }}</span>
    <NumberFieldIncrement
      v-if="steppers"
      :aria-label="text.increase"
      class="group grid h-full w-8 shrink-0 place-items-center @max-[8.5rem]:hidden text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink disabled:opacity-40"
    >
      <LpIcon
        name="lucide:plus"
        :size="15"
        class="transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-active:scale-75 motion-reduce:group-active:scale-100"
      />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
