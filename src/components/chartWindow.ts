import { clamp } from "../composables/clamp"
import { shiftSpan, zoomSpan } from "../composables/span"

/*
 * The part of a long series a chart draws: which points are in the window, and
 * how many of them survive the width of the plot. No DOM and no Vue, so the
 * promises it makes (a peak is never lost) can be tested on the numbers.
 */

/** A window into the data: indices of its first and last point, both included. */
export interface ChartRange {
  start: number
  end: number
}

/** How a series longer than the plot is thinned. */
export type ChartDownsample = "minmax" | "lttb"

/** What the chart draws: per series values, each slot traced back to its source. */
export interface ChartView {
  values: (number | null)[][]
  start: number
  end: number
  /** Source index of every slot; null while the slots are contiguous from `start`. */
  indices: number[] | null
}

type Values = (number | null)[]

/* Below this a window has no line to read: two points are one segment. */
export const MIN_RANGE_POINTS = 2
/* Two slots a bucket: its lowest and its highest reading, in the order they came. */
const SLOTS_PER_BUCKET = 2
/* LTTB always keeps the first and last point, so anything less is not a choice. */
const LTTB_MIN_TARGET = 3
/* Share of the window one step of a keyboard or wheel zoom takes away. */
export const ZOOM_STEP = 0.8

/**
 * A range fit to the data: in bounds, ordered, at least `MIN_RANGE_POINTS` wide.
 * Null when there is nothing to narrow, so the whole series stays the plain case.
 */
export function clampRange(range: ChartRange | null | undefined, count: number): ChartRange | null {
  if (!range || count <= MIN_RANGE_POINTS || !Number.isFinite(range.start) || !Number.isFinite(range.end)) return null
  const last = count - 1
  let start = Math.max(0, Math.min(last, Math.round(Math.min(range.start, range.end))))
  let end = Math.max(0, Math.min(last, Math.round(Math.max(range.start, range.end))))
  if (end - start + 1 < MIN_RANGE_POINTS) {
    end = Math.min(last, start + MIN_RANGE_POINTS - 1)
    start = Math.max(0, end - MIN_RANGE_POINTS + 1)
  }
  return start === 0 && end === last ? null : { start, end }
}

/** The range after a zoom by `factor` (below 1 is in), keeping `anchor` (0–1 across it) in place. */
export function zoomRange(range: ChartRange | null, count: number, anchor: number, factor: number): ChartRange | null {
  const from = range ?? { start: 0, end: count - 1 }
  const at = from.start + (from.end - from.start) * clamp(anchor, 0, 1)
  return clampRange(zoomSpan(from.start, from.end, at, factor, MIN_RANGE_POINTS - 1), count)
}

/** The range moved by `delta` points, keeping its width at the ends of the data. */
export function panRange(range: ChartRange, count: number, delta: number): ChartRange | null {
  return clampRange(shiftSpan(range.start, range.end, delta, 0, count - 1), count)
}

/**
 * Keeps each bucket's lowest and highest reading, per series. Slots stay shared
 * across series, so a bucket is two x positions and each series fills them with
 * its own extremes. A monitoring chart must not lose a one-point spike: thinning
 * by average or by every n-th point does exactly that.
 */
export function minMaxBuckets(series: Values[], slots: number): { values: Values[]; indices: number[] } {
  const count = series.reduce((n, values) => Math.max(n, values.length), 0)
  const buckets = Math.floor(slots / SLOTS_PER_BUCKET)
  if (count === 0 || buckets < 1) return { values: series.map(() => []), indices: [] }
  const indices: number[] = []
  const values: Values[] = series.map(() => [])
  for (let bucket = 0; bucket < buckets; bucket++) {
    const from = Math.floor((bucket * count) / buckets)
    const to = Math.floor(((bucket + 1) * count) / buckets)
    if (to <= from) continue
    indices.push(from, Math.max(from, to - 1))
    series.forEach((data, s) => {
      let low = -1
      let high = -1
      for (let i = from; i < to && i < data.length; i++) {
        const v = data[i]
        if (v == null) continue
        if (low < 0 || v < (data[low] as number)) low = i
        if (high < 0 || v > (data[high] as number)) high = i
      }
      if (low < 0) values[s].push(null, null)
      else values[s].push(data[Math.min(low, high)], data[Math.max(low, high)])
    })
  }
  return { values, indices }
}

/**
 * Largest-Triangle-Three-Buckets: the indices of `target` points that keep a
 * line's shape, one a bucket, always with its first and last. It reads better
 * than min/max on a smooth curve and can drop a short spike, so it is the
 * option rather than the default.
 */
export function lttbIndices(values: Values, target: number): number[] {
  const present = values.flatMap((v, i) => (v == null ? [] : [i]))
  if (target >= present.length || target < LTTB_MIN_TARGET) return present
  const y = (at: number) => values[present[at]] as number
  const x = (at: number) => present[at]
  const step = (present.length - 2) / (target - 2)
  const kept = [0]
  let previous = 0
  for (let bucket = 0; bucket < target - 2; bucket++) {
    const from = Math.floor(bucket * step) + 1
    const to = Math.floor((bucket + 1) * step) + 1
    const nextEnd = Math.min(present.length, Math.floor((bucket + 2) * step) + 1)
    let meanX = 0
    let meanY = 0
    for (let i = to; i < nextEnd; i++) {
      meanX += x(i)
      meanY += y(i)
    }
    const size = Math.max(1, nextEnd - to)
    meanX /= size
    meanY /= size
    let best = from
    let largest = -1
    for (let i = from; i < to; i++) {
      const area = Math.abs((x(previous) - meanX) * (y(i) - y(previous)) - (x(previous) - x(i)) * (meanY - y(previous)))
      if (area > largest) {
        largest = area
        best = i
      }
    }
    kept.push(best)
    previous = best
  }
  kept.push(present.length - 1)
  return kept.map((at) => present[at])
}

const contiguous = (series: Values[], range: ChartRange): Values[] =>
  series.map((values) => values.slice(range.start, range.end + 1))

/**
 * The series as drawn. Without a range or a thinning it hands the input back, so
 * a chart using neither does no work and draws what it always drew.
 *
 * LTTB picks by the first series that has data and the others follow those
 * points, because slots are shared across series.
 */
export function chartView(
  series: Values[],
  count: number,
  range: ChartRange | null,
  mode: ChartDownsample | false | undefined,
  slots: number,
): ChartView {
  const start = range?.start ?? 0
  const end = range?.end ?? Math.max(0, count - 1)
  const windowed = range ? contiguous(series, range) : series
  const shown = end - start + 1
  if (!mode || slots <= 0 || shown <= slots) return { values: windowed, start, end, indices: null }
  if (mode === "minmax") {
    const { values, indices } = minMaxBuckets(windowed, slots)
    return { values, start, end, indices: indices.map((i) => i + start) }
  }
  const lead = windowed.find((values) => values.some((v) => v != null)) ?? []
  const picked = lttbIndices(lead, slots)
  return {
    values: windowed.map((values) => picked.map((i) => values[i] ?? null)),
    start,
    end,
    indices: picked.map((i) => i + start),
  }
}

/** The slot at or before a source index, or -1 when the window does not hold it. */
export function slotOf(view: ChartView, source: number): number {
  if (source < view.start || source > view.end) return -1
  if (!view.indices) return source - view.start
  let low = 0
  let high = view.indices.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (view.indices[middle] <= source) low = middle
    else high = middle - 1
  }
  return high < 0 ? -1 : low
}

/** The source index behind a slot. */
export const sourceOf = (view: ChartView, slot: number): number => (view.indices ? (view.indices[slot] ?? -1) : slot + view.start)
