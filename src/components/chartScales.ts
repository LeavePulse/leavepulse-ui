import { computed, type Ref } from "vue"
import { clamp } from "../composables/clamp"
import { lerp, useTween, type TweenOptions } from "../composables/useTween"
import {
  axisTicks,
  extent,
  fitScale,
  formatTick,
  niceScale,
  plotHeight,
  plotWidth,
  xAt,
  xLabelIndices,
  type Box,
  type ChartThreshold,
  type NormalSeries,
} from "./chart"

/*
 * LpChart's axes and frame: the scale of each axis (eased as the data or the
 * visible series change), how a value reads on it, the gutters the tick labels
 * need, the plot's box and the gridlines and x labels drawn in it.
 */

/** The props of LpChart the axes are built from. */
export interface ChartScaleProps {
  type: "line" | "area" | "bar"
  includeZero?: boolean
  stacked?: boolean
  thresholds: ChartThreshold[]
  yTicks: number
  unit?: string
  rightUnit?: string
  formatValue?: (v: number) => string
  formatRightValue?: (v: number) => string
  showXAxis?: boolean
  showYAxis?: boolean
  height: number
}

export interface ChartScaleData<S extends NormalSeries & { id: string }> {
  /** Every series, hidden ones included: which axes exist. */
  allSeries: Ref<S[]>
  /** The visible series: what the axes are measured on. */
  visible: Ref<S[]>
  count: Ref<number>
  hasData: Ref<boolean>
  /** The x labels of the window on show. */
  labels: Ref<string[]>
  width: Ref<number>
  banded: Ref<boolean>
  /** The clock every eased value of the chart shares. */
  settle: Pick<TweenOptions<unknown>, "duration" | "ease" | "enabled">
}

/*
 * The axis animates by interpolating its own BOUNDS, not by transitioning the
 * elements drawn from them.
 *
 * Everything on the plot is positioned from min/max — the curves, the gridlines
 * and the tick labels — so moving the range moves all three as one gesture, and
 * the numbers arrive with the shape that made them change. Transitioning the
 * marks instead would need the axis to animate separately, and it cannot: `y1`
 * and `y2` on an SVG <line> never became CSS properties, so a gridline jumps
 * while the curve eases, which is the two-beat effect this avoids.
 */
type Range = { min: number; max: number; step: number }

const sameRange = (a: Range | null, b: Range | null) =>
  a === b || (!!a && !!b && a.min === b.min && a.max === b.max && a.step === b.step)

const mixRange = (from: Range, to: Range, t: number): Range => ({
  min: lerp(from.min, to.min, t),
  max: lerp(from.max, to.max, t),
  /* The step stays the target's: it decides how many ticks there are, and a
     travelling one would add and drop labels mid-move. */
  step: to.step,
})

export function useChartScales<S extends NormalSeries & { id: string }>(props: Readonly<ChartScaleProps>, data: ChartScaleData<S>) {
  const { allSeries, visible, count, hasData, labels, width, banded, settle } = data

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

  /*
   * Which axes EXIST is decided by the series as declared; only their ranges
   * follow what is visible.
   *
   * Hiding the one series on the right axis used to remove that axis outright:
   * its labels went, the gutter they reserved collapsed, the plot widened into
   * the space, and any remaining right-axis series jumped across to the left
   * scale — a toggle of one curve rearranging the whole frame. Keeping the axis
   * while it has a series assigned to it means hiding a curve changes the curve.
   */
  const declaredRight = computed(() => allSeries.value.filter((s) => s.axis === "right"))
  const declaredLeft = computed(() => allSeries.value.filter((s) => s.axis === "left"))

  const onRight = computed(() => visible.value.filter((s) => s.axis === "right"))
  const onLeft = computed(() => {
    // A chart whose every series asked for the right axis still needs the left
    // one to carry the grid, so treat that as "no split at all".
    const left = visible.value.filter((s) => s.axis === "left")
    return left.length || !declaredRight.value.length ? left : visible.value
  })
  const hasRightAxis = computed(
    () => declaredRight.value.length > 0 && declaredLeft.value.length > 0,
  )

  /** A reference level must be on the plot, or it says nothing. */
  const withThresholds = (raw: { min: number; max: number }, axis: "left" | "right") => {
    let { min, max } = raw
    for (const t of props.thresholds) {
      if ((t.axis ?? "left") !== axis) continue
      for (const v of [t.value, t.to]) {
        if (v == null || !Number.isFinite(v)) continue
        min = Math.min(min, v)
        max = Math.max(max, v)
      }
    }
    return { min, max }
  }

  const scaleFor = (members: S[]) => {
    const totals = stackTotals.value
    const raw = totals
      ? { min: Math.min(0, ...totals.neg), max: Math.max(0, ...totals.pos) }
      : extent(members, zeroBased.value)
    const wide = hasData.value ? withThresholds(raw, "left") : raw
    return niceScale(wide.min, wide.max, props.yTicks)
  }

  const targetScale = computed(() =>
    scaleFor(onLeft.value.length ? onLeft.value : declaredLeft.value),
  )

  const scale = useTween(() => targetScale.value, mixRange, { ...settle, equal: sameRange })

  /*
   * The right axis reuses the LEFT axis's tick COUNT so both sets of labels land
   * on the same gridlines. Two independent tick runs would draw two interleaved
   * grids across one plot, which reads as noise rather than as two scales.
   */
  const targetRightScale = computed(() => {
    if (!hasRightAxis.value) return null
    /* With every right-hand series hidden there is nothing to measure, so the
       axis holds the range it had — an axis that keeps its place while its curve
       leaves, rather than collapsing to a degenerate 0..1 behind it. */
    const members = onRight.value.length ? onRight.value : declaredRight.value
    const raw = withThresholds(extent(members, zeroBased.value), "right")
    /* Steps come from the TARGET left scale. Reading the animated one rebuilt this
       axis from a fractional range every frame, so a right-hand series jittered
       against a scale being redrawn underneath it. */
    const steps = Math.max(
      1,
      axisTicks(targetScale.value.min, targetScale.value.max, targetScale.value.step).length - 1,
    )
    return fitScale(raw.min, raw.max, steps)
  })

  // The right axis travels on the same clock as the left, or a series measured
  // against it arrives before the one beside it.
  const rightScale = useTween(
    () => targetRightScale.value,
    // An axis that appears or goes has no range to travel from or to.
    (from, to, t) => (from && to ? mixRange(from, to, t) : to),
    { ...settle, equal: sameRange },
  )

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
  /*
   * Labels come from the TARGET scale, never the one mid-flight.
   *
   * The animated bounds are fractional for most of their travel, so formatting
   * them printed "173.4" where "200" belongs — and since the gutter is measured
   * from the widest label, the whole plot breathed in and out for the length of
   * every transition. The numbers a tick can read are the ones it will settle on;
   * only where each sits is in motion.
   */
  const yLabels = computed(() =>
    axisTicks(targetScale.value.min, targetScale.value.max, targetScale.value.step).map(fmt),
  )

  const rightLabels = computed(() =>
    targetRightScale.value
      ? axisTicks(
          targetRightScale.value.min,
          targetRightScale.value.max,
          targetRightScale.value.step,
        ).map(fmtRight)
      : [],
  )

  const gutter = (labels: string[]) => 12 + Math.max(...labels.map((l) => l.length), 1) * 7

  /*
   * The gutters ease to their new width instead of resizing on the frame the
   * labels change. Going from "800" to "30" narrows the left margin by a third of
   * an inch in one step, and because the plot is measured from it, every mark
   * shifted sideways while it was still travelling vertically — a diagonal slide
   * nothing in the data asked for.
   */
  const targetGutters = computed(() => ({
    left: props.showYAxis ? gutter(yLabels.value) : 8,
    right: props.showYAxis && rightLabels.value.length ? gutter(rightLabels.value) : 12,
  }))

  const gutters = useTween(
    () => targetGutters.value,
    (from, to, t) => ({ left: lerp(from.left, to.left, t), right: lerp(from.right, to.right, t) }),
    { ...settle, equal: (a, b) => a.left === b.left && a.right === b.right },
  )

  const box = computed<Box>(() => ({
    width: width.value,
    height: props.height,
    left: gutters.value.left,
    right: gutters.value.right,
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
    // Ticks are the target's — they are the figures the axis will read — while
    // the position each one takes comes from the scale as it currently stands.
    const left = axisTicks(targetScale.value.min, targetScale.value.max, targetScale.value.step)
    const right = targetRightScale.value
      ? axisTicks(
          targetRightScale.value.min,
          targetRightScale.value.max,
          targetRightScale.value.step,
        )
      : []
    /*
     * A tick sits at its FRACTION of the axis, not at its value on the scale
     * currently in flight.
     *
     * Projecting the value instead put "800" where 800 falls on a range still
     * reading 0..30 — roughly seventeen hundred pixels above a plot 240 tall.
     * The labels shot off the top, came back as the range caught up, and the
     * chart looked like it had thrown them. As a fraction, the top tick is the
     * top of the axis throughout, whatever number it happens to carry.
     */
    const span = targetScale.value.max - targetScale.value.min || 1
    const plot = plotHeight(box.value)
    return left.map((v, i) => {
      const fraction = (v - targetScale.value.min) / span
      return {
        v,
        /*
         * Keyed by POSITION, not by value. A tick keyed by its value is a
         * different element every time the range moves, so hiding a series
         * replaced the whole axis at once — the numbers jumped to their new
         * places instead of moving there.
         */
        key: i,
        y: box.value.top + plot - fraction * plot,
        label: fmt(v),
        rightLabel: right[i] != null ? fmtRight(right[i]) : "",
      }
    })
  })

  /** Thin out x labels so they never collide at narrow widths. */
  const xLabelStride = computed(() => {
    const w = plotWidth(box.value)
    if (w <= 0 || count.value === 0) return 1
    const longest = Math.max(...labels.value.map((l) => l.length), 1)
    return Math.max(1, Math.ceil((count.value * (longest * 6.5 + 16)) / w))
  })

  const xLabels = computed(() =>
    xLabelIndices(labels.value.length, xLabelStride.value).map((i) => ({
      label: labels.value[i],
      i,
      x: xAt(i, count.value, box.value, banded.value),
    })),
  )

  return { hasRightAxis, scale, rightScale, fmtSeries, scaleOf, box, geo, geoOf, gridLines, xLabels }
}
