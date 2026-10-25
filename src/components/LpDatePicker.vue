<script lang="ts">
export default { inheritAttrs: false }

export interface DatePickerLabels extends Record<string, string> {
  placeholder: string
  clear: string
  done: string
  presets: string
  today: string
  tomorrow: string
  inWeek: string
}
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
 *
 * It takes the same core props as LpDateRangePicker (locale, unavailable days,
 * presets, labels); presets here are single days ("Today", "Tomorrow", "In a
 * week") and, unlike the range picker's, are opt-in, so forms that already use
 * the picker keep the plain calendar they were laid out around.
 */
import { computed, ref, useAttrs } from "vue"
import { useFieldControl } from "../composables/useField"
import { useLocale } from "../composables/useLocale"
import { useLabels } from "../composables/useLpConfig"
import type { CalendarLabels } from "./calendar"
import { type DatePreset, dayAllowed, defaultDatePresets } from "./dateRange"
import LpCalendar from "./LpCalendar.vue"
import LpIcon from "./LpIcon.vue"
import PickerField from "./PickerField.vue"
import LpTimeField from "./LpTimeField.vue"

const props = withDefaults(
  defineProps<{
    /** Selected date "YYYY-MM-DD" (v-model). */
    modelValue?: string
    placeholder?: string
    min?: string
    max?: string
    isDisabled?: (iso: string) => boolean
    /** Days shown struck through and not pickable, as on LpDateRangePicker. */
    isDateUnavailable?: (iso: string) => boolean
    /**
     * Shortcut days beside the calendar. `true` shows the built-in set (Today,
     * Tomorrow, In a week); a list replaces it. Off by default.
     */
    presets?: DatePreset[] | boolean
    clearable?: boolean
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    /** Locale of the shown date and the calendar; defaults to reka's ConfigProvider, then the browser. */
    locale?: string
    /** Intl format for the displayed date. */
    format?: Intl.DateTimeFormatOptions
    /** Also pick a minute; the model becomes "YYYY-MM-DDTHH:mm". */
    time?: boolean
    /** Time a freshly picked day starts at, "HH:mm". */
    defaultTime?: string
    /** Label of the button that closes the popover in `time` mode. Wins over `labels.done`. */
    doneLabel?: string
    /**
     * The picker's own text, plus `previous` / `next` handed on to the
     * calendar inside (whose app-wide scope is "calendar").
     */
    labels?: Partial<DatePickerLabels & CalendarLabels>
  }>(),
  {
    size: "md",
    format: () => ({ year: "numeric", month: "short", day: "numeric" }),
    defaultTime: "00:00",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string | undefined): void
  (e: "blur", event: FocusEvent): void
}>()

const open = ref(false)

/** Day half of the model; the calendar never sees the time. */
const day = computed(() => (props.modelValue || "").slice(0, 10))

/** Minute half, "HH:mm" — empty when the model carries a date only. */
const minute = computed(() => {
  const at = (props.modelValue || "").slice(11, 16)
  return /^\d{2}:\d{2}$/.test(at) ? at : ""
})

const locale = useLocale(() => props.locale)
const display = computed(() => {
  if (!props.modelValue) return ""
  // Parse as local midnight so the formatted day can't drift across a timezone.
  const [y, m, d] = day.value.split("-").map(Number)
  if (!y || !m || !d) return props.modelValue
  const shown = new Intl.DateTimeFormat(locale.value, props.format).format(new Date(y, m - 1, d))
  return props.time && minute.value ? `${shown}, ${minute.value}` : shown
})

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
const text = useLabels<DatePickerLabels>(
  "datePicker",
  {
    placeholder: "Pick a date",
    clear: "Clear",
    done: "Done",
    presets: "Presets",
    today: "Today",
    tomorrow: "Tomorrow",
    inWeek: "In a week",
  },
  () => props.labels,
)

const presetList = computed<DatePreset[]>(() => {
  if (Array.isArray(props.presets)) return props.presets
  return props.presets ? defaultDatePresets(text.value) : []
})

function presetFits(preset: DatePreset): boolean {
  return dayAllowed(preset.date(), props)
}

// A preset is a day like any other click: it closes the popover, or in `time`
// mode keeps it open with the minute already chosen.
function pickPreset(preset: DatePreset) {
  if (presetFits(preset)) onPick(preset.date())
}

const showClear = computed(() => props.clearable && !!props.modelValue && !field.value.disabled)

const presetOptions = computed(() => presetList.value.map((preset) => ({
  label: preset.label,
  disabled: !presetFits(preset),
  selected: !!day.value && day.value === preset.date(),
  select: () => pickPreset(preset),
})))
</script>

<template>
  <PickerField
    v-bind="attrs"
    v-model:open="open"
    :field="field"
    :display="display"
    :placeholder="placeholder ?? text.placeholder"
    icon="lucide:calendar"
    :size="size"
    :clearable="showClear"
    :clear-label="text.clear"
    :presets-label="text.presets"
    :presets="presetOptions"
    presets-class="sm:w-36"
    @clear="clear"
    @blur="emit('blur', $event)"
  >
    <div class="flex flex-col">
      <LpCalendar
        :model-value="day"
        :min="min"
        :max="max"
        :is-disabled="isDisabled"
        :is-date-unavailable="isDateUnavailable"
        :locale="locale"
        :labels="labels"
        class="border-0 bg-transparent"
        @update:model-value="onPick"
      />
      <div v-if="time" class="flex items-center gap-2 border-t border-line px-3 py-2">
        <LpIcon name="lucide:clock" :size="15" class="shrink-0 text-muted" />
        <LpTimeField
          :model-value="minute || undefined"
          :disabled="!day"
          :icon="false"
          :locale="locale"
          size="sm"
          class="flex-1"
          @update:model-value="(at) => onTime(at || '')"
        />
        <button
          type="button"
          class="shrink-0 rounded-control px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
          @click="open = false"
        >
          {{ doneLabel ?? text.done }}
        </button>
      </div>
    </div>
  </PickerField>
</template>
