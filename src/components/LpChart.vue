<script setup lang="ts">
/*
 * Token-driven SVG chart: line, area and bar off one data shape. No charting
 * dependency — the kit already draws its own SVG (LpUptimeBar, the canvas), and
 * owning the marks is what lets every colour, radius and duration come from the
 * theme rather than a library's own palette.
 *
 * Interaction is a single crosshair that snaps to the nearest point and reports
 * every series at that index at once, so comparing series is one hover, not one
 * hover per line.
 */
import { Motion } from "motion-v"
import { computed, ref, shallowRef, watch, onMounted, onBeforeUnmount } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import { useReveal } from "../composables/useReveal"
import {
  areaPath,
  axisTicks,
  barPath,
  extent,
  formatTick,
  linePath,
  nearestIndex,
  niceScale,
  normalise,
  plotHeight,
  plotWidth,
  pointCount,
  resolveLabels,
  xAt,
  yAt,
  type Box,
  type ChartSeries,
} from "./chart"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpShift from "./LpShift.vue"

/** What was under the pointer when a point was clicked or right-clicked. */
export interface ChartPointEvent {
  index: number
  label: string
  /** Every series' value at this index, in `series` order (hidden included). */
  values: (number | null)[]
  /** The original event, for callers that need modifiers or coordinates. */
  originalEvent: MouseEvent
}

const props = withDefaults(
  defineProps<{
    series: ChartSeries[]
    /** Shared x-axis labels; a point's own `x` overrides its slot. */
    labels?: string[]
    type?: "line" | "area" | "bar"
    /** Plot height in px. The width always fills the container. */
    height?: number
    /** Headline above the plot. */
    title?: string
    /** Sub-headline under the title. */
    subtitle?: string
    /** Curve tension for line/area. 0 = straight polyline, 1 = fully smooth. */
    smooth?: number
    /** Draw a dot at every point rather than only the hovered one. */
    showPoints?: boolean
    showGrid?: boolean
    showXAxis?: boolean
    showYAxis?: boolean
    /** Legend also toggles series visibility on click. */
    showLegend?: boolean
    /** Roughly how many y ticks to aim for; bounds are rounded to fit. */
    yTicks?: number
    /** Force the y-axis to include 0 (bars always do). */
    includeZero?: boolean
    /** Appended to values in ticks and the tooltip, e.g. "%" or " ms". */
    unit?: string
    /** Unit for series on the right axis. Falls back to `unit`. */
    rightUnit?: string
    /** Custom value formatter; overrides the compact 1.2k default. */
    formatValue?: (v: number) => string
    /** Formatter for the right axis. Falls back to `formatValue`. */
    formatRightValue?: (v: number) => string
    /** Stack bars instead of grouping them side by side. */
    stacked?: boolean
    /** Grow the marks in on mount and on data change. */
    animate?: boolean
    /** Shown when every series is empty. */
    emptyLabel?: string
    /**
     * Right-click menu for a point, built from whatever was hit. Return [] to
     * leave the browser's own menu alone for that point. Which actions a point
     * offers is an application question — "compare with last week", "open the
     * incident", "copy value" — so the chart supplies the context and the
     * caller supplies the items.
     */
    menuItems?: (point: ChartPointEvent) => ContextMenuItemDef[]
  }>(),
  {
    type: "line",
    height: 240,
    smooth: 0.9,
    showGrid: true,
    showXAxis: true,
    showYAxis: true,
    showLegend: true,
    yTicks: 4,
    animate: true,
    emptyLabel: "No data",
  },
)

const emit = defineEmits<{
  /** Click on a point/bar. */
  (e: "pointClick", payload: ChartPointEvent): void
  /** Right-click on a point/bar, fired before `menuItems` is consulted. */
  (e: "pointContextMenu", payload: ChartPointEvent): void
}>()

// ── size ───────────────────────────────────────
// Width comes from the DOM, so it is 0 during SSR and the first tick; the marks
// simply have nothing to draw until the observer reports a real box.
const root = ref<HTMLElement | null>(null)
const width = ref(0)
let ro: ResizeObserver | null = null

/*
 * The wipe waits for the chart to be scrolled to. A chart is tall, so it is the
 * component most likely to mount below the fold — on a dashboard it is normal
 * for every one but the first to have finished wiping before it is ever looked
 * at. `revealed` gates the SMIL animation the same way `animate` does, so the
 * two combine into one question: should this draw itself right now?
 */
const { el: revealAnchor, revealed } = useReveal({ immediate: () => !props.animate })
const drawing = computed(() => props.animate && revealed.value)

onMounted(() => {
  // One element, two observers: hand the composable the same node rather than
  // wrapping the chart in a spare div just to carry a second ref.
  revealAnchor.value = root.value
  if (!root.value || typeof ResizeObserver === "undefined") return
  ro = new ResizeObserver(([entry]) => {
    width.value = entry.contentRect.width
  })
  ro.observe(root.value)
  width.value = root.value.clientWidth
})

onBeforeUnmount(() => {
  ro?.disconnect()
  ro = null
})

// ── data ───────────────────────────────────────
const hidden = ref(new Set<string>())

const toggleSeries = (name: string) => {
  const next = new Set(hidden.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  // Never hide the last visible series — an empty plot reads as broken.
  if (next.size < props.series.length) hidden.value = next
}

const allSeries = computed(() => normalise(props.series))
const visible = computed(() => allSeries.value.filter((s) => !hidden.value.has(s.name)))

const count = computed(() => pointCount(allSeries.value))
const labels = computed(() => resolveLabels(props.series, props.labels, count.value))
const banded = computed(() => props.type === "bar")

const hasData = computed(() =>
  allSeries.value.some((s) => s.values.some((v) => v != null)),
)

// Bars are read against a baseline, so their axis must contain zero.
const zeroBased = computed(() => props.includeZero || props.type === "bar")

/** Stacked bars are measured on their running totals, not on single values. */
const stackTotals = computed(() => {
  if (!(props.type === "bar" && props.stacked)) return null
  const pos: number[] = []
  const neg: number[] = []
  for (let i = 0; i < count.value; i++) {
    let p = 0
    let n = 0
    for (const s of visible.value) {
      const v = s.values[i]
      if (v == null) continue
      if (v >= 0) p += v
      else n += v
    }
    pos.push(p)
    neg.push(n)
  }
  return { pos, neg }
})

const onRight = computed(() => visible.value.filter((s) => s.axis === "right"))
const onLeft = computed(() => {
  // A chart whose every series asked for the right axis still needs the left
  // one to carry the grid, so treat that as "no split at all".
  const left = visible.value.filter((s) => s.axis === "left")
  return left.length || !onRight.value.length ? left : visible.value
})
const hasRightAxis = computed(() => onRight.value.length > 0 && onLeft.value !== visible.value)

const scaleFor = (members: typeof visible.value) => {
  const totals = stackTotals.value
  const raw = totals
    ? { min: Math.min(0, ...totals.neg), max: Math.max(0, ...totals.pos) }
    : extent(members, zeroBased.value)
  return niceScale(raw.min, raw.max, props.yTicks)
}

const scale = computed(() => scaleFor(onLeft.value))

/*
 * The right axis reuses the LEFT axis's tick COUNT so both sets of labels land
 * on the same gridlines. Two independent tick runs would draw two interleaved
 * grids across one plot, which reads as noise rather than as two scales.
 */
const rightScale = computed(() => {
  if (!hasRightAxis.value) return null
  const raw = extent(onRight.value, zeroBased.value)
  const steps = Math.max(1, axisTicks(scale.value.min, scale.value.max, scale.value.step).length - 1)
  const nice = niceScale(raw.min, raw.max, steps)
  // Stretch the top so the run divides into exactly `steps` intervals.
  return { min: nice.min, max: nice.min + nice.step * steps, step: nice.step }
})

const fmtWith = (v: number, unit?: string, f?: (n: number) => string): string =>
  `${f ? f(v) : formatTick(v)}${unit ?? ""}`

const fmt = (v: number): string => fmtWith(v, props.unit, props.formatValue)
const fmtRight = (v: number): string =>
  fmtWith(v, props.rightUnit ?? props.unit, props.formatRightValue ?? props.formatValue)

/** A series is read against its own axis — in the ticks and in the tooltip. */
const fmtSeries = (s: { axis: "left" | "right" }, v: number): string =>
  s.axis === "right" && hasRightAxis.value ? fmtRight(v) : fmt(v)

const scaleOf = (s: { axis: "left" | "right" }) =>
  s.axis === "right" && rightScale.value ? rightScale.value : scale.value

// ── layout ─────────────────────────────────────
// Side padding tracks the widest tick label so long numbers never clip.
const yLabels = computed(() =>
  axisTicks(scale.value.min, scale.value.max, scale.value.step).map(fmt),
)

const rightLabels = computed(() =>
  rightScale.value
    ? axisTicks(rightScale.value.min, rightScale.value.max, rightScale.value.step).map(fmtRight)
    : [],
)

const gutter = (labels: string[]) => 12 + Math.max(...labels.map((l) => l.length), 1) * 7

const box = computed<Box>(() => ({
  width: width.value,
  height: props.height,
  left: props.showYAxis ? gutter(yLabels.value) : 8,
  right: props.showYAxis && rightLabels.value.length ? gutter(rightLabels.value) : 12,
  top: 10,
  bottom: props.showXAxis ? 26 : 8,
}))

const geo = computed(() => ({
  min: scale.value.min,
  max: scale.value.max,
  box: box.value,
  count: count.value,
  banded: banded.value,
}))

/** Geometry for one series — same box, but its own axis's min/max. */
const geoOf = (s: { axis: "left" | "right" }) => ({ ...geo.value, ...scaleOf(s) })

const gridLines = computed(() => {
  const left = axisTicks(scale.value.min, scale.value.max, scale.value.step)
  const right = rightScale.value
    ? axisTicks(rightScale.value.min, rightScale.value.max, rightScale.value.step)
    : []
  return left.map((v, i) => ({
    v,
    y: yAt(v, scale.value.min, scale.value.max, box.value),
    label: fmt(v),
    rightLabel: right[i] != null ? fmtRight(right[i]) : "",
  }))
})

/** Thin out x labels so they never collide at narrow widths. */
const xLabelStride = computed(() => {
  const w = plotWidth(box.value)
  if (w <= 0 || count.value === 0) return 1
  const longest = Math.max(...labels.value.map((l) => l.length), 1)
  return Math.max(1, Math.ceil((count.value * (longest * 6.5 + 16)) / w))
})

const xLabels = computed(() =>
  labels.value
    .map((label, i) => ({ label, i, x: xAt(i, count.value, box.value, banded.value) }))
    .filter(({ i }) => i % xLabelStride.value === 0 || i === count.value - 1),
)

// ── marks ──────────────────────────────────────
const baseY = computed(() =>
  yAt(
    Math.max(scale.value.min, Math.min(scale.value.max, 0)),
    scale.value.min,
    scale.value.max,
    box.value,
  ),
)

const lines = computed(() =>
  visible.value.map((s) => {
    const g = geoOf(s)
    return {
      ...s,
      d: linePath(s.values, g, props.smooth),
      fill: props.type === "area" ? areaPath(s.values, g, props.smooth) : "",
      /* A dashed series is a reference level (a budget, a target), not a
         measurement — dotting it implies readings that aren't there. */
      points: props.showPoints && !s.dashed,
      scale: scaleOf(s),
    }
  }),
)

/** Every bar as an absolute rect — grouped side by side, or stacked. */
const bars = computed(() => {
  if (props.type !== "bar" || count.value === 0 || plotWidth(box.value) <= 0) return []
  const band = plotWidth(box.value) / count.value
  /* Bars read as a series of measurements, not as a filled block: keep real
     ground visible between bands, and cap the width so a 4-point chart doesn't
     turn into slabs. */
  const inner = Math.min(band * 0.6, props.stacked ? 46 : 30 * (visible.value.length || 1))
  const n = visible.value.length || 1
  const slot = props.stacked ? inner : inner / n
  const out: {
    key: string
    x: number
    y: number
    w: number
    h: number
    color: string
    index: number
    /** Which end of its stack this segment terminates; both when standalone. */
    roundTop: boolean
    roundBottom: boolean
    d: string
  }[] = []

  const posTop = new Array(count.value).fill(0)
  const negTop = new Array(count.value).fill(0)

  visible.value.forEach((s, si) => {
    for (let i = 0; i < count.value; i++) {
      const v = s.values[i]
      if (v == null) continue
      const centre = xAt(i, count.value, box.value, true)
      const x = props.stacked ? centre - inner / 2 : centre - inner / 2 + si * slot
      let y: number
      let h: number
      if (props.stacked) {
        // Each stacked bar starts where the previous one of its sign ended.
        const prev = v >= 0 ? posTop[i] : negTop[i]
        const from = yAt(prev, scale.value.min, scale.value.max, box.value)
        const to = yAt(prev + v, scale.value.min, scale.value.max, box.value)
        y = Math.min(from, to)
        h = Math.abs(to - from)
        if (v >= 0) posTop[i] += v
        else negTop[i] += v
      } else {
        const sc = scaleOf(s)
        const top = yAt(v, sc.min, sc.max, box.value)
        const base = yAt(Math.max(sc.min, Math.min(sc.max, 0)), sc.min, sc.max, box.value)
        y = Math.min(top, base)
        h = Math.abs(top - base)
      }
      out.push({
        key: `${s.name}-${i}`,
        x,
        y,
        w: Math.max(1, slot - (props.stacked ? 0 : 2)),
        h: Math.max(v === 0 ? 0 : 1, h),
        color: s.color,
        index: i,
        /* A standalone bar rounds only the end it grows toward: a negative one
           hangs off the baseline, so its square end is the top. */
        roundTop: props.stacked || v >= 0,
        roundBottom: props.stacked || v < 0,
        d: "",
      })
    }
  })

  /*
   * A stack is one bar cut into pieces, so only its outer ends round. Which
   * piece is outermost isn't known while stacking (it depends on how many
   * series had a value at that index), so the ends are resolved here, once the
   * column is complete: topmost piece rounds its top, bottommost its bottom,
   * everything between stays square and the joins read as one shape.
   */
  if (props.stacked) {
    const columns = new Map<number, typeof out>()
    for (const b of out) {
      const col = columns.get(b.index) ?? []
      col.push(b)
      columns.set(b.index, col)
    }
    for (const col of columns.values()) {
      const top = Math.min(...col.map((b) => b.y))
      const bottom = Math.max(...col.map((b) => b.y + b.h))
      for (const b of col) {
        b.roundTop = b.y === top
        b.roundBottom = b.y + b.h === bottom
      }
    }
  }

  for (const b of out) {
    b.d = barPath(b.x, b.y, b.w, b.h, 4, { top: b.roundTop, bottom: b.roundBottom })
  }
  return out
})

// ── hover ──────────────────────────────────────
const active = ref(-1)
const pointer = ref({ x: 0, y: 0 })

const onMove = (e: PointerEvent) => {
  const el = e.currentTarget as SVGElement
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  pointer.value = { x, y: e.clientY - rect.top }
  active.value = nearestIndex(x, geo.value)
}

const onLeave = () => {
  active.value = -1
}

const pointEvent = (originalEvent: MouseEvent): ChartPointEvent => ({
  index: active.value,
  label: labels.value[active.value] ?? "",
  values: allSeries.value.map((s) => s.values[active.value] ?? null),
  originalEvent,
})

const onClick = (e: MouseEvent) => {
  if (active.value < 0) return
  emit("pointClick", pointEvent(e))
}

/*
 * The menu itself belongs to the caller — which actions a point offers is an
 * application question. All the chart owes is WHICH point was hit, resolved
 * before the menu opens so the items can be built for it.
 *
 * A right-click can land without a preceding pointermove (touch long-press, or
 * a click straight after a scroll), so the index is resolved from this event
 * rather than trusting whatever hover left behind.
 */
const menuPoint = ref<ChartPointEvent | null>(null)

/* Resolved on the right-click, so the menu describes the point actually hit. */
const menuEntries = computed(() =>
  props.menuItems && menuPoint.value ? props.menuItems(menuPoint.value) : [],
)

const onContextMenu = (e: MouseEvent) => {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  active.value = nearestIndex(e.clientX - rect.left, geo.value)
  if (active.value < 0) return
  menuPoint.value = pointEvent(e)
  emit("pointContextMenu", menuPoint.value)
}

const activeX = computed(() =>
  active.value < 0 ? 0 : xAt(active.value, count.value, box.value, banded.value),
)

/** Dots on the crosshair — one per visible series that has a value here. */
const activePoints = computed(() => {
  if (active.value < 0) return []
  return visible.value
    .map((s) => ({ s, v: s.values[active.value] }))
    .filter((r): r is { s: (typeof visible.value)[number]; v: number } => r.v != null)
    .map(({ s, v }) => {
      const sc = scaleOf(s)
      return {
        color: s.color,
        name: s.name,
        value: v,
        y: yAt(v, sc.min, sc.max, box.value),
      }
    })
})

const tooltipRows = computed(() =>
  active.value < 0
    ? []
    : visible.value.map((s) => ({
        name: s.name,
        color: s.color,
        text:
          s.values[active.value] == null
            ? "—"
            : fmtSeries(s, s.values[active.value] as number),
      })),
)

/*
 * The tooltip trails the pointer on a soft spring rather than being pinned to
 * it. Two reasons it is animated rather than positioned directly: the crosshair
 * SNAPS to the nearest point, so a pinned card would jump a whole band at a
 * time sideways while gliding vertically; and a card that lags slightly reads as
 * following the cursor instead of being welded to it.
 *
 * x tracks the snapped crosshair (the card belongs to the point it describes),
 * y tracks the raw pointer, clamped into the plot so it can't ride off the top
 * or bottom edge. The spring is the kit's shared "float" feel.
 */
const CARD_W = 150
const CARD_GAP = 14

const tooltipTarget = computed(() => {
  const flip = activeX.value > box.value.width - CARD_W
  const y = Math.min(
    Math.max(pointer.value.y, box.value.top + 8),
    box.value.top + plotHeight(box.value) - 8,
  )
  return {
    x: flip ? activeX.value - CARD_GAP : activeX.value + CARD_GAP,
    y,
    flip,
  }
})

const floatTransition = usePillTransition("float")

// ── animation ──────────────────────────────────
// One clip rect wipes across the plot; re-keyed on data change so an update
// replays the reveal instead of snapping.
const revealKey = shallowRef(0)
watch(
  () => [props.series, props.type] as const,
  () => {
    revealKey.value++
  },
  { deep: true },
)

const clipId = `lp-chart-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <div ref="root" class="flex w-full flex-col gap-3">
    <div v-if="title || subtitle || $slots.actions" class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-0.5">
        <span v-if="title" class="text-sm font-medium text-ink">{{ title }}</span>
        <span v-if="subtitle" class="text-xs text-muted">{{ subtitle }}</span>
      </div>
      <slot name="actions" />
    </div>

    <div
      v-if="showLegend && allSeries.length > 1"
      class="flex flex-wrap items-center gap-x-4 gap-y-1.5"
    >
      <button
        v-for="s in allSeries"
        :key="s.name"
        type="button"
        class="group flex cursor-pointer items-center gap-1.5 rounded-md text-xs outline-none transition-opacity duration-fast focus-visible:ring-2 focus-visible:ring-ring"
        :class="hidden.has(s.name) ? 'opacity-40' : ''"
        @click="toggleSeries(s.name)"
      >
        <span
          class="size-2 shrink-0 rounded-full transition-transform duration-fast group-hover:scale-125"
          :style="{ backgroundColor: s.color }"
        />
        <span class="text-muted-strong group-hover:text-ink">{{ s.name }}</span>
        <span
          v-if="hasRightAxis && s.axis === 'right'"
          class="text-[10px] text-muted"
          title="Measured on the right axis"
        >
          ↗
        </span>
      </button>
    </div>

    <!-- `always` keeps reka mounted while the items are still being resolved
         from the click that opens the menu. -->
    <LpContextMenu :items="menuEntries" :always="!!menuItems">
      <!-- `group/plot` + data-state lets the tooltip hide itself while the
           context menu is up: the two would otherwise stack on the same point. -->
      <div class="group/plot relative" :style="{ height: `${height}px` }">
        <div
          v-if="!hasData"
          class="flex size-full flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line text-muted"
        >
          <LpIcon name="lucide:chart-no-axes-column" :size="18" />
          <span class="text-xs">{{ emptyLabel }}</span>
        </div>

        <svg
          v-else-if="width > 0"
          :width="width"
          :height="height"
          class="overflow-visible touch-none select-none"
          @pointermove="onMove"
          @pointerleave="onLeave"
          @click="onClick"
          @contextmenu="onContextMenu"
        >
          <defs>
            <linearGradient
              v-for="s in lines"
              :id="`${clipId}-g-${s.name}`"
              :key="s.name"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" :stop-color="s.color" stop-opacity="0.28" />
              <stop offset="100%" :stop-color="s.color" stop-opacity="0.02" />
            </linearGradient>
            <clipPath :id="`${clipId}-reveal`">
              <!-- Closed both while the wipe is running (SMIL opens it) and
                   while the chart is still waiting to be scrolled to; only a
                   chart with no entrance at all starts open. -->
              <rect
                :key="revealKey"
                :x="box.left"
                :y="0"
                :height="height"
                :width="animate ? 0 : plotWidth(box)"
              >
                <!-- keySplines is --ease-travel written out: SMIL cannot read a
                     CSS custom property, so the curve is duplicated here. Change
                     one and change the other. -->
                <animate
                  v-if="drawing"
                  attributeName="width"
                  :from="0"
                  :to="plotWidth(box)"
                  dur="0.95s"
                  fill="freeze"
                  calcMode="spline"
                  keySplines="0.2 0.25 0.5 0.85"
                  keyTimes="0;1"
                />
              </rect>
            </clipPath>
          </defs>

          <!-- grid + y ticks -->
          <g v-if="showGrid || showYAxis">
            <template v-for="g in gridLines" :key="g.v">
              <line
                v-if="showGrid"
                :x1="box.left"
                :x2="box.width - box.right"
                :y1="g.y"
                :y2="g.y"
                stroke="var(--color-line)"
                stroke-width="1"
              />
              <text
                v-if="showYAxis"
                :x="box.left - 8"
                :y="g.y"
                text-anchor="end"
                dominant-baseline="middle"
                class="fill-[var(--color-muted)] text-[10px] tabular-nums"
              >
                {{ g.label }}
              </text>
              <text
                v-if="showYAxis && g.rightLabel"
                :x="box.width - box.right + 8"
                :y="g.y"
                text-anchor="start"
                dominant-baseline="middle"
                class="fill-[var(--color-muted)] text-[10px] tabular-nums"
              >
                {{ g.rightLabel }}
              </text>
            </template>
          </g>

          <!-- zero line, when the axis crosses it -->
          <line
            v-if="scale.min < 0 && scale.max > 0"
            :x1="box.left"
            :x2="box.width - box.right"
            :y1="baseY"
            :y2="baseY"
            stroke="var(--color-line-strong)"
            stroke-width="1"
          />

          <!-- hovered band highlight -->
          <rect
            v-if="active >= 0 && banded"
            :x="activeX - plotWidth(box) / count / 2"
            :y="box.top"
            :width="plotWidth(box) / count"
            :height="plotHeight(box)"
            fill="var(--color-surface-soft)"
            opacity="0.5"
          />

          <g :clip-path="`url(#${clipId}-reveal)`">
            <!-- bars: paths, so a stack rounds as one shape (see barPath) -->
            <path
              v-for="b in bars"
              :key="b.key"
              :d="b.d"
              :fill="b.color"
              class="transition-opacity duration-fast"
              :opacity="active < 0 || active === b.index ? 1 : 0.45"
            />

            <!-- area fills -->
            <path
              v-for="s in lines"
              v-show="type === 'area'"
              :key="`f-${s.name}`"
              :d="s.fill"
              :fill="`url(#${clipId}-g-${s.name})`"
            />

            <!-- lines -->
            <path
              v-for="s in lines"
              v-show="type !== 'bar'"
              :key="`l-${s.name}`"
              :d="s.d"
              fill="none"
              :stroke="s.color"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :stroke-dasharray="s.dashed ? '5 4' : undefined"
            />

            <!-- every-point dots -->
            <template v-if="type !== 'bar'">
              <template v-for="s in lines" :key="`p-${s.name}`">
                <template v-if="s.points">
                  <circle
                    v-for="(v, i) in s.values"
                    v-show="v != null"
                    :key="i"
                    :cx="xAt(i, count, box, banded)"
                    :cy="v == null ? 0 : yAt(v, s.scale.min, s.scale.max, box)"
                    r="2.5"
                    :fill="s.color"
                  />
                </template>
              </template>
            </template>
          </g>

          <!-- crosshair -->
          <g v-if="active >= 0 && type !== 'bar'">
            <line
              :x1="activeX"
              :x2="activeX"
              :y1="box.top"
              :y2="box.top + plotHeight(box)"
              stroke="var(--color-line-strong)"
              stroke-width="1"
              stroke-dasharray="3 3"
            />
            <circle
              v-for="p in activePoints"
              :key="p.name"
              :cx="activeX"
              :cy="p.y"
              r="4"
              :fill="p.color"
              stroke="var(--color-surface)"
              stroke-width="2"
            />
          </g>

          <!-- x labels -->
          <text
            v-for="l in xLabels"
            v-show="showXAxis"
            :key="l.i"
            :x="l.x"
            :y="height - 8"
            text-anchor="middle"
            class="fill-[var(--color-muted)] text-[10px]"
            :class="active === l.i ? 'fill-[var(--color-ink)]' : ''"
          >
            {{ l.label }}
          </text>
        </svg>

        <!-- tooltip: springs after the pointer (see tooltipTarget) -->
        <Motion
          v-if="active >= 0 && hasData"
          as="div"
          class="pointer-events-none absolute left-0 top-0 z-(--z-tooltip) min-w-32 rounded-control border border-line bg-surface-overlay px-2.5 py-2 shadow-panel backdrop-blur group-data-[state=open]/plot:hidden"
          :initial="{ opacity: 0, scale: 0.96 }"
          :animate="{
            opacity: 1,
            scale: 1,
            x: tooltipTarget.flip ? `calc(${tooltipTarget.x}px - 100%)` : `${tooltipTarget.x}px`,
            y: `calc(${tooltipTarget.y}px - 50%)`,
          }"
          :transition="floatTransition"
        >
          <!-- A point where one series has no value drops a row; easing the box
               keeps the card from snapping mid-glide. -->
          <LpShift axis="both">
            <div class="mb-1 text-[11px] font-medium text-muted-strong">
              {{ labels[active] }}
            </div>
            <div class="flex flex-col gap-1">
              <div
                v-for="r in tooltipRows"
                :key="r.name"
                class="flex items-center justify-between gap-3 text-xs"
              >
                <span class="flex items-center gap-1.5 text-muted">
                  <span class="size-1.5 shrink-0 rounded-full" :style="{ backgroundColor: r.color }" />
                  {{ r.name }}
                </span>
                <span class="font-mono tabular-nums text-ink">{{ r.text }}</span>
              </div>
            </div>
          </LpShift>
        </Motion>
      </div>
    </LpContextMenu>
  </div>
</template>
