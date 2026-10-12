<script lang="ts">
export default { inheritAttrs: false }

export interface RangeCalendarLabels extends Record<string, string> {
  previous: string
  next: string
}
</script>

<script setup lang="ts">
/*
 * Inline range calendar (reka RangeCalendar). Like LpCalendar the model is ISO
 * strings, here `{ start, end }`, both inclusive. A range is emitted only once
 * both ends are picked: the half-picked state lives inside the calendar, so a
 * consumer never sees a range with a missing end.
 */
import { type DateValue, getLocalTimeZone, today } from "@internationalized/date"
import {
  type DateRange as RekaRange,
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHead,
  RangeCalendarGridRow,
  RangeCalendarHeadCell,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNext,
  RangeCalendarPrev,
  RangeCalendarRoot,
} from "reka-ui"
import { computed, shallowRef, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { type DateRange, normalizeRange, parseIsoDay } from "./dateRange"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    /** Selected range, ISO "YYYY-MM-DD" ends (v-model). */
    modelValue?: DateRange
    min?: string
    max?: string
    /** Days that cannot be picked at all. */
    isDisabled?: (iso: string) => boolean
    /** Days a range may not include (struck through, and a range cannot span them). */
    isDateUnavailable?: (iso: string) => boolean
    /** Months shown side by side. */
    months?: number
    /** Longest allowed range, in days. */
    maximumDays?: number
    locale?: string
    weekdayFormat?: "narrow" | "short" | "long"
    labels?: Partial<RangeCalendarLabels>
  }>(),
  { months: 1, weekdayFormat: "short" },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: DateRange): void
}>()

const text = useLabels<RangeCalendarLabels>(
  "rangeCalendar",
  { previous: "Previous month", next: "Next month" },
  () => props.labels,
)

function toReka(range: DateRange | undefined): RekaRange {
  const r = normalizeRange(range)
  return { start: parseIsoDay(r?.start), end: parseIsoDay(r?.end) }
}

const draft = shallowRef<RekaRange>(toReka(props.modelValue))
watch(
  () => [props.modelValue?.start, props.modelValue?.end],
  () => {
    draft.value = toReka(props.modelValue)
  },
)

const placeholder = shallowRef<DateValue>(draft.value.start ?? today(getLocalTimeZone()))

function onUpdate(v: RekaRange | null) {
  draft.value = v ?? { start: undefined, end: undefined }
  if (v?.start && v.end) emit("update:modelValue", { start: v.start.toString(), end: v.end.toString() })
}

const minValue = computed(() => parseIsoDay(props.min))
const maxValue = computed(() => parseIsoDay(props.max))
const disabledFor = (date: DateValue) => props.isDisabled?.(date.toString()) ?? false
const unavailableFor = (date: DateValue) => props.isDateUnavailable?.(date.toString()) ?? false

const navBtn =
  "flex size-8 items-center justify-center rounded-control text-muted outline-none transition-[color,background-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:bg-surface-soft hover:text-ink active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring"

const { class: rootClass, attrs: rest } = useMergedAttrs(
  "inline-block rounded-card border border-line bg-surface-raised p-3",
)
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ weekDays, grid }"
    v-model:placeholder="placeholder"
    :model-value="draft"
    :min-value="minValue"
    :max-value="maxValue"
    :is-date-disabled="disabledFor"
    :is-date-unavailable="unavailableFor"
    :number-of-months="months"
    :maximum-days="maximumDays"
    :locale="locale"
    :weekday-format="weekdayFormat"
    prevent-deselect
    paged-navigation
    fixed-weeks
    :class="rootClass"
    v-bind="rest"
    @update:model-value="onUpdate"
  >
    <RangeCalendarHeader class="mb-2 flex items-center justify-between gap-2">
      <RangeCalendarPrev :class="navBtn" :aria-label="text.previous">
        <LpIcon name="lucide:chevron-left" :size="16" />
      </RangeCalendarPrev>
      <RangeCalendarHeading class="text-sm font-semibold text-ink" />
      <RangeCalendarNext :class="navBtn" :aria-label="text.next">
        <LpIcon name="lucide:chevron-right" :size="16" />
      </RangeCalendarNext>
    </RangeCalendarHeader>

    <div class="flex gap-4">
      <RangeCalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
        class="border-collapse select-none"
      >
        <RangeCalendarGridHead>
          <RangeCalendarGridRow class="mb-1 flex">
            <RangeCalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="w-9 text-center text-[11px] font-medium text-muted"
            >
              {{ day }}
            </RangeCalendarHeadCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridHead>
        <RangeCalendarGridBody>
          <RangeCalendarGridRow v-for="(weekDates, i) in month.rows" :key="`w-${i}`" class="flex">
            <RangeCalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="py-0.5"
            >
              <!-- Inside the range the pill joins its neighbours (no gap, no
                   rounding); the two ends keep the solid brand pill. The
                   preview while picking is lighter: with maximumDays reka
                   highlights the whole reachable window, not the range. -->
              <RangeCalendarCellTrigger
                :day="weekDate"
                :month="month.value"
                class="flex h-8 w-9 items-center justify-center rounded-control text-sm text-ink outline-none transition-[color,background-color] duration-[var(--duration-fast)] hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring data-[outside-view]:text-muted/40 data-[today]:font-semibold data-[today]:not-data-[selected]:text-brand data-[selected]:rounded-none data-[selected]:bg-brand-soft data-[highlighted]:rounded-none data-[highlighted]:bg-brand-soft/60 data-[selection-start]:rounded-l-control data-[highlighted-start]:rounded-l-control data-[selection-end]:rounded-r-control data-[highlighted-end]:rounded-r-control data-[selection-start]:bg-brand data-[selection-start]:font-semibold data-[selection-start]:text-ink-inverse data-[selection-end]:bg-brand data-[selection-end]:font-semibold data-[selection-end]:text-ink-inverse data-[outside-view]:data-[selected]:bg-transparent data-[outside-view]:data-[highlighted]:bg-transparent data-[disabled]:pointer-events-none data-[disabled]:opacity-35 data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-35"
              />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
  </RangeCalendarRoot>
</template>
