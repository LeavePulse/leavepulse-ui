<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Inline month calendar (reka Calendar). The kit-facing model is an ISO date
 * STRING ("YYYY-MM-DD"), not reka's DateValue — we convert at the boundary so
 * callers never touch @internationalized/date. Single-date selection; min/max
 * bounds and an isDisabled predicate (also taking ISO strings). Themed via
 * tokens, with the brand pill marking the selected day.
 *
 * It takes the same core props as LpRangeCalendar (unavailable days, several
 * months, locale, labels), so switching a form between one day and a range
 * changes the component, not what can be said to it.
 */
import { type DateValue, parseDate, today, getLocalTimeZone } from "@internationalized/date"
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeader,
  CalendarHeading,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
} from "reka-ui"
import { computed, shallowRef } from "vue"
import LpIcon from "./LpIcon.vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { CALENDAR_FRAME, CALENDAR_LABELS, CALENDAR_NAV, type CalendarLabels } from "./calendar"

const props = withDefaults(
  defineProps<{
    /** Selected date as "YYYY-MM-DD" (v-model). */
    modelValue?: string
    /** Earliest selectable date, "YYYY-MM-DD". */
    min?: string
    /** Latest selectable date, "YYYY-MM-DD". */
    max?: string
    /** Predicate to disable specific days; receives the ISO string. */
    isDisabled?: (iso: string) => boolean
    /** Days shown struck through and not pickable (booked, sold out), as on LpRangeCalendar. */
    isDateUnavailable?: (iso: string) => boolean
    /** Months shown side by side. */
    months?: number
    /** Locale of the heading and weekdays; defaults to reka's ConfigProvider, then the browser. */
    locale?: string
    weekdayFormat?: "narrow" | "short" | "long"
    labels?: Partial<CalendarLabels>
  }>(),
  { months: 1, weekdayFormat: "short" },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string | undefined): void
}>()

// ISO string ⇄ reka DateValue. parseDate throws on junk, so guard.
function toDate(iso?: string): DateValue | undefined {
  if (!iso) return undefined
  try {
    return parseDate(iso)
  } catch {
    return undefined
  }
}

const value = computed<DateValue | undefined>(() => toDate(props.modelValue))
const minValue = computed(() => toDate(props.min))
const maxValue = computed(() => toDate(props.max))
/*
 * The month in view is reka's own state, bound two-way. Handed in one-way it
 * was a computed of the value, so reka's month buttons wrote into nothing.
 * reka itself moves the view to a value set from outside (a preset, a reset).
 */
const placeholder = shallowRef<DateValue>(value.value ?? today(getLocalTimeZone()))

const text = useLabels<CalendarLabels>("calendar", CALENDAR_LABELS, () => props.labels)

function onUpdate(v: DateValue | undefined) {
  emit("update:modelValue", v?.toString())
}

function disabledFor(date: DateValue): boolean {
  return props.isDisabled?.(date.toString()) ?? false
}

function unavailableFor(date: DateValue): boolean {
  return props.isDateUnavailable?.(date.toString()) ?? false
}

// The calendar draws its own card frame, which has to give way when it is placed inside a popover that already has one.
const { class: rootClass, attrs: rest } = useMergedAttrs(CALENDAR_FRAME)
</script>

<template>
  <CalendarRoot
    v-slot="{ weekDays, grid }"
    :model-value="value"
    :min-value="minValue"
    :max-value="maxValue"
    v-model:placeholder="placeholder"
    :weekday-format="weekdayFormat"
    :is-date-disabled="disabledFor"
    :is-date-unavailable="unavailableFor"
    :number-of-months="months"
    :locale="locale"
    paged-navigation
    fixed-weeks
    :class="rootClass"
    v-bind="rest"
    @update:model-value="onUpdate"
  >
    <CalendarHeader class="mb-2 flex items-center justify-between gap-2">
      <CalendarPrev :class="CALENDAR_NAV" :aria-label="text.previous">
        <LpIcon name="lucide:chevron-left" :size="16" />
      </CalendarPrev>
      <CalendarHeading class="text-sm font-semibold text-ink" />
      <CalendarNext :class="CALENDAR_NAV" :aria-label="text.next">
        <LpIcon name="lucide:chevron-right" :size="16" />
      </CalendarNext>
    </CalendarHeader>

    <div class="flex gap-4">
      <CalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
        class="w-full border-collapse select-none"
      >
        <CalendarGridHead>
          <CalendarGridRow class="mb-1 flex">
            <CalendarHeadCell
              v-for="day in weekDays"
              :key="day"
              class="w-9 text-center text-[11px] font-medium text-muted"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow
            v-for="(weekDates, i) in month.rows"
            :key="`w-${i}`"
            class="flex"
          >
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
              class="p-0.5"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="month.value"
                class="flex size-8 items-center justify-center rounded-control text-sm text-ink outline-none transition-[color,background-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:bg-surface-soft active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring data-[outside-view]:text-muted/40 data-[today]:font-semibold data-[today]:not-data-[selected]:text-brand data-[selected]:bg-brand data-[selected]:font-semibold data-[selected]:text-ink-inverse data-[selected]:hover:bg-brand-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-35 data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-35"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>
