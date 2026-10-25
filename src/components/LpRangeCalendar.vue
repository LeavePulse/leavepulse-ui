<script lang="ts">
import type { CalendarLabels } from "./calendar"

export default { inheritAttrs: false }

/** The month buttons' names; the same shape as LpCalendar's. */
export type RangeCalendarLabels = CalendarLabels

/** How a range changed: picked by two clicks, or an end reshaped. */
export type RangeChange = { via: "pick" | "drag" | "keyboard" }
</script>

<script setup lang="ts">
/*
 * Inline range calendar (reka RangeCalendar). Like LpCalendar the model is ISO
 * strings, here `{ start, end }`, both inclusive. A range is emitted only once
 * both ends are picked: the half-picked state lives inside the calendar, so a
 * consumer never sees a range with a missing end.
 *
 * Ranges can be pressed out the way text is selected on a phone: drag across
 * days to pick one, or grab either end of a finished range and drag it, across
 * rows and into the other month; dragging past the other end flips them. Shift+arrows move the
 * focused end from the keyboard. A reshape emits with `{ via: "drag" }` (or
 * "keyboard"), so a popover around the calendar can stay open while the user
 * fine-tunes instead of closing on the first nudge.
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { CALENDAR_FRAME, CALENDAR_LABELS, CALENDAR_NAV } from "./calendar"
import { type DateRange, normalizeRange, parseIsoDay, reshapeRange } from "./dateRange"
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
  (e: "update:modelValue", value: DateRange, change: RangeChange): void
}>()

const text = useLabels<RangeCalendarLabels>("rangeCalendar", CALENDAR_LABELS, () => props.labels)

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
  if (v?.start && v.end) emit("update:modelValue", { start: v.start.toString(), end: v.end.toString() }, { via: "pick" })
}

const committed = computed(() => normalizeRange(props.modelValue))

/** Whether a day may sit inside a reshaped range. */
function allowed(iso: string): boolean {
  const day = parseIsoDay(iso)
  if (!day) return false
  if (minValue.value && day.compare(minValue.value) < 0) return false
  if (maxValue.value && day.compare(maxValue.value) > 0) return false
  return !(props.isDisabled?.(iso) ?? false)
}

function reshape(anchor: string, moving: string): DateRange | null {
  return reshapeRange(anchor, moving, {
    allowed,
    unavailable: props.isDateUnavailable,
    maximumDays: props.maximumDays,
  })
}

const root = ref<HTMLElement | null>(null)

/*
 * Press-and-drag, the way a phone selects text. A press on either end of the
 * range drags that end; a press anywhere else starts a new range that follows
 * the pointer. A mouse or pen drags at once. A finger has to hold still for
 * HOLD_MS first, so an ordinary swipe still scrolls the page; after that the
 * page stops scrolling and the finger selects. A press that never moves stays
 * an ordinary click for reka.
 */
const HOLD_MS = 320
const SLOP_PX = 8

/** The day the range pivots around while the pointer moves. */
let anchor: string | null = null
let pointerId = -1
let armed = false
let held = false
let dragged = false
let swallowClick = false
let lastDay = ""
let startX = 0
let startY = 0
let holdTimer: ReturnType<typeof setTimeout> | undefined
const dragging = ref(false)

function cellAt(x: number, y: number): HTMLElement | null {
  const hit = document.elementFromPoint(x, y)
  const cell = hit?.closest<HTMLElement>("[data-reka-calendar-cell-trigger]")
  if (!cell || !root.value?.contains(cell)) return null
  if (cell.hasAttribute("data-outside-view") || cell.hasAttribute("data-disabled")) return null
  return cell
}

function reset() {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = undefined
  anchor = null
  armed = false
  held = false
  dragged = false
  dragging.value = false
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const cell = (e.target as Element | null)?.closest<HTMLElement>("[data-reka-calendar-cell-trigger]")
  const day = cell?.dataset.value
  if (!cell || !day || cell.hasAttribute("data-disabled") || cell.hasAttribute("data-unavailable")) return
  reset()
  const range = committed.value
  const onEdge = !!range && (day === range.start || day === range.end)
  anchor = onEdge && range ? (day === range.start ? range.end : range.start) : day
  pointerId = e.pointerId
  lastDay = day
  startX = e.clientX
  startY = e.clientY
  // A finger on an end drags at once: the end cells don't pan the page
  // (touch-none), so there is no swipe to tell it apart from.
  if (e.pointerType !== "touch" || onEdge) {
    armed = true
    return
  }
  holdTimer = setTimeout(() => {
    holdTimer = undefined
    armed = true
    held = true
    dragging.value = true
    draft.value = toReka({ start: day, end: day })
    navigator.vibrate?.(8)
  }, HOLD_MS)
}

function onPointerMove(e: PointerEvent) {
  if (anchor === null || e.pointerId !== pointerId) return
  if (!armed) {
    // Moved before the hold landed: that is a scroll, not a selection.
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > SLOP_PX) reset()
    return
  }
  const day = cellAt(e.clientX, e.clientY)?.dataset.value
  if (!day || day === lastDay) return
  const next = reshape(anchor, day)
  if (!next) return
  lastDay = day
  if (!dragged) {
    dragged = true
    dragging.value = true
    // Capture keeps the drag alive past the grid's edge. A pointer the browser
    // no longer tracks cannot be captured, and the drag works without it.
    try {
      root.value?.setPointerCapture(e.pointerId)
    } catch {}
  }
  draft.value = toReka(next)
}

function onPointerUp(e: PointerEvent) {
  if (anchor === null || e.pointerId !== pointerId) return
  const finished = dragged || held
  if (root.value?.hasPointerCapture(e.pointerId)) root.value.releasePointerCapture(e.pointerId)
  reset()
  if (!finished || e.type === "pointercancel") {
    if (finished) draft.value = toReka(props.modelValue)
    return
  }
  // The click that follows would read as "start a new range"; it is swallowed.
  swallowClick = true
  setTimeout(() => (swallowClick = false), 0)
  const { start, end } = draft.value
  if (start && end) emit("update:modelValue", { start: start.toString(), end: end.toString() }, { via: "drag" })
}

function onClickCapture(e: MouseEvent) {
  if (!swallowClick) return
  swallowClick = false
  e.stopPropagation()
  e.preventDefault()
}

// Once a hold has turned a finger into a selection, the page must not scroll
// under it. Only a non-passive touchmove can say so mid-gesture.
function onTouchMove(e: TouchEvent) {
  if (armed && anchor !== null) e.preventDefault()
}
function onContextMenu(e: Event) {
  if (held || dragging.value) e.preventDefault()
}
onMounted(() => root.value?.addEventListener("touchmove", onTouchMove, { passive: false }))
onBeforeUnmount(() => {
  root.value?.removeEventListener("touchmove", onTouchMove)
  reset()
})

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

function onKeydownCapture(e: KeyboardEvent) {
  const step = STEP[e.key]
  const range = committed.value
  if (!e.shiftKey || step === undefined || !range) return
  const day = (e.target as HTMLElement | null)?.dataset?.value
  if (!day || (day !== range.start && day !== range.end)) return
  const moved = parseIsoDay(day)?.add({ days: step }).toString()
  if (!moved) return
  e.preventDefault()
  e.stopPropagation()
  const other = day === range.start ? range.end : range.start
  const next = reshape(other, moved)
  if (!next) return
  placeholder.value = parseIsoDay(moved) ?? placeholder.value
  emit("update:modelValue", next, { via: "keyboard" })
  void nextTick(() => root.value?.querySelector<HTMLElement>(`[data-value="${moved}"]:not([data-outside-view])`)?.focus())
}

const minValue = computed(() => parseIsoDay(props.min))
const maxValue = computed(() => parseIsoDay(props.max))
const disabledFor = (date: DateValue) => props.isDisabled?.(date.toString()) ?? false
const unavailableFor = (date: DateValue) => props.isDateUnavailable?.(date.toString()) ?? false

const { class: rootClass, attrs: rest } = useMergedAttrs(CALENDAR_FRAME)
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ weekDays, grid }"
    :ref="(c) => (root = (c as { $el?: HTMLElement } | null)?.$el ?? null)"
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
    :data-dragging="dragging || undefined"
    @update:model-value="onUpdate"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click.capture="onClickCapture"
    @contextmenu="onContextMenu"
    @keydown.capture="onKeydownCapture"
  >
    <RangeCalendarHeader class="mb-2 flex items-center justify-between gap-2">
      <RangeCalendarPrev :class="CALENDAR_NAV" :aria-label="text.previous">
        <LpIcon name="lucide:chevron-left" :size="16" />
      </RangeCalendarPrev>
      <RangeCalendarHeading class="text-sm font-semibold text-ink" />
      <RangeCalendarNext :class="CALENDAR_NAV" :aria-label="text.next">
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
                class="flex h-8 w-9 items-center justify-center rounded-control text-sm text-ink outline-none transition-[color,background-color] duration-[var(--duration-fast)] hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring data-[outside-view]:text-muted/40 data-[today]:font-semibold data-[today]:not-data-[selected]:text-brand data-[selected]:rounded-none data-[selected]:bg-brand-soft data-[highlighted]:rounded-none data-[highlighted]:bg-brand-soft/60 data-[selection-start]:rounded-l-control data-[highlighted-start]:rounded-l-control data-[selection-end]:rounded-r-control data-[highlighted-end]:rounded-r-control data-[selection-start]:bg-brand data-[selection-start]:font-semibold data-[selection-start]:text-ink-inverse data-[selection-end]:bg-brand data-[selection-end]:font-semibold data-[selection-end]:text-ink-inverse data-[outside-view]:data-[selected]:bg-transparent data-[outside-view]:data-[highlighted]:bg-transparent data-[disabled]:pointer-events-none data-[disabled]:opacity-35 data-[unavailable]:pointer-events-none data-[unavailable]:line-through data-[unavailable]:opacity-35 data-[selection-start]:cursor-grab data-[selection-end]:cursor-grab data-[selection-start]:touch-none data-[selection-end]:touch-none [-webkit-touch-callout:none] in-data-[dragging]:cursor-grabbing"
              />
            </RangeCalendarCell>
          </RangeCalendarGridRow>
        </RangeCalendarGridBody>
      </RangeCalendarGrid>
    </div>
  </RangeCalendarRoot>
</template>
