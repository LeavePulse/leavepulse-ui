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
 *
 * The cells share the row rather than keeping a fixed size: each grows to its
 * size's width and no further, and shrinks with the row when the container is
 * narrower, so eight cells fit a phone instead of running off its edge.
 */
import { PinInputInput, PinInputRoot } from "reka-ui"
import { computed, ref, watch } from "vue"
import { useFieldControl } from "../composables/useField"
import { useMergedAttrs } from "../composables/useMergedClass"
import { groupBreaks, joinCells, splitCode, upperCells, type OtpCells } from "./otp"

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
    /**
     * Turn typed letters into capitals, and open a phone's keyboard in capitals.
     * Default: on with `alphanumeric`, where codes are printed in capitals and
     * compared without regard to case; pass `false` for a case-sensitive code.
     */
    uppercase?: boolean
    /**
     * Draw a separator after every `group` cells (e.g. 3 for "123-456"), or
     * after blocks of the exact sizes given (`[4, 6, 5]`), as LpCodeDisplay's
     * `groups` splits the printed code.
     */
    group?: number | number[]
    /** Error state — tints the cells red (e.g. wrong code). */
    invalid?: boolean
    size?: "sm" | "md" | "lg"
  }>(),
  { length: 6, size: "md", alphanumeric: false, uppercase: undefined },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  /** Fired once every cell is filled. Carries the full joined code. */
  (e: "complete", value: string): void
}>()

const upper = computed(() => props.alphanumeric && (props.uppercase ?? true))

// reka models the value as an array of per-cell strings; we bridge to a single
// string at the boundary so callers never touch the array shape.
//
// The cells are kept here, positions and all, rather than re-split from the
// string on every render: clearing a middle cell leaves a gap the string cannot
// express, and re-splitting it shifted every later digit one cell left. The
// cells are only rebuilt when the model changes from outside.
const local = ref<OtpCells>(splitCode(props.modelValue, props.length))
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
// Typed as reka's text-mode array; numeric mode holds numbers and holes, which
// the helpers in ./otp are written for.
const cells = computed<string[]>({
  get: () => local.value as string[],
  set: (arr) => {
    local.value = upper.value ? upperCells(arr) : arr
    emitted = joinCells(local.value)
    emit("update:modelValue", emitted)
  },
})

const field = useFieldControl(() => ({
  wrapped: false,
  invalid: props.invalid,
  disabled: props.disabled,
}))

function onComplete(arr: OtpCells) {
  emit("complete", joinCells(upper.value ? upperCells(arr) : arr))
}

const breaks = computed(() => groupBreaks(props.length, props.group))

/*
 * Backspace, as a phone's keyboard sends it.
 *
 * reka handles Backspace on keydown, but an on-screen keyboard reports most
 * keys as "Unidentified", so its handler never ran there: the browser deleted
 * the character itself, and reka read the now-empty cell as typed input and
 * moved the caret FORWARD — and an empty cell could not be backed out of at
 * all. `beforeinput` names the deletion on every keyboard, so it is done here
 * the way a hardware Backspace does it: clear this cell, or step back into
 * the previous one and clear that. A hardware key never reaches this, since
 * reka's keydown handler cancels it first.
 */
const root = ref<{ $el: HTMLElement } | null>(null)
function onBeforeInput(event: InputEvent, index: number) {
  if (event.inputType !== "deleteContentBackward") return
  event.preventDefault()
  const target = event.target as HTMLInputElement
  const next = [...local.value]
  let clear = index
  if (!target.value && index > 0) {
    clear = index - 1
    root.value?.$el.querySelectorAll("input")[clear]?.focus()
  }
  // Emptied the way reka empties a cell itself: numeric mode leaves a hole.
  next[clear] = props.alphanumeric ? "" : undefined
  cells.value = next as string[]
}

const cellSize = {
  sm: "max-w-9 text-base",
  md: "max-w-11 text-lg",
  lg: "max-w-13 text-xl",
}

const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2",
)
</script>

<template>
  <PinInputRoot
    ref="root"
    v-model="cells"
    :type="alphanumeric ? 'text' : 'number'"
    :mask="mask"
    :disabled="field.disabled"
    :required="field.required"
    otp
    :class="rootClass"
    v-bind="rest"
    @complete="onComplete"
  >
    <template v-for="i in length" :key="i">
      <PinInputInput
        :index="i - 1"
        :id="i === 1 ? field.id : undefined"
        :aria-invalid="field.invalid || undefined"
        :aria-describedby="field.describedBy"
        :autocapitalize="upper ? 'characters' : 'none'"
        autocorrect="off"
        :spellcheck="false"
        :class="[
          cellSize[size],
          'aspect-square h-auto min-w-0 flex-1 basis-0 p-0',
          'rounded-control border bg-surface-soft text-center font-semibold text-ink caret-brand',
          'outline-none transition-colors duration-[var(--duration-fast)]',
          'focus:border-brand focus:ring-2 focus:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-55',
          field.invalid ? 'border-danger focus:border-danger focus:ring-danger-soft' : 'border-line',
        ]"
        @beforeinput="onBeforeInput($event as InputEvent, i - 1)"
      />
      <span
        v-if="breaks.has(i - 1)"
        aria-hidden="true"
        class="h-0.5 w-2 shrink-0 rounded-full bg-muted opacity-60"
      />
    </template>
  </PinInputRoot>
</template>
