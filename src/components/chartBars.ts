/*
 * LpChart's bars, laid out: every bar an absolute shape, grouped side by side
 * or stacked, free of the component so the layout can be read (and tested)
 * on its own.
 */
import { barPath, plotWidth, xAt, yAt, type Box } from "./chart"
import { clamp } from "../composables/clamp"

export interface ChartBar {
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
}

interface AxisRange {
  min: number
  max: number
}

export interface ChartBarInput<S extends { id: string; color: string; values: readonly (number | null)[] }> {
  /** The visible series, in drawing order. */
  series: readonly S[]
  /** The drawn (animated) copy of each series by id: its values and how far it has arrived. */
  drawn: ReadonlyMap<string, { values: readonly (number | null)[]; enter: number }>
  count: number
  box: Box
  stacked: boolean
  /** The left axis, which a stack is measured on. */
  scale: AxisRange
  /** The axis a series is measured on, for grouped bars. */
  scaleOf: (series: S) => AxisRange
}

/** Every bar as an absolute rect — grouped side by side, or stacked. */
export function layoutBars<S extends { id: string; color: string; values: readonly (number | null)[] }>(input: ChartBarInput<S>): ChartBar[] {
  const { series, drawn: drawnById, count, box, stacked, scale } = input
  if (count === 0 || plotWidth(box) <= 0) return []
  const band = plotWidth(box) / count
  /* Bars read as a series of measurements, not as a filled block: keep real
     ground visible between bands, and cap the width so a 4-point chart doesn't
     turn into slabs. */
  const inner = Math.min(band * 0.6, stacked ? 46 : 30 * (series.length || 1))
  const n = series.length || 1
  const slot = stacked ? inner : inner / n
  const out: ChartBar[] = []

  const posTop = new Array(count).fill(0)
  const negTop = new Array(count).fill(0)

  series.forEach((s, si) => {
    // Heights from the drawn copy, so bars grow and shrink to their new values;
    // a series just arriving rises from the baseline.
    const drawn = drawnById.get(s.id)
    for (let i = 0; i < count; i++) {
      const raw = drawn ? drawn.values[i] : s.values[i]
      if (raw == null) continue
      const v = raw * (drawn?.enter ?? 1)
      const centre = xAt(i, count, box, true)
      const x = stacked ? centre - inner / 2 : centre - inner / 2 + si * slot
      let y: number
      let h: number
      if (stacked) {
        // Each stacked bar starts where the previous one of its sign ended.
        const prev = v >= 0 ? posTop[i] : negTop[i]
        const from = yAt(prev, scale.min, scale.max, box)
        const to = yAt(prev + v, scale.min, scale.max, box)
        y = Math.min(from, to)
        h = Math.abs(to - from)
        if (v >= 0) posTop[i] += v
        else negTop[i] += v
      } else {
        const sc = input.scaleOf(s)
        const top = yAt(v, sc.min, sc.max, box)
        const base = yAt(clamp(0, sc.min, sc.max), sc.min, sc.max, box)
        y = Math.min(top, base)
        h = Math.abs(top - base)
      }
      out.push({
        key: `${s.id}-${i}`,
        x,
        y,
        w: Math.max(1, slot - (stacked ? 0 : 2)),
        h: Math.max(v === 0 ? 0 : 1, h),
        color: s.color,
        index: i,
        /* A standalone bar rounds only the end it grows toward: a negative one
           hangs off the baseline, so its square end is the top. */
        roundTop: stacked || v >= 0,
        roundBottom: stacked || v < 0,
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
  if (stacked) {
    const columns = new Map<number, ChartBar[]>()
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
}
