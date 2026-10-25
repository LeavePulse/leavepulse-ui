<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Range field + popover: presets on one side, a range calendar on the other.
 * The model is `{ start, end }` of ISO days, like LpDatePicker's single day.
 * Picking the second end or a preset fills the field and closes the popover.
 * Two months sit side by side where there is room, one on a phone.
 */
import { computed, ref, useAttrs } from "vue"
import { useFieldControl } from "../composables/useField"
import { useLocale } from "../composables/useLocale"
import { useLabels } from "../composables/useLpConfig"
import { useMediaQuery } from "../composables/useMediaQuery"
import {
  allowedRange,
  type DateRange,
  type DateRangePreset,
  defaultRangePresets,
  formatRange,
  normalizeRange,
  sameRange,
} from "./dateRange"
import type { CalendarLabels } from "./calendar"
import PickerField from "./PickerField.vue"
import LpRangeCalendar, { type RangeChange } from "./LpRangeCalendar.vue"

export interface DateRangePickerLabels extends Record<string, string> {
  placeholder: string
  clear: string
  presets: string
  today: string
  last7: string
  last30: string
  thisMonth: string
  lastMonth: string
}

const props = withDefaults(
  defineProps<{
    /** Selected range (v-model). */
    modelValue?: DateRange
    placeholder?: string
    min?: string
    max?: string
    isDisabled?: (iso: string) => boolean
    isDateUnavailable?: (iso: string) => boolean
    /** Longest allowed range, in days. */
    maximumDays?: number
    /** Shortcut ranges; an empty list hides them. Defaults to the built-in set. */
    presets?: DateRangePreset[]
    clearable?: boolean
    disabled?: boolean
    invalid?: boolean
    size?: "sm" | "md" | "lg"
    locale?: string
    /** Intl format for the displayed ends. */
    format?: Intl.DateTimeFormatOptions
    /**
     * The picker's own text, plus `previous` / `next` handed on to the
     * calendar inside (whose app-wide scope is "rangeCalendar").
     */
    labels?: Partial<DateRangePickerLabels & CalendarLabels>
  }>(),
  { size: "md" },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: DateRange | undefined): void
}>()

const text = useLabels<DateRangePickerLabels>(
  "dateRangePicker",
  {
    placeholder: "Pick a date range",
    clear: "Clear",
    presets: "Presets",
    today: "Today",
    last7: "Last 7 days",
    last30: "Last 30 days",
    thisMonth: "This month",
    lastMonth: "Last month",
  },
  () => props.labels,
)

const open = ref(false)
const value = computed(() => normalizeRange(props.modelValue))
const locale = useLocale(() => props.locale)
const display = computed(() => (value.value ? formatRange(value.value, locale.value, props.format) : ""))

const presetList = computed<DateRangePreset[]>(() => {
  return props.presets ?? defaultRangePresets(text.value)
})

/*
 * A range picked on the calendar keeps the popover open: the field already
 * shows it, and the user can still pull either end before clicking away.
 * Closing on the second click left no moment to adjust. A preset is a whole
 * answer, so it closes.
 */
function pick(range: DateRange, change?: RangeChange) {
  emit("update:modelValue", range)
  if (!change) open.value = false
}

const rules = computed(() => ({
  min: props.min,
  max: props.max,
  isDisabled: props.isDisabled,
  isDateUnavailable: props.isDateUnavailable,
  maximumDays: props.maximumDays,
}))

function pickPreset(preset: DateRangePreset) {
  const range = allowedRange(preset.range(), rules.value)
  if (range) pick(range)
}

function presetFits(preset: DateRangePreset): boolean {
  return !!allowedRange(preset.range(), rules.value)
}

const wide = useMediaQuery("(min-width: 640px)")

const attrs = useAttrs()
const field = useFieldControl(() => ({
  wrapped: false,
  id: typeof attrs.id === "string" ? attrs.id : undefined,
  invalid: props.invalid,
  disabled: props.disabled,
}))
const showClear = computed(() => props.clearable && !!value.value && !field.value.disabled)

const presetOptions = computed(() => presetList.value.map((preset) => ({
  label: preset.label,
  disabled: !presetFits(preset),
  selected: sameRange(value.value, preset.range()),
  select: () => pickPreset(preset),
})))
</script>

<template>
  <PickerField
    v-bind="attrs"
    v-model:open="open"
    :field="field"
    :display="display"
    :placeholder="placeholder || text.placeholder"
    icon="lucide:calendar-range"
    :size="size"
    :clearable="showClear"
    :clear-label="text.clear"
    :presets-label="text.presets"
    :presets="presetOptions"
    presets-class="sm:w-40"
    @clear="emit('update:modelValue', undefined)"
  >
    <LpRangeCalendar
      :model-value="value"
      :min="min"
      :max="max"
      :is-disabled="isDisabled"
      :is-date-unavailable="isDateUnavailable"
      :maximum-days="maximumDays"
      :months="wide ? 2 : 1"
      :locale="locale"
      :labels="labels"
      class="border-0 bg-transparent"
      @update:model-value="pick"
    />
  </PickerField>
</template>
