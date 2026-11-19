import { computed, type Ref } from "vue"
import {
  markerIndex,
  xAt,
  yAt,
  type Box,
  type ChartAnnotation,
  type ChartBand,
  type ChartMarker,
  type ChartThreshold,
} from "./chart"
import { slotOf, type ChartView } from "./chartWindow"

/*
 * LpChart's overlays placed on the plot: thresholds (lines and bands),
 * markers, stretches of the x axis and annotations. Each is resolved against
 * the data as a whole and then laid into the window on show.
 */

/** Width of a card beside a point (the tooltip, an annotation); past it, the card flips to the left. */
export const CHART_CARD_W = 150

interface AxisRange {
  min: number
  max: number
}

export interface ChartOverlayOptions {
  thresholds: () => ChartThreshold[]
  markers: () => ChartMarker[]
  bands: () => ChartBand[]
  annotations: () => ChartAnnotation[]
  view: Ref<ChartView>
  fullLabels: Ref<string[]>
  fullCount: Ref<number>
  fullSeries: Ref<readonly { id: string; axis: "left" | "right"; values: readonly (number | null)[] }[]>
  hidden: Ref<ReadonlySet<string>>
  width: Ref<number>
  box: Ref<Box>
  count: Ref<number>
  banded: Ref<boolean>
  scale: Ref<AxisRange>
  rightScale: Ref<AxisRange | null>
}

export function useChartOverlays(options: ChartOverlayOptions) {
  const { view, fullLabels, fullCount, fullSeries, hidden, width, box, count, banded, scale, rightScale } = options

  const thresholdMarks = computed(() =>
    options.thresholds().flatMap((t, i) => {
      if (!Number.isFinite(t.value) || width.value <= 0) return []
      const sc = t.axis === "right" && rightScale.value ? rightScale.value : scale.value
      const y = yAt(t.value, sc.min, sc.max, box.value)
      const to = t.to != null && Number.isFinite(t.to) ? yAt(t.to, sc.min, sc.max, box.value) : null
      return [
        {
          key: i,
          y,
          top: to == null ? y : Math.min(y, to),
          height: to == null ? 0 : Math.abs(to - y),
          label: t.label,
          color: t.color ?? "var(--color-line-strong)",
          solid: !!t.solid,
        },
      ]
    }),
  )

  const markerMarks = computed(() =>
    options.markers().flatMap((m, i) => {
      const index = slotOf(view.value, markerIndex(m.at, fullLabels.value, fullCount.value))
      if (index < 0 || width.value <= 0) return []
      return [
        {
          key: i,
          x: xAt(index, count.value, box.value, banded.value),
          label: m.label,
          color: m.color ?? "var(--color-line-strong)",
        },
      ]
    }),
  )

  /* A source point's x, held to the plot when the window has left it behind. */
  const xOfSource = (source: number): number => {
    if (source < view.value.start) return box.value.left
    if (source > view.value.end) return box.value.width - box.value.right
    return xAt(slotOf(view.value, source), count.value, box.value, banded.value)
  }

  const bandMarks = computed(() =>
    options.bands().flatMap((b, i) => {
      const ends = [markerIndex(b.from, fullLabels.value, fullCount.value), markerIndex(b.to, fullLabels.value, fullCount.value)]
      if (ends.some((end) => end < 0) || width.value <= 0) return []
      const from = Math.min(...ends)
      const to = Math.max(...ends)
      if (to < view.value.start || from > view.value.end) return []
      const x = xOfSource(from)
      return [{ key: i, x, width: xOfSource(to) - x, label: b.label, color: b.color ?? "var(--color-line-strong)" }]
    }),
  )

  const annotationMarks = computed(() =>
    options.annotations().flatMap((a, i) => {
      const source = markerIndex(a.at, fullLabels.value, fullCount.value)
      const slot = slotOf(view.value, source)
      const lead = fullSeries.value.find((s) => !hidden.value.has(s.id) && s.values[source] != null)
      const value = a.value ?? lead?.values[source]
      if (slot < 0 || value == null || width.value <= 0) return []
      const sc = (a.value == null ? lead?.axis : a.axis) === "right" && rightScale.value ? rightScale.value : scale.value
      const x = xAt(slot, count.value, box.value, banded.value)
      return [
        {
          key: i,
          x,
          y: yAt(value, sc.min, sc.max, box.value),
          label: a.label,
          color: a.color ?? "var(--color-ink)",
          anchor: x > box.value.width - CHART_CARD_W ? ("end" as const) : ("start" as const),
        },
      ]
    }),
  )

  return { thresholdMarks, markerMarks, bandMarks, annotationMarks }
}
