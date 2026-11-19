<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

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
import { clamp } from "../composables/clamp"
import { computed, nextTick, ref, shallowRef, useId, watch, onMounted } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { usePrefersReducedMotion } from "../composables/useReducedMotion"
import { useReveal } from "../composables/useReveal"
import {
  areaPath,
  linePath,
  normalise,
  plotHeight,
  plotWidth,
  pointCount,
  resolveLabels,
  xAt,
  yAt,
  type ChartAnnotation,
  type ChartBand,
  type ChartMarker,
  type ChartSeries,
  type ChartThreshold,
} from "./chart"
import { layoutBars } from "./chartBars"
import { useChartMotion } from "./chartMotion"
import { useChartScales } from "./chartScales"
import ChartDataTable from "./ChartDataTable.vue"
import { chartCsv, chartPng, type ChartExportOptions } from "./chartExport"
import { useChartInteraction, type ChartPointEvent } from "./chartInteraction"
import ChartLegend from "./ChartLegend.vue"
import { useChartOverlays } from "./chartOverlays"
import ChartRangeSelector from "./ChartRangeSelector.vue"
import ChartSkeleton from "./ChartSkeleton.vue"
import ChartTooltip from "./ChartTooltip.vue"
import {
  chartView,
  clampRange,
  sourceOf,
  type ChartDownsample,
  type ChartRange,
} from "./chartWindow"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpSwap from "./LpSwap.vue"
import { sampleValues } from "./chartSkeleton"
import HintSampleTag from "./HintSampleTag.vue"
import { useSample } from "../composables/useSample"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useResizeObserver } from "../composables/useResizeObserver"
import { downloadFile, fileStem, type CsvOptions } from "./exportData"

export interface ChartText {
  [key: string]: string
  empty: string
  /** Read out while `loading`; the placeholder itself is silent. */
  loading: string
  rightAxis: string
  /** Prefix of the keyboard readout, before the point's label. */
  point: string
  /** Header of the label column in a CSV export. */
  xColumn: string
  /** Name of the overview's left edge, for assistive tech. */
  rangeStart: string
  /** Name of the overview's right edge. */
  rangeEnd: string
  /** The button that shows the whole series again. */
  resetZoom: string
}

// Types that live beside the code using them, re-exported so imports from the SFC keep working.
export type { ChartExportOptions } from "./chartExport"
export type { ChartPointEvent } from "./chartInteraction"

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
    /** Second line of the empty state: why it is empty, what period it covers. */
    emptyDescription?: string
    /** Icon of the empty state. The `empty` slot puts an action under it ("Show 90 days"). */
    emptyIcon?: string
    /**
     * Inside a `v-hint` element with nothing to draw, a tour step on that hint
     * draws made-up data here instead of the empty state, tagged "Example".
     * Off: the empty state shows on the tour too.
     */
    sample?: boolean
    /**
     * The series are on their way. The plot keeps its `height` and draws a
     * pulsing stand-in of the chart's own type in the area the marks will take
     * (bars for `bar`, a line for line/area, tick stubs where the axes are), so
     * a dashboard does not jump from an empty box to a filled one.
     */
    loading?: boolean
    /** Reference lines and bands (SLOs, budgets, alert levels). */
    thresholds?: ChartThreshold[]
    /** Vertical markers at x positions (deploys, incidents). */
    markers?: ChartMarker[]
    /** Stretches of the x axis, drawn under the data (maintenance, incidents). */
    bands?: ChartBand[]
    /** Notes pinned to single readings. */
    annotations?: ChartAnnotation[]
    /**
     * The window of the data on show, by point index (`v-model:range`). Unset
     * and null are the whole series. Exports and `dataTable` always hold all of it.
     */
    range?: ChartRange | null
    /** The overview under the plot, for moving and resizing the window. */
    rangeSelector?: boolean
    /**
     * Zoom on the plot: drag across it, Ctrl+wheel or pinch, the + and - keys.
     * Double click, 0 or the reset button show the whole series.
     */
    zoomable?: boolean
    /**
     * Thin a series longer than the plot is wide, for line and area charts.
     * `minmax` keeps each bucket's extremes, so a one-point spike survives;
     * `lttb` keeps the shape of a smooth curve and can lose one. Off by default.
     * Curves are drawn straight while thinned: `smooth` would overshoot.
     */
    downsample?: ChartDownsample | false
    /** Points to thin to. Defaults to one a pixel of the chart's width. */
    maxPoints?: number
    /**
     * Charts of one group mark the same x label on hover. Matched by label, so
     * they may hold different windows of the same timeline.
     */
    syncGroup?: string
    /** Accessible name for the plot. Defaults to a generated summary. */
    ariaLabel?: string
    /** Render the data as a visually hidden table for screen readers. */
    dataTable?: boolean
    /** Text overrides (`labels` is taken by the x axis). */
    text?: Partial<ChartText>
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
    thresholds: () => [],
    markers: () => [],
    bands: () => [],
    annotations: () => [],
    range: undefined,
    dataTable: false,
    sample: true,
  },
)

const strings = useLabels<ChartText>(
  "chart",
  {
    empty: "No data",
    loading: "Loading",
    rightAxis: "Measured on the right axis",
    point: "Point",
    xColumn: "Label",
    rangeStart: "Start of the range",
    rangeEnd: "End of the range",
    resetZoom: "Show all",
  },
  () => props.text,
)

const emit = defineEmits<{
  /** Click on a point/bar. */
  (e: "pointClick", payload: ChartPointEvent): void
  /** Right-click on a point/bar, fired before `menuItems` is consulted. */
  (e: "pointContextMenu", payload: ChartPointEvent): void
  /** The window moved; null is the whole series. */
  (e: "update:range", range: ChartRange | null): void
}>()

// ── size ───────────────────────────────────────
// Width comes from the DOM, so it is 0 during SSR and the first tick; the marks
// simply have nothing to draw until the observer reports a real box.
const root = ref<HTMLElement | null>(null)
const width = ref(0)

/*
 * The wipe waits for the chart to be scrolled to. A chart is tall, so it is the
 * component most likely to mount below the fold — on a dashboard it is normal
 * for every one but the first to have finished wiping before it is ever looked
 * at. `revealed` gates the SMIL animation the same way `animate` does, so the
 * two combine into one question: should this draw itself right now?
 */
const { el: revealAnchor, revealed } = useReveal({ immediate: () => !props.animate })
// SMIL ignores the reduced-motion media query, so the wipe is skipped here.
const reduced = usePrefersReducedMotion()
const still = computed(() => !props.animate || reduced.value)
const drawing = computed(() => !still.value && revealed.value)

onMounted(() => {
  // One element, two observers: hand the composable the same node rather than
  // wrapping the chart in a spare div just to carry a second ref.
  revealAnchor.value = root.value
})
useResizeObserver(root, (entry, el) => (width.value = entry ? entry.contentRect.width : el.clientWidth), {
  immediate: true,
})

// ── data ───────────────────────────────────────
const hidden = ref(new Set<string>())

const toggleSeries = (id: string) => {
  const next = new Set(hidden.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  // Never hide the last visible series — an empty plot reads as broken.
  if (allSeries.value.some((s) => !next.has(s.id))) hidden.value = next
}

const SAMPLE_POINTS = 12
const sampling = useSample(
  root,
  () => !props.loading && !props.series.some((s) => s.data.some((v) => v != null)),
  () => props.sample,
)
// The sample keeps the series' own names, colours and axes; only the values are made up.
const source = computed<ChartSeries[]>(() => {
  if (!sampling.value) return props.series
  const count = props.labels?.length || SAMPLE_POINTS
  const series = props.series.length ? props.series : [{ name: "", data: [] }]
  return series.map((s, i) => ({ ...s, data: sampleValues(count, i) }))
})

// Identity is position plus name, so two series sharing a name stay separate.
const fullSeries = computed(() =>
  normalise(source.value).map((s, i) => ({ ...s, id: `${i}:${s.name}` })),
)
const fullCount = computed(() => pointCount(fullSeries.value))
const fullLabels = computed(() => resolveLabels(source.value, props.labels, fullCount.value))

/*
 * The window and the thinning sit between the data and everything drawn. Past
 * this point a mark's index is a slot of `view`; `sourceOf` and `slotOf` cross
 * back to the data. Slots follow the chart's own width and not the plot's: the
 * plot's gutters come from the scale, which comes from these very values.
 */
const ownRange = shallowRef<ChartRange | null>(null)
const range = computed(() => clampRange(props.range === undefined ? ownRange.value : props.range, fullCount.value))

const view = computed(() =>
  chartView(
    fullSeries.value.map((s) => s.values),
    fullCount.value,
    range.value,
    props.type === "bar" ? false : props.downsample,
    props.maxPoints ?? Math.floor(width.value),
  ),
)
const narrowed = computed(() => range.value !== null || view.value.indices !== null)

/* What the chart works from: the same objects as the data when nothing narrows it. */
const allSeries = computed(() =>
  narrowed.value ? fullSeries.value.map((s, i) => ({ ...s, values: view.value.values[i] })) : fullSeries.value,
)

function setRange(next: ChartRange | null) {
  ownRange.value = next
  emit("update:range", next)
}

/*
 * A zoom follows the hand, so it lands at once: easing would slide the curve
 * under the pointer. The flag only has to cover the watchers of this flush.
 */
let rangeMoving = false
watch(
  () => `${range.value?.start}:${range.value?.end}`,
  () => {
    rangeMoving = true
    void nextTick(() => (rangeMoving = false))
  },
  { flush: "sync" },
)
const visible = computed(() => allSeries.value.filter((s) => !hidden.value.has(s.id)))

// A series asked to start hidden is hidden once, when it first appears: the
// legend owns it from then on, and a data refresh must not switch it back off.
// That state lives as long as the series does: one that goes away takes it
// along, so a new series in its place starts from its own `hidden`. An empty
// list is data still on its way, not every series removed.
const seeded = new Set<string>()
watch(
  () => props.series.map((s, i) => [`${i}:${s.name}`, !!s.hidden] as const),
  (entries) => {
    if (!entries.length) return
    const ids = new Set<string>(entries.map(([id]) => id))
    for (const id of seeded) if (!ids.has(id)) seeded.delete(id)
    const kept = [...hidden.value].filter((id) => ids.has(id))
    const next = new Set(kept)
    for (const [id, off] of entries) {
      if (seeded.has(id)) continue
      seeded.add(id)
      if (off) next.add(id)
    }
    const allowed = next.size < entries.length ? next : new Set(kept)
    if (allowed.size !== hidden.value.size || [...allowed].some((id) => !hidden.value.has(id))) hidden.value = allowed
  },
  { immediate: true },
)

// ── motion (see chartMotion) ───────────────────
const svgEl = ref<SVGSVGElement | null>(null)
const count = computed(() => pointCount(allSeries.value))
const { settle, presenceOf, drawnSeries, drawnById } = useChartMotion({
  animate: () => props.animate,
  moving: () => rangeMoving,
  onScreen: () => revealed.value && !!svgEl.value,
  allSeries,
  hidden,
  count,
})

const labels = computed(() =>
  narrowed.value
    ? Array.from({ length: count.value }, (_, slot) => fullLabels.value[sourceOf(view.value, slot)] ?? "")
    : fullLabels.value,
)
const banded = computed(() => props.type === "bar")

// The whole data, not the window: a gap zoomed into is a gap, not an empty chart.
const hasData = computed(() =>
  fullSeries.value.some((s) => s.values.some((v) => v != null)),
)

/* Data to interact with: present, and not about to be replaced by the load in
   flight (whose placeholder is what is on screen). */
const ready = computed(() => hasData.value && !props.loading)

/* Which of the three things the plot area holds; the key of its swap. */
const plotState = computed(() => (props.loading ? "loading" : hasData.value ? "plot" : "empty"))

// ── loading placeholder ─────────────────────────
// As many bars as the chart will have, when that is already known (labels
// usually are); see ChartSkeleton.
const skeletonPoints = computed(() => Math.max(count.value, props.labels?.length ?? 0))

// ── axes and frame (see chartScales) ───────────
const { hasRightAxis, scale, rightScale, fmtSeries, scaleOf, box, geo, geoOf, gridLines, xLabels } = useChartScales(props, {
  allSeries,
  visible,
  count,
  hasData,
  labels,
  width,
  banded,
  settle,
})

// ── marks ──────────────────────────────────────
const baseY = computed(() =>
  yAt(
    clamp(0, scale.value.min, scale.value.max),
    scale.value.min,
    scale.value.max,
    box.value,
  ),
)

/*
 * Hidden series are still drawn — off the bottom of the plot and transparent.
 * Dropping them from the list instead makes the legend feel like a switch that
 * deletes a reading: the curve is simply not there on the next frame, while the
 * axis it was scaled against slides to a new range behind it. Kept in the list,
 * it falls out of the plot while the remaining series keep their place, which is
 * what "stop showing this one" should look like.
 */
const curve = computed(() => (view.value.indices ? 0 : props.smooth))

const lines = computed(() =>
  drawnSeries.value.map((s) => {
    const g = geoOf(s)
    // A series leaving the data collapses exactly as one being hidden does.
    const p = presenceOf(s.id) * s.enter
    // Values pulled toward the axis floor, so the curve flattens into it.
    const base = clamp(0, g.min, g.max)
    const values = p === 1 ? s.values : s.values.map((v) => (v == null ? null : base + (v - base) * p))
    return {
      ...s,
      values,
      d: linePath(values, g, curve.value),
      fill: props.type === "area" ? areaPath(values, g, curve.value) : "",
      /* A dashed series is a reference level (a budget, a target), not a
         measurement — dotting it implies readings that aren't there. */
      points: props.showPoints && !s.dashed,
      scale: scaleOf(s),
      /* Fades only at the end of the collapse: going transparent while it is
         still visibly moving loses the travel that explains what happened. */
      alpha: Math.min(1, p * 3),
    }
  }),
)

/** Every bar as an absolute rect — grouped side by side, or stacked (see chartBars). */
const bars = computed(() =>
  props.type === "bar"
    ? layoutBars({
        series: visible.value,
        drawn: drawnById.value,
        count: count.value,
        box: box.value,
        stacked: !!props.stacked,
        scale: scale.value,
        scaleOf,
      })
    : [],
)

// ── hover, zoom and keys (see chartInteraction) ──
const {
  active,
  crosshair,
  selectionBox,
  menuEntries,
  activeX,
  activePoints,
  tooltipRows,
  tooltipTarget,
  summary,
  readout,
  onPointerDown,
  onMove,
  onWheel,
  onLeave,
  onClick,
  onContextMenu,
  onKeydown,
  onBlur,
  resetZoom,
} = useChartInteraction({
  zoomable: () => !!props.zoomable,
  syncGroup: () => props.syncGroup,
  menuItems: () => props.menuItems,
  ariaLabel: () => props.ariaLabel,
  title: () => props.title,
  pointLabel: () => strings.value.point,
  onPointClick: (point) => emit("pointClick", point),
  onPointContextMenu: (point) => emit("pointContextMenu", point),
  setRange,
  view,
  range,
  fullLabels,
  fullCount,
  labels,
  allSeries,
  visible,
  count,
  box,
  geo,
  banded,
  ready,
  drawnById,
  scaleOf,
  fmtSeries,
})

// ── animation ──────────────────────────────────
// One clip rect wipes across the plot; re-keyed when the chart changes KIND so
// a line turned into bars is drawn in afresh rather than snapping.
const revealKey = shallowRef(0)
/* Only the type: new values, a new point count and series coming or going all
   morph (see `drawnSeries`), and a polled dashboard refreshing its numbers
   must not re-wipe on every tick. */
watch(
  () => props.type,
  () => {
    revealKey.value++
  },
)

const clipId = `lp-chart-${useId()}`

/*
 * The gradient id for a series, with the series NAME reduced to id-safe
 * characters.
 *
 * A name is a label — "used %", "in eth0", "read sda" — and putting it verbatim
 * into an id produced `url(#lp-chart-x-g-used %)`, which is not a valid
 * reference: the browser fails to resolve it and falls back to painting the
 * shape black. The gradient was there, correct, and simply never reached, so an
 * area chart of any series whose name held a space or a percent sign rendered
 * as a solid black block under its line — while "cpu" and "memory" on the same
 * page kept their colour, which is what made it look like a data problem rather
 * than an escaping one.
 *
 * Index-suffixed so two names that differ only in punctuation ("in eth0" and
 * "in-eth0") cannot collapse onto one id and share a colour.
 */
const gradientId = (name: string, index: number) =>
  `${clipId}-g-${index}-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`

// ── overlays (see chartOverlays) ───────────────
const { thresholdMarks, markerMarks, bandMarks, annotationMarks } = useChartOverlays({
  thresholds: () => props.thresholds,
  markers: () => props.markers,
  bands: () => props.bands,
  annotations: () => props.annotations,
  view,
  fullLabels,
  fullCount,
  fullSeries,
  hidden,
  width,
  box,
  count,
  banded,
  scale,
  rightScale,
})

// ── export (see chartExport) ───────────────────
function exportCsv(options: ChartExportOptions & CsvOptions = {}): string {
  const csv = chartCsv({ labels: fullLabels.value, series: fullSeries.value, xColumn: strings.value.xColumn }, options)
  if (options.download !== false) {
    downloadFile(`${fileStem(options.filename ?? props.title, "chart")}.csv`, csv, "text/csv;charset=utf-8", svgEl.value?.ownerDocument)
  }
  return csv
}

async function exportPng(options: ChartExportOptions & { scale?: number; background?: string } = {}): Promise<Blob | null> {
  const svg = svgEl.value
  if (!svg) return null
  const legend = props.showLegend && allSeries.value.length > 1 ? visible.value : []
  const blob = await chartPng({ svg, root: root.value, title: props.title, legend }, options)
  if (options.download !== false) downloadFile(`${fileStem(options.filename ?? props.title, "chart")}.png`, blob, undefined, svgEl.value?.ownerDocument)
  return blob
}

defineExpose({ exportCsv, exportPng })

// The chart fills its container's width and sets its own gap between plot and legend — both are layout decisions the page makes, not the chart.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex w-full flex-col gap-3",
)
</script>

<template>
  <div ref="root"
    :class="[rootClass, sampling && 'relative']"
    :inert="sampling || undefined"
    v-bind="rest">
    <HintSampleTag v-if="sampling" />
    <div v-if="title || subtitle || $slots.actions" class="flex items-start justify-between gap-3">
      <div class="flex flex-col gap-0.5">
        <span v-if="title" class="text-sm font-medium text-ink">{{ title }}</span>
        <span v-if="subtitle" class="text-xs text-muted">{{ subtitle }}</span>
      </div>
      <slot name="actions" />
    </div>

    <ChartLegend
      v-if="showLegend && allSeries.length > 1"
      :series="allSeries"
      :hidden="hidden"
      :right-axis="hasRightAxis"
      :right-axis-label="strings.rightAxis"
      @toggle="toggleSeries"
    />

    <!-- `always` keeps reka mounted while the items are still being resolved
         from the click that opens the menu. -->
    <LpContextMenu :items="menuEntries" :always="!!menuItems">
      <!-- `group/plot` + data-state lets the tooltip hide itself while the
           context menu is up: the two would otherwise stack on the same point. -->
      <div
        class="group/plot relative rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :style="{ height: `${height}px` }"
        :tabindex="ready ? 0 : undefined"
        :role="ready ? 'group' : undefined"
        aria-roledescription="chart"
        :aria-label="ready ? summary : undefined"
        :aria-busy="loading || undefined"
        @keydown="onKeydown"
        @blur="onBlur"
      >
        <!-- Placeholder, empty state and plot each fill the same fixed height,
             so the swap only fades and rises; nothing around the chart moves. -->
        <LpSwap :swap-key="plotState">
        <ChartSkeleton
          v-if="loading"
          :type="type"
          :height="height"
          :points="skeletonPoints"
          :y-ticks="yTicks"
          :show-grid="showGrid"
          :show-x-axis="showXAxis"
          :show-y-axis="showYAxis"
          :loading-label="strings.loading"
        />

        <LpEmptyState
          v-else-if="!hasData"
          compact
          :icon="emptyIcon ?? 'lucide:chart-no-axes-column'"
          :title="emptyLabel ?? strings.empty"
          :description="emptyDescription"
          class="justify-center rounded-control border border-dashed border-line py-0"
          :style="{ height: `${height}px` }"
        >
          <template v-if="$slots.empty" #default><slot name="empty" /></template>
        </LpEmptyState>

        <svg
          v-else-if="width > 0"
          ref="svgEl"
          :width="width"
          :height="height"
          class="block overflow-visible touch-none select-none"
          aria-hidden="true"
          @pointerdown="onPointerDown"
          @pointermove="onMove"
          @pointerleave="onLeave"
          @click="onClick"
          @dblclick="zoomable && resetZoom()"
          @wheel="onWheel"
          @contextmenu="onContextMenu"
        >
          <defs>
            <linearGradient
              v-for="(s, i) in lines"
              :id="gradientId(s.name, i)"
              :key="s.key"
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
                :width="still ? plotWidth(box) : 0"
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
            <template v-for="g in gridLines" :key="g.key">
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

          <!-- stretches of the x axis sit under the data -->
          <g v-for="b in bandMarks" :key="`x-band-${b.key}`">
            <rect :x="b.x" :y="box.top" :width="b.width" :height="plotHeight(box)" :fill="b.color" opacity="0.1" />
            <text v-if="b.label" :x="b.x + 4" :y="box.top + 9" class="text-[10px]" :fill="b.color">{{ b.label }}</text>
          </g>

          <!-- threshold bands sit under the data -->
          <rect
            v-for="t in thresholdMarks.filter((m) => m.height > 0)"
            :key="`band-${t.key}`"
            :x="box.left"
            :y="t.top"
            :width="plotWidth(box)"
            :height="t.height"
            :fill="t.color"
            opacity="0.08"
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

            <!-- one group per series, so hiding one drops only that curve -->
            <g v-for="(s, i) in lines" :key="`s-${s.key}`" :style="{ opacity: s.alpha }">
              <path
                v-show="type === 'area'"
                :d="s.fill"
                :fill="`url(#${gradientId(s.name, i)})`"
              />
              <path
                v-show="type !== 'bar'"
                :d="s.d"
                fill="none"
                :stroke="s.color"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                :stroke-dasharray="s.dashed ? '5 4' : undefined"
              />
              <template v-if="type !== 'bar' && s.points">
                <circle
                  v-for="(v, j) in s.values"
                  v-show="v != null"
                  :key="j"
                  :cx="xAt(j, count, box, banded)"
                  :cy="v == null ? 0 : yAt(v, s.scale.min, s.scale.max, box)"
                  r="2.5"
                  :fill="s.color"
                />
              </template>
            </g>
          </g>

          <!-- threshold lines and markers sit over the data, under the crosshair -->
          <g v-for="t in thresholdMarks" :key="`t-${t.key}`">
            <line
              :x1="box.left"
              :x2="box.width - box.right"
              :y1="t.y"
              :y2="t.y"
              :stroke="t.color"
              stroke-width="1"
              :stroke-dasharray="t.solid ? undefined : '4 3'"
            />
            <text
              v-if="t.label"
              :x="box.width - box.right - 4"
              :y="t.top - 4"
              text-anchor="end"
              class="text-[10px]"
              :fill="t.color"
            >
              {{ t.label }}
            </text>
          </g>
          <g v-for="m in markerMarks" :key="`m-${m.key}`">
            <line
              :x1="m.x"
              :x2="m.x"
              :y1="box.top"
              :y2="box.top + plotHeight(box)"
              :stroke="m.color"
              stroke-width="1"
              stroke-dasharray="2 3"
            />
            <text
              v-if="m.label"
              :x="m.x + 4"
              :y="box.top + 9"
              class="text-[10px]"
              :fill="m.color"
            >
              {{ m.label }}
            </text>
          </g>

          <g v-for="a in annotationMarks" :key="`a-${a.key}`">
            <circle :cx="a.x" :cy="a.y" r="3.5" :fill="a.color" stroke="var(--color-surface)" stroke-width="1.5" />
            <text
              :x="a.anchor === 'end' ? a.x - 6 : a.x + 6"
              :y="a.y - 6"
              :text-anchor="a.anchor"
              class="text-[10px]"
              :fill="a.color"
            >
              {{ a.label }}
            </text>
          </g>

          <rect
            v-if="selectionBox"
            data-lp-chart-selection
            :x="selectionBox.x"
            :y="box.top"
            :width="selectionBox.width"
            :height="plotHeight(box)"
            fill="var(--color-brand)"
            opacity="0.15"
          />

          <!-- crosshair -->
          <g v-if="crosshair >= 0 && type !== 'bar'">
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
              :key="p.id"
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
        </LpSwap>

        <!-- tooltip: springs after the pointer (see ChartTooltip) -->
        <ChartTooltip
          v-if="active >= 0 && ready"
          :label="labels[active]"
          :rows="tooltipRows"
          :target="tooltipTarget"
        />

        <button
          v-if="zoomable && range && ready"
          type="button"
          class="absolute right-1 top-1 rounded-inner bg-surface-raised px-2 py-0.5 text-[11px] text-muted-strong outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          @click="resetZoom"
        >
          {{ strings.resetZoom }}
        </button>

        <span class="sr-only" aria-live="polite">{{ readout }}</span>
      </div>
    </LpContextMenu>

    <ChartRangeSelector
      v-if="rangeSelector && ready && width > 0"
      :values="(fullSeries.find((s) => s.values.some((v) => v != null))?.values ?? [])"
      :count="fullCount"
      :range="range"
      :width="width"
      :labels="fullLabels"
      :start-label="strings.rangeStart"
      :end-label="strings.rangeEnd"
      @change="setRange"
    />

    <ChartDataTable
      v-if="dataTable && ready"
      :title="title"
      :labels="fullLabels"
      :series="fullSeries"
      :format="fmtSeries"
    />
  </div>
</template>


<style scoped>
/*
 * A series leaving, and the axis it was measured against following it.
 *
 * Both run on the same duration so the curve and its numbers settle together:
 * the axis arriving first would read as the scale having changed for its own
 * reasons, rather than because a series left.
 */
</style>
