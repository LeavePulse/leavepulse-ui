<script setup lang="ts">
/*
 * A trend, inline. No axes, no grid, no legend — just the shape of a series,
 * sized to sit inside a table cell or beside a stat's value.
 *
 * Deliberately NOT LpChart with everything switched off. LpChart answers "what
 * were the values" and pays for it: a ResizeObserver, two scales, a tooltip
 * spring, a context menu. A sparkline answers "up or down", and there are forty
 * of them on a list page — so it measures nothing, observes nothing and holds
 * no state. The viewBox is fixed and the browser scales the path; the geometry
 * is the same `chart.ts` the full chart uses, so a line reads identically in
 * both.
 *
 *   <LpSparkline :data="cpu" />
 *   <LpSparkline :data="load" area tone="danger" :width="72" />
 */
import { computed } from "vue"
import { useReveal } from "../composables/useReveal"
import { areaPath, extent, linePath, normalise, type Box } from "./chart"

const props = withDefaults(
  defineProps<{
    /** Oldest → newest. `null` breaks the line, as in LpChart. */
    data: (number | null)[]
    /** Rendered size in px. The path scales to it; stroke width does not. */
    width?: number
    height?: number
    /** Any CSS colour. Defaults to the brand token. */
    color?: string
    /** Named theme tones, for callers that don't want to spell a var(). */
    tone?: "brand" | "action" | "danger" | "accent" | "muted"
    /** Fill under the line. */
    area?: boolean
    /** Curve tension, as in LpChart. 0 draws a polyline. */
    smooth?: number
    /** Dot on the final point — "you are here" on a trend. */
    showLast?: boolean
    /**
     * Pin the vertical range instead of fitting the data. Without it a flat
     * series fills the box with noise, and two sparklines in one column can't
     * be compared: each would be scaled to its own extremes.
     */
    min?: number
    max?: number
    /** Accessible description; falls back to a direction + latest value. */
    ariaLabel?: string
    /**
     * Draw the line on from oldest to newest when it first appears. Turn it off
     * for a table that renders many at once — dozens of simultaneous sweeps
     * read as flicker.
     */
    animate?: boolean
    /**
     * Draw time in ms. The stroke travels at a near-even rate (see
     * `--ease-travel`), so this is roughly how long the line is actually
     * watched being drawn — not a figure mostly spent easing out.
     */
    duration?: number
  }>(),
  { width: 84, height: 24, tone: "brand", smooth: 0.9, animate: true, duration: 900 },
)

const TONE: Record<string, string> = {
  brand: "var(--color-brand)",
  action: "var(--color-action)",
  danger: "var(--color-danger)",
  accent: "var(--color-accent)",
  muted: "var(--color-muted)",
}

const stroke = computed(() => props.color ?? TONE[props.tone])

const series = computed(() => normalise([{ name: "s", data: props.data }]))

/*
 * The path is built in the viewBox's own coordinates and the SVG scales it, so
 * nothing here depends on layout — which is what lets this render identically
 * on the server and in a cell that hasn't been measured yet.
 *
 * Inset by half a stroke so the line's own width can't be clipped at the edges,
 * and by a little more vertically so a peak sitting exactly at the maximum
 * keeps its round cap.
 */
const PAD = 2

const box = computed<Box>(() => ({
  width: props.width,
  height: props.height,
  left: PAD,
  right: PAD,
  top: PAD,
  bottom: PAD,
}))

const bounds = computed(() => {
  const auto = extent(series.value, false)
  return { min: props.min ?? auto.min, max: props.max ?? auto.max }
})

const geo = computed(() => ({
  min: bounds.value.min,
  max: bounds.value.max,
  box: box.value,
  count: props.data.length,
  banded: false,
}))

const d = computed(() => linePath(series.value[0].values, geo.value, props.smooth))
const fill = computed(() =>
  props.area ? areaPath(series.value[0].values, geo.value, props.smooth) : "",
)

/** Last point that actually has a value — the dot goes there, not on a gap. */
const lastPoint = computed(() => {
  const values = series.value[0].values
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (v == null) continue
    const span = bounds.value.max - bounds.value.min || 1
    const w = props.width - PAD * 2
    const h = props.height - PAD * 2
    return {
      x: props.data.length <= 1 ? PAD + w / 2 : PAD + (w / (props.data.length - 1)) * i,
      y: PAD + h - ((v - bounds.value.min) / span) * h,
      v,
    }
  }
  return null
})

const hasData = computed(() => series.value[0].values.some((v) => v != null))

/* A bare <svg> is invisible to a screen reader; say the shape out loud. */
const label = computed(() => {
  if (props.ariaLabel) return props.ariaLabel
  const values = series.value[0].values.filter((v): v is number => v != null)
  if (!values.length) return "No data"
  const first = values[0]
  const last = values[values.length - 1]
  const dir = last > first ? "trending up" : last < first ? "trending down" : "flat"
  return `${dir}, latest ${last}`
})

/*
 * Dash-offset reveal: the stroke is dashed with one dash as long as the whole
 * path and the offset animated from that length to zero, so the line appears to
 * be drawn. The dash length only has to be an OVER-estimate — the bounding box
 * diagonal per segment always is — which avoids measuring the path in the DOM
 * and keeps the component render-only, as SSR needs.
 */
const pathLength = computed(() => {
  const n = Math.max(1, props.data.length - 1)
  const segment = Math.hypot((props.width - PAD * 2) / n, props.height - PAD * 2)
  return Math.ceil(segment * n + 4)
})

/*
 * The sweep is held until the svg is actually on screen. Forty of these sit in
 * a list, most of them below the fold; started on mount they would all have
 * finished before the rows carrying them were ever scrolled to.
 */
const { el, revealed } = useReveal({ immediate: () => !props.animate })

const revealStyle = computed(() =>
  props.animate
    ? {
        "--lp-spark-len": `${pathLength.value}`,
        "--lp-spark-dur": `${props.duration}ms`,
      }
    : undefined,
)

/*
 * Three states, not two: no animation at all (paint it), waiting to be seen
 * (hold it back), and drawing. The waiting state has to be marked on the
 * element, because the animation's own "from" cannot express it — a paused
 * keyframe still needs the dash variables set, and those are exactly what a
 * finished-looking fallback resolves to.
 */
const revealClass = computed(() => (props.animate && !revealed.value ? "lp-spark--waiting" : ""))

const gradientId = `lp-spark-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <svg
    v-if="hasData"
    ref="el"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    role="img"
    :aria-label="label"
    class="shrink-0 overflow-visible"
  >
    <defs v-if="area">
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="stroke" stop-opacity="0.3" />
        <stop offset="100%" :stop-color="stroke" stop-opacity="0.02" />
      </linearGradient>
    </defs>

    <!--
      The line DRAWS ITSELF from oldest to newest, and the fill and the end dot
      arrive behind it.

      A trend has a direction, and a sparkline that simply appears states a
      shape without it. Stroking it left to right replays the reading order the
      data already has — and in a list of them, the eye is drawn to the row that
      just refreshed. `animate: false` for a table that renders dozens at once,
      where the sweep would read as flicker rather than as arrival.
    -->
    <path
      v-if="area"
      :d="fill"
      :fill="`url(#${gradientId})`"
      class="lp-spark__area"
      :class="revealClass"
      :style="revealStyle"
    />
    <path
      :d="d"
      fill="none"
      :stroke="stroke"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
      class="lp-spark__line"
      :class="revealClass"
      :style="revealStyle"
    />
    <circle
      v-if="showLast && lastPoint"
      :cx="lastPoint.x"
      :cy="lastPoint.y"
      r="2"
      :fill="stroke"
      class="lp-spark__dot"
      :class="revealClass"
      :style="revealStyle"
    />
  </svg>

  <!-- Keeps the row's rhythm when a machine has reported nothing yet. -->
  <span
    v-else
    class="inline-block shrink-0 rounded-pill bg-surface-soft"
    :style="{ width: `${width}px`, height: '2px' }"
    role="img"
    :aria-label="label"
  />
</template>

<style>
/*
 * Unscoped and namespaced: the reveal is driven by CSS variables the component
 * sets inline, and keyframes cannot live in a scoped block that the animated
 * element may not carry the attribute for.
 *
 * Only elements that were given the variables animate — `animate: false` omits
 * them, the `var()` fallbacks resolve to a finished state, and nothing moves.
 *
 * `--waiting` is the third state: the element is on the page but has not been
 * scrolled to, so it is held at the animation's first frame. It cannot simply
 * be left un-animated, because that is indistinguishable from finished.
 */
.lp-spark__line {
  stroke-dasharray: var(--lp-spark-len, none);
  stroke-dashoffset: 0;
  animation: lp-spark-draw var(--lp-spark-dur, 0ms) var(--ease-travel) both;
}

.lp-spark__area,
.lp-spark__dot {
  /* Behind the line: the fill and the end marker belong to a line that has
     already been drawn, so they fade in over its last third. */
  animation: lp-spark-fade var(--lp-spark-dur, 0ms) ease both;
}

.lp-spark--waiting.lp-spark__line {
  stroke-dashoffset: var(--lp-spark-len, 0);
  animation: none;
}

.lp-spark--waiting.lp-spark__area,
.lp-spark--waiting.lp-spark__dot {
  opacity: 0;
  animation: none;
}

@keyframes lp-spark-draw {
  from {
    stroke-dashoffset: var(--lp-spark-len, 0);
  }
}

@keyframes lp-spark-fade {
  0%,
  60% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-spark__line,
  .lp-spark__area,
  .lp-spark__dot {
    animation: none;
  }
}
</style>
