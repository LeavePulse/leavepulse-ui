<script setup lang="ts">
/*
 * Inline month calendar (reka Calendar). The kit-facing model is an ISO date
 * STRING ("YYYY-MM-DD"), not reka's DateValue — we convert at the boundary so
 * callers never touch @internationalized/date. Single-date selection; min/max
 * bounds and an isDisabled predicate (also taking ISO strings). Themed via
 * tokens, with the brand pill marking the selected day.
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
import { computed } from "vue"
import LpIcon from "./LpIcon.vue"

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
    weekdayFormat?: "narrow" | "short" | "long"
  }>(),
  { weekdayFormat: "short" },
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
const placeholderValue = computed(() => value.value ?? today(getLocalTimeZone()))

function onUpdate(v: DateValue | undefined) {
  emit("update:modelValue", v?.toString())
}

function disabledFor(date: DateValue): boolean {
  return props.isDisabled?.(date.toString()) ?? false
}

const navBtn =
  "flex size-8 items-center justify-center rounded-control text-muted outline-none transition-[color,background-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:bg-surface-soft hover:text-ink active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring"
</script>

<template>
  <CalendarRoot
    v-slot="{ weekDays, grid }"
    :model-value="value"
    :min-value="minValue"
    :max-value="maxValue"
    :placeholder="placeholderValue"
    :weekday-format="weekdayFormat"
    :is-date-disabled="disabledFor"
    fixed-weeks
    class="inline-block rounded-card border border-line bg-surface-raised p-3"
    @update:model-value="onUpdate"
  >
    <CalendarHeader class="mb-2 flex items-center justify-between gap-2">
      <CalendarPrev :class="navBtn" aria-label="Previous month">
        <LpIcon name="lucide:chevron-left" :size="16" />
      </CalendarPrev>
      <CalendarHeading class="text-sm font-semibold text-ink" />
      <CalendarNext :class="navBtn" aria-label="Next month">
        <LpIcon name="lucide:chevron-right" :size="16" />
      </CalendarNext>
    </CalendarHeader>

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
  </CalendarRoot>
</template>
