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
import { computed } from "vue"

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
const cells = computed<string[]>({
  get: () => (props.modelValue ?? "").split("").slice(0, props.length),
  set: (arr) => emit("update:modelValue", arr.join("")),
})

function onComplete(arr: string[]) {
  emit("complete", arr.join(""))
}

const cellSize = {
  sm: "size-9 text-base",
  md: "size-11 text-lg",
  lg: "size-13 text-xl",
}
</script>

<template>
  <PinInputRoot
    v-model="cells"
    :type="alphanumeric ? 'text' : 'number'"
    :mask="mask"
    :disabled="disabled"
    otp
    class="flex items-center gap-2"
    @complete="onComplete"
  >
    <PinInputInput
      v-for="i in length"
      :key="i"
      :index="i - 1"
      :aria-invalid="invalid || undefined"
      :class="[
        cellSize[size],
        'rounded-control border bg-surface-soft text-center font-semibold text-ink caret-brand',
        'outline-none transition-colors duration-[var(--duration-fast)]',
        'focus:border-brand focus:ring-2 focus:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-55',
        invalid ? 'border-danger focus:border-danger focus:ring-danger-soft' : 'border-line',
      ]"
    />
  </PinInputRoot>
</template>
