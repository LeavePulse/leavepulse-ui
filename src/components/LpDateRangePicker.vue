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
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui"
import { computed, ref, useAttrs } from "vue"
import { useFieldControl } from "../composables/useField"
import { useLocale } from "../composables/useLocale"
import { useLabels } from "../composables/useLpConfig"
import { mergeClass } from "../composables/useMergedClass"
import { useMediaQuery } from "../composables/useMediaQuery"
import {
  clampRange,
  type DateRange,
  type DateRangePreset,
  defaultRangePresets,
  formatRange,
  normalizeRange,
  sameRange,
} from "./dateRange"
import { POPOVER_PANEL } from "./dropdown"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
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
    labels?: Partial<DateRangePickerLabels>
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

function pickPreset(preset: DateRangePreset) {
  const range = clampRange(preset.range(), props.min, props.max)
  if (range) pick(range)
}

function presetFits(preset: DateRangePreset): boolean {
  return !!clampRange(preset.range(), props.min, props.max)
}

const wide = useMediaQuery("(min-width: 640px)")

const shellSize = {
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
const showClear = computed(() => props.clearable && !!value.value && !field.value.disabled)
</script>

<template>
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
          <LpIcon name="lucide:calendar-range" :size="16" class="shrink-0 text-muted" />
          <LpRollingText
            :value="display || placeholder || text.placeholder"
            align="start"
            class="min-w-0 flex-1"
            :class="display ? '' : 'text-muted'"
          />
          <span v-if="showClear" class="w-[15px] shrink-0" aria-hidden="true" />
          <LpIcon
            name="lucide:chevron-down"
            :size="15"
            class="shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          :side-offset="6"
          align="start"
          :collision-padding="8"
          :class="[POPOVER_PANEL, 'z-(--z-popover) flex max-w-[calc(100vw-1rem)] flex-col rounded-card p-0 outline-none sm:flex-row']"
        >
          <div
            v-if="presetList.length"
            role="group"
            :aria-label="text.presets"
            class="flex gap-1 overflow-x-auto border-b border-line p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0"
          >
            <button
              v-for="(preset, i) in presetList"
              :key="`${i}:${preset.label}`"
              type="button"
              :disabled="!presetFits(preset)"
              :aria-pressed="sameRange(value, preset.range())"
              class="shrink-0 rounded-control px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:bg-surface-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-brand-soft aria-pressed:text-ink"
              @click="pickPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>
          <LpRangeCalendar
            :model-value="value"
            :min="min"
            :max="max"
            :is-disabled="isDisabled"
            :is-date-unavailable="isDateUnavailable"
            :maximum-days="maximumDays"
            :months="wide ? 2 : 1"
            :locale="locale"
            class="border-0 bg-transparent"
            @update:model-value="pick"
          />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <button
      v-if="showClear"
      type="button"
      :aria-label="text.clear"
      class="absolute top-1/2 right-[calc(0.75rem+15px+0.5rem)] flex -translate-y-1/2 items-center rounded-sm text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
      @click="emit('update:modelValue', undefined)"
    >
      <LpIcon name="lucide:x" :size="15" />
    </button>
  </div>
</template>
