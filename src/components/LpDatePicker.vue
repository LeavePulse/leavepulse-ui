<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Date field + calendar popover. The model is an ISO date string ("YYYY-MM-DD",
 * v-model), same as LpCalendar (which it embeds). The trigger shows a formatted
 * date; picking a day fills the field and closes the popover. Clearable, with
 * min/max + isDisabled forwarded to the calendar. Themed like the other inputs.
 *
 * With `time`, the model carries a minute too ("YYYY-MM-DDTHH:mm") and the
 * popover grows a time row (LpTimeField) under the calendar. Anything that
 * needs a moment rather than a day — an expiry, a scheduled start — would
 * otherwise fall back to a native `datetime-local`, which the browser paints in
 * its own locale and chrome, breaking the form it sits in. Picking a day keeps the time already
 * chosen (default `defaultTime`), so the popover closes on the first click for
 * the common case.
 */
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui"
import { computed, ref, useAttrs } from "vue"
import { useFieldControl } from "../composables/useField"
import { useLabels } from "../composables/useLpConfig"
import { mergeClass } from "../composables/useMergedClass"
import { POPOVER_PANEL } from "./dropdown"
import LpCalendar from "./LpCalendar.vue"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import LpTimeField from "./LpTimeField.vue"

const props = withDefaults(
  defineProps<{
    /** Selected date "YYYY-MM-DD" (v-model). */
    modelValue?: string
    placeholder?: string
    min?: string
    max?: string
    isDisabled?: (iso: string) => boolean
    clearable?: boolean
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    /** Intl format for the displayed date. */
    format?: Intl.DateTimeFormatOptions
    /** Also pick a minute; the model becomes "YYYY-MM-DDTHH:mm". */
    time?: boolean
    /** Time a freshly picked day starts at, "HH:mm". */
    defaultTime?: string
    /** Label of the button that closes the popover in `time` mode. */
    doneLabel?: string
  }>(),
  {
    placeholder: "Pick a date",
    size: "md",
    format: () => ({ year: "numeric", month: "short", day: "numeric" }),
    defaultTime: "00:00",
    doneLabel: "Done",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string | undefined): void
}>()

const open = ref(false)

/** Day half of the model; the calendar never sees the time. */
const day = computed(() => (props.modelValue || "").slice(0, 10))

/** Minute half, "HH:mm" — empty when the model carries a date only. */
const minute = computed(() => {
  const at = (props.modelValue || "").slice(11, 16)
  return /^\d{2}:\d{2}$/.test(at) ? at : ""
})

const display = computed(() => {
  if (!props.modelValue) return ""
  // Parse as local midnight so the formatted day can't drift across a timezone.
  const [y, m, d] = day.value.split("-").map(Number)
  if (!y || !m || !d) return props.modelValue
  const shown = new Intl.DateTimeFormat(undefined, props.format).format(new Date(y, m - 1, d))
  return props.time && minute.value ? `${shown}, ${minute.value}` : shown
})

const shellSize = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
}

function onPick(picked: string | undefined) {
  // Clicking the selected day again is the calendar's "deselect". Here it is
  // someone confirming the date they already have, so it keeps the value and
  // closes like any other pick; clearing has its own button.
  const v = picked ?? (day.value || undefined)
  if (!props.time) {
    emit("update:modelValue", v)
    open.value = false
    return
  }
  // The popover stays open: the time row below is part of the same choice, and
  // closing on the day would hide it right as it becomes reachable.
  emit("update:modelValue", v ? `${v}T${minute.value || props.defaultTime}` : undefined)
}

function onTime(at: string) {
  // A time without a day would be a model no consumer can use; until a day is
  // picked the row is disabled, so this only guards a stray event.
  if (!day.value) return
  emit("update:modelValue", `${day.value}T${at || props.defaultTime}`)
}

function clear() {
  emit("update:modelValue", undefined)
}

const attrs = useAttrs()
const field = useFieldControl(() => ({
  wrapped: false,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid,
  disabled: props.disabled,
}))
const labels = useLabels("datePicker", { clear: "Clear" })
const showClear = computed(() => props.clearable && !!props.modelValue && !field.value.disabled)
</script>

<template>
  <!-- The clear control sits beside the trigger, not inside it: a button
       nested in a button is invalid, and the nested one was unreachable by
       keyboard. -->
  <div :class="mergeClass('relative w-full', attrs.class as string)" :style="attrs.style as never">
    <PopoverRoot v-model:open="open">
      <PopoverTrigger as-child>
        <button
          v-bind="{ ...attrs, class: undefined, style: undefined }"
          :id="field.id"
          type="button"
          :disabled="field.disabled"
          :aria-invalid="field.invalid || undefined"
          :aria-describedby="field.describedBy"
          class="group flex w-full items-center gap-2 rounded-control border bg-surface-soft px-3 text-left text-ink outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-brand disabled:cursor-not-allowed disabled:opacity-55"
          :class="[
            shellSize[size],
            field.invalid ? 'border-danger focus-visible:ring-danger-soft' : 'border-line focus-visible:border-brand',
          ]"
        >
          <LpIcon name="lucide:calendar" :size="16" class="shrink-0 text-muted" />
          <LpRollingText
            :value="display || placeholder || ''"
            align="start"
            class="min-w-0 flex-1"
            :class="display ? '' : 'text-muted'"
          />
          <span v-if="showClear" class="w-[15px] shrink-0" aria-hidden="true" />
          <LpIcon
            name="lucide:chevron-down"
            :size="15"
            class="shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[state=open]:rotate-180"
          />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          :collision-padding="8"
          :side-offset="6"
          align="start"
          :class="[POPOVER_PANEL, 'z-(--z-popover) rounded-card p-0 outline-none']"
        >
          <LpCalendar
            :model-value="day"
            :min="min"
            :max="max"
            :is-disabled="isDisabled"
            class="border-0 bg-transparent"
            @update:model-value="onPick"
          />
          <div v-if="time" class="flex items-center gap-2 border-t border-line px-3 py-2">
            <LpIcon name="lucide:clock" :size="15" class="shrink-0 text-muted" />
            <LpTimeField
              :model-value="minute || undefined"
              :disabled="!day"
              :icon="false"
              size="sm"
              class="flex-1"
              @update:model-value="(at) => onTime(at || '')"
            />
            <button
              type="button"
              class="shrink-0 rounded-control px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
              @click="open = false"
            >
              {{ doneLabel }}
            </button>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <!-- Positioned over the spacer the trigger leaves for it, just before the
         chevron (gap-2 + 15px chevron + px-3 from the right edge). -->
    <button
      v-if="showClear"
      type="button"
      :aria-label="labels.clear"
      class="absolute top-1/2 right-[calc(0.75rem+15px+0.5rem)] flex -translate-y-1/2 items-center rounded-sm text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
      @click="clear"
    >
      <LpIcon name="lucide:x" :size="15" />
    </button>
  </div>
</template>
