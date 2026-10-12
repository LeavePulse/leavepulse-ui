<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * One-time-code input (TOTP / 2FA). A row of single-character cells with the
 * usual OTP ergonomics — auto-advance, backspace-to-previous, and pasting the
 * whole code spreads it across the cells — all from reka PinInput.
 *
 * The kit-facing model is a single STRING (the joined code), not reka's per-cell
 * array: `v-model` is "123456", and @complete fires that string once every cell
 * is filled. Digits-only by default (TOTP); flip `alphanumeric` for backup codes.
 */
import { PinInputInput, PinInputRoot } from "reka-ui"
import { computed, ref, watch } from "vue"
import { useFieldControl } from "../composables/useField"
import { useMergedAttrs } from "../composables/useMergedClass"
import { joinCells, splitCode, type OtpCells } from "./otp"

const props = withDefaults(
  defineProps<{
    /** The code as one string, e.g. "123456". Bind with v-model. */
    modelValue?: string
    /** Number of cells. */
    length?: number
    disabled?: boolean
    /** Mask entered characters (•) — for sensitive codes. */
    mask?: boolean
    /** Allow letters too (backup codes). Default: digits only (TOTP). */
    alphanumeric?: boolean
    /** Error state — tints the cells red (e.g. wrong code). */
    invalid?: boolean
    size?: "sm" | "md" | "lg"
  }>(),
  { length: 6, size: "md", alphanumeric: false },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  /** Fired once every cell is filled. Carries the full joined code. */
  (e: "complete", value: string): void
}>()

// reka models the value as an array of per-cell strings; we bridge to a single
// string at the boundary so callers never touch the array shape.
//
// The cells are kept here, positions and all, rather than re-split from the
// string on every render: clearing a middle cell leaves a gap the string cannot
// express, and re-splitting it shifted every later digit one cell left. The
// cells are only rebuilt when the model changes from outside.
const local = ref<string[]>(splitCode(props.modelValue, props.length))
let emitted = props.modelValue ?? ""
watch(
  () => props.modelValue ?? "",
  (value) => {
    if (value === emitted) return
    emitted = value
    local.value = splitCode(value, props.length)
  },
)
watch(
  () => props.length,
  (length) => {
    local.value = local.value.slice(0, length)
  },
)
const cells = computed<string[]>({
  get: () => local.value,
  set: (arr) => {
    local.value = arr
    emitted = joinCells(arr)
    emit("update:modelValue", emitted)
  },
})

const field = useFieldControl(() => ({
  wrapped: false,
  invalid: props.invalid,
  disabled: props.disabled,
}))

function onComplete(arr: OtpCells) {
  emit("complete", joinCells(arr))
}

const cellSize = {
  sm: "size-9 text-base",
  md: "size-11 text-lg",
  lg: "size-13 text-xl",
}

// The boxes sit on a fixed gap that a narrow form has to tighten.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex items-center gap-2",
)
</script>

<template>
  <PinInputRoot
    v-model="cells"
    :type="alphanumeric ? 'text' : 'number'"
    :mask="mask"
    :disabled="field.disabled"
    otp
    :class="rootClass"
    v-bind="rest"
    @complete="onComplete"
  >
    <PinInputInput
      v-for="i in length"
      :key="i"
      :index="i - 1"
      :id="i === 1 ? field.id : undefined"
      :aria-invalid="field.invalid || undefined"
      :aria-describedby="field.describedBy"
      :class="[
        cellSize[size],
        'rounded-control border bg-surface-soft text-center font-semibold text-ink caret-brand',
        'outline-none transition-colors duration-[var(--duration-fast)]',
        'focus:border-brand focus:ring-2 focus:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-55',
        field.invalid ? 'border-danger focus:border-danger focus:ring-danger-soft' : 'border-line',
      ]"
    />
  </PinInputRoot>
</template>
