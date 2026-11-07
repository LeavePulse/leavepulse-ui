<script setup lang="ts">
/*
 * The overview under a long chart: the whole series as one thin line, with the
 * window the plot shows laid over it. Drag the window to pan, its edges to
 * resize; each edge is also a slider, so the arrow keys do the same.
 */
import { computed } from "vue"
import { startPointerDrag } from "../composables/pointerDrag"
import { MIN_RANGE_POINTS, clampRange, lttbIndices, panRange, type ChartRange } from "./chartWindow"

const props = defineProps<{
  /** The series the overview traces. */
  values: (number | null)[]
  /** Points in the data. */
  count: number
  /** The current window; null is the whole series. */
  range: ChartRange | null
  /** Width of the overview, px. */
  width: number
  labels: string[]
  startLabel: string
  endLabel: string
}>()

const emit = defineEmits<{ (e: "change", range: ChartRange | null): void }>()

const HEIGHT = 36
const GRIP = 8
const INSET = 2
/* Points of the outline: a spare line, not a reading. */
const OUTLINE_POINTS = 120
const PAGE_DIVISOR = 10

const last = computed(() => Math.max(1, props.count - 1))
const whole = computed<ChartRange>(() => props.range ?? { start: 0, end: props.count - 1 })
const toX = (index: number) => (index / last.value) * props.width
const toIndex = (x: number) => (x / (props.width || 1)) * last.value

const outline = computed(() => {
  const picked = lttbIndices(props.values, OUTLINE_POINTS)
  const present = picked.map((i) => props.values[i] as number)
  if (present.length < MIN_RANGE_POINTS) return ""
  const low = Math.min(...present)
  const high = Math.max(...present)
  const span = high - low || 1
  const room = HEIGHT - INSET * 2
  return picked
    .map((i, n) => `${n ? "L" : "M"}${toX(i).toFixed(1)} ${(HEIGHT - INSET - ((present[n] - low) / span) * room).toFixed(1)}`)
    .join(" ")
})

const left = computed(() => toX(whole.value.start))
const right = computed(() => toX(whole.value.end))

type Part = "start" | "end" | "window"

function press(part: Part, event: PointerEvent) {
  if (event.button !== 0) return
  const x = event.clientX
  const from = whole.value
  const { start, end } = from
  startPointerDrag(event, {
    move(e) {
      const delta = toIndex(e.clientX - x)
      if (part === "window") emit("change", panRange(from, props.count, delta))
      else if (part === "start") emit("change", clampRange({ start: Math.min(start + delta, end - 1), end }, props.count))
      else emit("change", clampRange({ start, end: Math.max(end + delta, start + 1) }, props.count))
    },
    end: () => {},
  })
}

function onKey(part: "start" | "end", event: KeyboardEvent) {
  const page = Math.max(1, Math.round(props.count / PAGE_DIVISOR))
  const steps: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -page, PageUp: page }
  const step = steps[event.key]
  const { start, end } = whole.value
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault()
    const edge = event.key === "Home" ? 0 : props.count - 1
    emit("change", clampRange(part === "start" ? { start: Math.min(edge, end - 1), end } : { start, end: Math.max(edge, start + 1) }, props.count))
    return
  }
  if (!step) return
  event.preventDefault()
  emit("change", clampRange(part === "start" ? { start: Math.min(start + step, end - 1), end } : { start, end: Math.max(end + step, start + 1) }, props.count))
}
</script>

<template>
  <div class="relative select-none touch-none" :style="{ height: `${HEIGHT}px`, width: `${width}px` }">
    <svg :width="width" :height="HEIGHT" class="absolute inset-0 block" aria-hidden="true">
      <path :d="outline" fill="none" stroke="var(--color-line-strong)" stroke-width="1" />
    </svg>
    <div class="absolute inset-y-0 left-0 bg-surface-soft opacity-70" :style="{ width: `${left}px` }" />
    <div class="absolute inset-y-0 right-0 bg-surface-soft opacity-70" :style="{ width: `${Math.max(0, width - right)}px` }" />
    <div
      data-lp-chart-window
      class="absolute inset-y-0 cursor-grab border-y border-line-strong active:cursor-grabbing"
      :style="{ left: `${left}px`, width: `${Math.max(1, right - left)}px` }"
      @pointerdown="press('window', $event)"
    />
    <div
      v-for="edge in (['start', 'end'] as const)"
      :key="edge"
      role="slider"
      tabindex="0"
      aria-orientation="horizontal"
      :aria-label="edge === 'start' ? startLabel : endLabel"
      :aria-valuemin="edge === 'start' ? 0 : whole.start + 1"
      :aria-valuemax="edge === 'start' ? whole.end - 1 : count - 1"
      :aria-valuenow="whole[edge]"
      :aria-valuetext="labels[whole[edge]]"
      class="absolute inset-y-0 -ml-1 cursor-ew-resize rounded-inner bg-line-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :style="{ left: `${edge === 'start' ? left : right}px`, width: `${GRIP}px` }"
      @pointerdown.stop="press(edge, $event)"
      @keydown="onKey(edge, $event)"
    />
  </div>
</template>
