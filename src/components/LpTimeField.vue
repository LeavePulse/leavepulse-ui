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
}>()

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

const shellSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}
</script>

<template>
  <TimeFieldRoot
    v-slot="{ segments }"
    :model-value="value"
    :hour-cycle="hourCycle"
    :locale="locale"
    granularity="minute"
    :disabled="disabled"
    class="flex w-full items-center gap-0.5 rounded-control border bg-surface-soft px-3 text-ink transition-colors duration-[var(--duration-fast)] focus-within:ring-2 focus-within:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55"
    :class="[
      shellSize[size],
      invalid ? 'border-danger focus-within:ring-danger-soft' : 'border-line focus-within:border-brand',
    ]"
    @update:model-value="onUpdate"
  >
    <LpIcon v-if="icon" name="lucide:clock" :size="15" class="mr-1.5 shrink-0 text-muted" />
    <template v-for="item in segments" :key="item.part">
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
