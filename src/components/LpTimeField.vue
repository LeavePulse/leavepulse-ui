<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Time-of-day field: hour and minute segments, typed or stepped with the arrow
 * keys (reka TimeField). The model is "HH:mm" (v-model), the same shape a
 * native `<input type="time">` produces, so it drops into a form that used one.
 *
 * It exists because the native input is painted by the browser in the user's
 * system locale — a 24-hour app shows "--:-- --" with an AM/PM segment, in the
 * browser's chrome rather than the kit's. Here the clock is fixed by
 * `hourCycle` (24 by default) and the segments are themed like every other
 * field.
 */
import { Time } from "@internationalized/date"
import { TimeFieldInput, TimeFieldRoot } from "reka-ui"
import { computed } from "vue"
import { focusLeft, useFieldControl } from "../composables/useField"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Selected time "HH:mm" (v-model). */
    modelValue?: string
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    /** 24 or 12-hour clock, independent of the browser locale. */
    hourCycle?: 12 | 24
    /** Locale for segment order and the AM/PM marker in 12-hour mode. */
    locale?: string
    /** Show the clock icon at the start of the field. */
    icon?: boolean
  }>(),
  { size: "md", hourCycle: 24, icon: true },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string | undefined): void
  (e: "blur", event: FocusEvent): void
}>()

function onFocusOut(event: FocusEvent) {
  if (focusLeft(event)) emit("blur", event)
}

const value = computed(() => {
  const match = /^(\d{2}):(\d{2})/.exec(props.modelValue || "")
  return match ? new Time(Number(match[1]), Number(match[2])) : undefined
})

function onUpdate(next: unknown) {
  if (!next || typeof next !== "object" || !("hour" in next) || !("minute" in next)) {
    emit("update:modelValue", undefined)
    return
  }
  const pad = (n: unknown) => String(n).padStart(2, "0")
  emit("update:modelValue", `${pad(next.hour)}:${pad(next.minute)}`)
}

const field = useFieldControl(() => ({
  wrapped: false,
  invalid: props.invalid,
  disabled: props.disabled,
}))

const shellSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

// `w-full` is the default, not a rule: a time column of `w-28` must win over it.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "flex w-full items-center gap-0.5 rounded-control border bg-surface-soft px-3 text-ink transition-colors duration-[var(--duration-fast)] focus-within:ring-2 focus-within:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55",
    shellSize[props.size],
    field.value.invalid ? "border-danger focus-within:ring-danger-soft" : "border-line focus-within:border-brand",
  ].join(" "),
)
</script>

<template>
  <TimeFieldRoot
    v-slot="{ segments }"
    :model-value="value"
    :hour-cycle="hourCycle"
    :locale="locale"
    granularity="minute"
    :disabled="field.disabled"
    :required="field.required"
    :aria-invalid="field.invalid || undefined"
    :aria-describedby="field.describedBy"
    :aria-labelledby="field.labelId"
    :class="rootClass"
    v-bind="rest"
    @update:model-value="onUpdate"
    @focusout="onFocusOut"
  >
    <LpIcon v-if="icon" name="lucide:clock" :size="15" class="mr-1.5 shrink-0 text-muted" />
    <!-- Indexed keys: in 12-hour mode the segments hold two "literal" parts
         (the ":" and the space before AM/PM), which a key by part repeats. -->
    <template v-for="(item, i) in segments" :key="i">
      <TimeFieldInput v-if="item.part === 'literal'" :part="item.part" class="text-muted">
        {{ item.value }}
      </TimeFieldInput>
      <TimeFieldInput
        v-else
        :part="item.part"
        class="rounded-sm px-0.5 tabular-nums outline-none focus:bg-brand-soft focus:text-brand data-[placeholder]:text-muted"
      >
        {{ item.value }}
      </TimeFieldInput>
    </template>
  </TimeFieldRoot>
</template>
