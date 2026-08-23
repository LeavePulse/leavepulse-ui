/*
 * Geometry and formatting for LpChart, kept out of the .vue so the maths is
 * testable and readable on its own. Everything here is pure: given data and a
 * pixel box, return paths and tick positions.
 */

export interface ChartPoint {
  /** Numeric value. `null` breaks the line — a real gap, not a zero. */
  y: number | null
  /** Optional label for this point; falls back to the shared `labels` prop. */
  x?: string
}

export interface ChartSeries {
  name: string
  /** Bare numbers are accepted and normalised to points. */
  data: (number | null | ChartPoint)[]
  /** Any CSS colour. Unset series cycle through the palette. */
  color?: string
  /** Draw this series as a dashed line (targets, budgets, forecasts). */
  dashed?: boolean
  /**
   * Which y-axis this series is measured against. A series in different units
   * or of a wildly different magnitude (errors beside requests, a rate beside a
   * count) flattens against a shared axis; putting it on `"right"` gives it its
   * own scale and its own ticks.
   */
  axis?: "left" | "right"
}

export type ChartAxis = "left" | "right"

export interface NormalSeries {
  name: string
  color: string
  dashed: boolean
  axis: ChartAxis
  values: (number | null)[]
}

export interface Box {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
}

/** Plot area inside the padding — where marks may actually be drawn. */
export const plotWidth = (b: Box): number => Math.max(0, b.width - b.left - b.right)
export const plotHeight = (b: Box): number => Math.max(0, b.height - b.top - b.bottom)

/** Series colours cycle through the theme's semantic palette. */
export const CHART_PALETTE = [
  "var(--color-brand)",
  "var(--color-action)",
  "var(--color-accent)",
  "var(--color-danger)",
  "var(--color-muted-strong)",
]

const valueOf = (d: number | null | ChartPoint): number | null =>
  d == null ? null : typeof d === "number" ? d : d.y

export const normalise = (series: ChartSeries[]): NormalSeries[] =>
  series.map((s, i) => ({
    name: s.name,
    color: s.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
    dashed: s.dashed ?? false,
    axis: s.axis ?? "left",
    values: s.data.map(valueOf),
  }))

/** Point labels win over the shared axis labels; index is the last resort. */
export const resolveLabels = (
  series: ChartSeries[],
  labels: string[] | undefined,
  count: number,
): string[] =>
  Array.from({ length: count }, (_, i) => {
    for (const s of series) {
      const d = s.data[i]
      if (d && typeof d !== "number" && d.x != null) return d.x
    }
    return labels?.[i] ?? String(i + 1)
  })

/** Longest series wins; shorter ones simply stop early. */
export const pointCount = (series: NormalSeries[]): number =>
  series.reduce((n, s) => Math.max(n, s.values.length), 0)

/**
 * "Nice" axis bounds: round the extent out to a human step (1/2/5 × 10ⁿ) so
 * ticks land on readable numbers instead of 0.37, 1.24, 2.11.
 */
export const niceScale = (
  min: number,
  max: number,
  ticks: number,
): { min: number; max: number; step: number } => {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, step: 1 }
  if (min === max) {
    // A flat series still needs a band to sit in.
    const pad = Math.abs(min) || 1
    min -= pad / 2
    max += pad / 2
  }
  const raw = (max - min) / Math.max(1, ticks)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step }
}

export const axisTicks = (min: number, max: number, step: number): number[] => {
  const out: number[] = []
  // Guard against a degenerate step producing an unbounded loop.
  if (!(step > 0)) return [min, max]
  for (let v = min; v <= max + step / 2; v += step) out.push(Number(v.toFixed(10)))
  return out
}

/** Extent across every visible series, with zero pulled in when asked. */
export const extent = (
  series: NormalSeries[],
  includeZero: boolean,
): { min: number; max: number } => {
  let min = Infinity
  let max = -Infinity
  for (const s of series)
    for (const v of s.values) {
      if (v == null) continue
      if (v < min) min = v
      if (v > max) max = v
    }
  if (min === Infinity) return { min: 0, max: 1 }
  if (includeZero) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  return { min, max }
}

/** x pixel for point i. Bars sit at band centres, lines span edge to edge. */
export const xAt = (i: number, count: number, box: Box, banded: boolean): number => {
  const w = plotWidth(box)
  if (banded) return box.left + (w / Math.max(1, count)) * (i + 0.5)
  if (count <= 1) return box.left + w / 2
  return box.left + (w / (count - 1)) * i
}

export const yAt = (v: number, min: number, max: number, box: Box): number => {
  const h = plotHeight(box)
  const span = max - min || 1
  return box.top + h - ((v - min) / span) * h
}

interface Scale {
  min: number
  max: number
  box: Box
  count: number
  banded: boolean
}

/** Contiguous runs of non-null points — one run per unbroken stretch. */
const runs = (values: (number | null)[], count: number): number[][] => {
  const out: number[][] = []
  let cur: number[] = []
  for (let i = 0; i < count; i++) {
    if (values[i] == null) {
      if (cur.length) out.push(cur)
      cur = []
    } else cur.push(i)
  }
  if (cur.length) out.push(cur)
  return out
}

/**
 * Catmull-Rom → cubic Bézier, clamped so a smoothed curve can never overshoot
 * past its own data points (which would draw, say, a negative request count).
 */
const smoothSegment = (pts: { x: number; y: number }[], tension: number): string => {
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    let c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    let c2y = p2.y - ((p3.y - p1.y) / 6) * tension
    const lo = Math.min(p1.y, p2.y)
    const hi = Math.max(p1.y, p2.y)
    c1y = Math.min(hi, Math.max(lo, c1y))
    c2y = Math.min(hi, Math.max(lo, c2y))
    d += `C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

const segmentPath = (
  idx: number[],
  values: (number | null)[],
  s: Scale,
  smooth: number,
): string => {
  const pts = idx.map((i) => ({
    x: xAt(i, s.count, s.box, s.banded),
    y: yAt(values[i] as number, s.min, s.max, s.box),
  }))
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}L${pts[0].x},${pts[0].y}`
  if (smooth > 0) return smoothSegment(pts, smooth)
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join("")
}

export const linePath = (
  values: (number | null)[],
  s: Scale,
  smooth: number,
): string =>
  runs(values, s.count)
    .map((idx) => segmentPath(idx, values, s, smooth))
    .join(" ")

/** The line closed down to the baseline — one filled shape per unbroken run. */
export const areaPath = (
  values: (number | null)[],
  s: Scale,
  smooth: number,
): string => {
  const base = yAt(Math.max(s.min, Math.min(s.max, 0)), s.min, s.max, s.box)
  return runs(values, s.count)
    .map((idx) => {
      const d = segmentPath(idx, values, s, smooth)
      const x0 = xAt(idx[0], s.count, s.box, s.banded)
      const x1 = xAt(idx[idx.length - 1], s.count, s.box, s.banded)
      return `${d}L${x1},${base}L${x0},${base}Z`
    })
    .join(" ")
}

/** Nearest point index for a pixel x — what the hover crosshair snaps to. */
export const nearestIndex = (px: number, s: Scale): number => {
  if (s.count === 0) return -1
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < s.count; i++) {
    const d = Math.abs(xAt(i, s.count, s.box, s.banded) - px)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/**
 * A bar as a path, rounded only on the corners named. A stack is one shape cut
 * into segments: rounding every segment would bevel the internal joins and read
 * as separate tiles rather than as one bar, so only the outermost segment of a
 * stack rounds, and only on the end it actually terminates.
 *
 * `r` is clamped to half the box so a short segment degrades to a slab instead
 * of inverting its own corners.
 */
export const barPath = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  round: { top: boolean; bottom: boolean },
): string => {
  const k = Math.max(0, Math.min(r, w / 2, h / 2))
  const rt = round.top ? k : 0
  const rb = round.bottom ? k : 0
  return [
    `M${x},${y + rt}`,
    rt ? `A${rt},${rt} 0 0 1 ${x + rt},${y}` : `L${x},${y}`,
    `L${x + w - rt},${y}`,
    rt ? `A${rt},${rt} 0 0 1 ${x + w},${y + rt}` : "",
    `L${x + w},${y + h - rb}`,
    rb ? `A${rb},${rb} 0 0 1 ${x + w - rb},${y + h}` : `L${x + w},${y + h}`,
    `L${x + rb},${y + h}`,
    rb ? `A${rb},${rb} 0 0 1 ${x},${y + h - rb}` : "",
    "Z",
  ]
    .filter(Boolean)
    .join("")
}

// ── shares of a whole (pie / donut) ────────────

export interface PieSlice {
  label: string
  value: number
  /** Any CSS colour. Unset slices cycle through the palette. */
  color?: string
}

export interface ResolvedSlice {
  label: string
  value: number
  color: string
  /** 0–1 of the total. */
  fraction: number
  /** True for the synthesised remainder slice. */
  isOther: boolean
  /** How many input slices this one stands for (1, or N when collapsed). */
  count: number
}

/**
 * Fold an arbitrary number of slices down to something a circle can actually
 * show, WITHOUT dropping data.
 *
 * A pie is only legible while its slices are distinguishable by angle; past a
 * handful they become slivers no one can compare or click. But a shared kit
 * can't know how many categories a caller has, so refusing to draw twenty is
 * not an option either. So: keep the largest `max - 1` and sum the rest into a
 * single "Other" slice that keeps its own total, its own share, and a count of
 * what it stands for — the tail stays visible and addressable instead of being
 * silently truncated.
 *
 * Negative values are dropped: a share of a whole has no meaning below zero,
 * and letting one in makes every other slice's fraction wrong.
 */
export const resolveSlices = (
  slices: PieSlice[],
  max: number | undefined,
  otherLabel: string,
  /**
   * Keep the caller's ordering for the slices that survive. Ranking decides
   * WHICH slices are kept; it needn't decide the order they're shown in, and a
   * caller that ordered its data deliberately ("Free" last, states worst-first)
   * would see that shuffled for no reason. "Other" always sorts last.
   */
  preserveOrder = true,
): { slices: ResolvedSlice[]; total: number } => {
  const usable = slices.filter((s) => Number.isFinite(s.value) && s.value > 0)
  const total = usable.reduce((sum, s) => sum + s.value, 0)
  if (!total) return { slices: [], total: 0 }

  // Colours are assigned from the ORIGINAL order, so a slice keeps its colour
  // whether or not the tail happens to be collapsed on this render.
  const coloured = usable.map((s) => ({
    ...s,
    color: s.color ?? CHART_PALETTE[slices.indexOf(s) % CHART_PALETTE.length],
  }))

  const ranked = [...coloured].sort((a, b) => b.value - a.value)
  const collapse = max != null && max > 0 && ranked.length > max

  const keptRanked = collapse ? ranked.slice(0, max - 1) : ranked
  const tail = collapse ? ranked.slice(max - 1) : []

  const kept = preserveOrder
    ? coloured.filter((s) => keptRanked.includes(s))
    : keptRanked

  const out: ResolvedSlice[] = kept.map((s) => ({
    label: s.label,
    value: s.value,
    color: s.color,
    fraction: s.value / total,
    isOther: false,
    count: 1,
  }))

  if (tail.length) {
    const value = tail.reduce((sum, s) => sum + s.value, 0)
    out.push({
      label: otherLabel,
      value,
      color: "var(--color-line-strong)",
      fraction: value / total,
      isOther: true,
      count: tail.length,
    })
  }

  return { slices: out, total }
}

/**
 * One slice as a path. `inner > 0` makes it a donut segment (an annulus) rather
 * than a wedge from the centre.
 *
 * A slice covering the whole circle is drawn as two half-arcs: a single arc
 * whose start and end coincide is a zero-length path, so "100% of one category"
 * would render as nothing at all.
 */
export const arcPath = (
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startAngle: number,
  endAngle: number,
  /** Corner radius in px, clamped to what the slice can actually carry. */
  corner = 0,
): string => {
  const full = endAngle - startAngle >= Math.PI * 2 - 1e-9
  if (full) {
    // One arc whose ends coincide has zero length; draw the ring as two halves.
    // A full ring has no corners to round, so `corner` is deliberately dropped.
    const mid = startAngle + Math.PI
    return (
      arcPath(cx, cy, outer, inner, startAngle, mid) +
      arcPath(cx, cy, outer, inner, mid, startAngle + Math.PI * 2)
    )
  }

  const at = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  const large = endAngle - startAngle > Math.PI ? 1 : 0

  if (corner <= 0) {
    if (inner <= 0) {
      return [
        `M${cx},${cy}`,
        `L${at(outer, startAngle)}`,
        `A${outer},${outer} 0 ${large} 1 ${at(outer, endAngle)}`,
        "Z",
      ].join("")
    }
    return [
      `M${at(outer, startAngle)}`,
      `A${outer},${outer} 0 ${large} 1 ${at(outer, endAngle)}`,
      `L${at(inner, endAngle)}`,
      `A${inner},${inner} 0 ${large} 0 ${at(inner, startAngle)}`,
      "Z",
    ].join("")
  }

  /*
   * Rounded corners. Each corner is a quarter-turn joining the radial edge to
   * the circular one, so the radius has to be clamped twice over: by the band's
   * thickness (a corner can't be deeper than the slice is wide) and by the
   * slice's own sweep at each radius (a thin sliver has no room to curve, and
   * an unclamped radius would make it fold through itself).
   *
   * The angular cost of a corner differs on the two edges — the same px is a
   * bigger angle on the inner circle than on the outer one — so the two are
   * computed separately rather than sharing one offset.
   */
  const band = inner > 0 ? outer - inner : outer
  const sweep = endAngle - startAngle
  const rOuter = Math.min(corner, band / 2, (sweep * outer) / 4)
  const rInner = inner > 0 ? Math.min(corner, band / 2, (sweep * inner) / 4) : 0

  const aOuter = rOuter / outer
  const aInner = inner > 0 ? rInner / inner : 0

  // Radial inset: where the corner arc leaves the straight edge.
  const outerIn = outer - rOuter
  const innerOut = inner + rInner

  const oStart = startAngle + aOuter
  const oEnd = endAngle - aOuter
  const iStart = startAngle + aInner
  const iEnd = endAngle - aInner

  if (inner <= 0) {
    /*
     * A wedge. Rounding only the outer end leaves a needle at the centre, and
     * the slice reads as a teardrop rather than a cut of a circle — so the tip
     * is blunted too, by the same radius. The blunt is a small arc across the
     * point, not a hole: neighbouring slices still meet at the middle.
     */
    const tip = Math.min(corner, (sweep * outer) / 6)
    if (tip <= 0.25) {
      return [
        `M${cx},${cy}`,
        `L${at(outerIn, startAngle)}`,
        `A${rOuter},${rOuter} 0 0 1 ${at(outer, oStart)}`,
        `A${outer},${outer} 0 ${oEnd - oStart > Math.PI ? 1 : 0} 1 ${at(outer, oEnd)}`,
        `A${rOuter},${rOuter} 0 0 1 ${at(outerIn, endAngle)}`,
        "Z",
      ].join("")
    }
    return [
      `M${at(tip, startAngle)}`,
      `L${at(outerIn, startAngle)}`,
      `A${rOuter},${rOuter} 0 0 1 ${at(outer, oStart)}`,
      `A${outer},${outer} 0 ${oEnd - oStart > Math.PI ? 1 : 0} 1 ${at(outer, oEnd)}`,
      `A${rOuter},${rOuter} 0 0 1 ${at(outerIn, endAngle)}`,
      `L${at(tip, endAngle)}`,
      `A${tip},${tip} 0 0 0 ${at(tip, startAngle)}`,
      "Z",
    ].join("")
  }

  return [
    `M${at(outerIn, startAngle)}`,
    `A${rOuter},${rOuter} 0 0 1 ${at(outer, oStart)}`,
    `A${outer},${outer} 0 ${oEnd - oStart > Math.PI ? 1 : 0} 1 ${at(outer, oEnd)}`,
    `A${rOuter},${rOuter} 0 0 1 ${at(outerIn, endAngle)}`,
    `L${at(innerOut, endAngle)}`,
    `A${rInner},${rInner} 0 0 1 ${at(inner, iEnd)}`,
    `A${inner},${inner} 0 ${iEnd - iStart > Math.PI ? 1 : 0} 0 ${at(inner, iStart)}`,
    `A${rInner},${rInner} 0 0 1 ${at(innerOut, startAngle)}`,
    "Z",
  ].join("")
}

export interface CalloutLabel {
  index: number
  /** Which side of the circle the label sits on. */
  side: "left" | "right"
  /** Elbow polyline: leader out of the slice, a bend, then a run to the text. */
  points: string
  /** Where the text is anchored. */
  x: number
  y: number
}

/**
 * Lay out callout labels around a circle: a leader line leaves each slice along
 * its own bisector, bends, and runs horizontally to text stacked down the side.
 *
 * The whole difficulty is collision. Slices cluster — twenty versions of a
 * server jar are mostly slivers packed into one arc — so labels placed at their
 * natural angles would land on top of each other. Each side is therefore
 * relaxed independently: labels keep their order around the circle, then get
 * pushed apart to a minimum spacing and shifted back inside the box. That's why
 * a leader can end well away from its slice's angle and still be unambiguous —
 * the line, not the position, is what identifies it.
 */
export const calloutLabels = (
  angles: { index: number; mid: number }[],
  cx: number,
  cy: number,
  radius: number,
  /** How far past the radius the elbow sits. */
  elbow: number,
  /** Horizontal run from the elbow to the text. */
  run: number,
  /** Minimum vertical gap between two labels on the same side. */
  spacing: number,
  height: number,
): CalloutLabel[] => {
  const sides: Record<"left" | "right", { index: number; mid: number; y: number }[]> = {
    left: [],
    right: [],
  }

  /*
   * Side assignment follows GEOMETRY: a slice on the right half is named on the
   * right. A label opposite its own slice is confusing — the leader has to cross
   * the circle to reach it — so that only happens when the natural side genuinely
   * cannot hold another row.
   *
   * The earlier version capped each side at half the labels regardless of the
   * space available, which sent a label across for no reason at all: six labels
   * split 3/3 still tripped the cap, and the one slice that lost the tie had its
   * name printed on the wrong side of the chart.
   */
  const fits = Math.max(1, Math.floor(height / spacing))
  const ordered = [...angles].sort(
    (p, q) => Math.abs(Math.cos(q.mid)) - Math.abs(Math.cos(p.mid)),
  )

  for (const a of ordered) {
    const natural = Math.cos(a.mid) >= 0 ? "right" : "left"
    const other = natural === "right" ? "left" : "right"
    // Only spill over when this side is actually full and the other has room.
    const side =
      sides[natural].length >= fits && sides[other].length < fits ? other : natural
    sides[side].push({ ...a, y: cy + Math.sin(a.mid) * (radius + elbow) })
  }

  const out: CalloutLabel[] = []

  for (const side of ["left", "right"] as const) {
    /*
     * Ordered the way the eye reads the column: down the right of the circle
     * (12 o'clock → 6) and back up the left (6 → 12). Sorting by the raw y of
     * each bisector looks equivalent but isn't — a sliver moved to the lighter
     * side to balance the columns lands out of sequence, and its leader then has
     * to cross its neighbours' to reach its row.
     */
    const rank = (mid: number) => {
      // Normalise to [-π/2, 3π/2) so the run starts at twelve o'clock.
      let a = mid
      while (a < -Math.PI / 2) a += Math.PI * 2
      while (a >= (3 * Math.PI) / 2) a -= Math.PI * 2
      // On the left the circle is walked upward, so its order is reversed.
      return side === "right" ? a : -a
    }
    const list = sides[side].sort((p, q) => rank(p.mid) - rank(q.mid))

    /*
     * Resolve collisions by NUDGING, not by stacking.
     *
     * Laying the column out with a running cursor (`y = max(y, prev + spacing)`)
     * is the obvious approach and it is what made the leaders cut across the
     * pie: one crowded label at the top pushes every label below it down by a
     * full row, so labels end up nowhere near the slice they name and their
     * lines have to cross the circle to get back.
     *
     * Instead each pair that overlaps is pushed apart by half the shortfall
     * EACH, repeatedly, so a label only ever drifts as far from its own bisector
     * as its neighbours actually require. This is the standard relaxation used
     * for outside pie labels; a handful of passes is plenty at these counts.
     */
    const top = spacing / 2
    const bottom = height - spacing / 2

    for (let pass = 0; pass < 24; pass++) {
      let moved = false
      for (let i = 0; i < list.length - 1; i++) {
        const gap = list[i + 1].y - list[i].y
        if (gap >= spacing) continue
        const push = (spacing - gap) / 2
        list[i].y -= push
        list[i + 1].y += push
        moved = true
      }
      // Keep the run inside the box; the next pass redistributes any squeeze.
      list[0].y = Math.max(list[0].y, top)
      list[list.length - 1].y = Math.min(list[list.length - 1].y, bottom)
      if (!moved) break
    }

    // Final guarantee of both edges and of monotonic order, in case the clamps
    // above fought each other on a column that genuinely cannot fit.
    let cursor = top
    for (const item of list) {
      item.y = Math.max(item.y, cursor)
      cursor = item.y + spacing
    }
    let limit = bottom
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].y = Math.min(list[i].y, limit)
      limit = list[i].y - spacing
    }

    list.forEach((item, rank) => {
      const dir = side === "right" ? 1 : -1
      /*
       * Three points, not two, and the first leg is strictly RADIAL — straight
       * out along the bisector to just past the rim.
       *
       * Going directly from the rim to the (relaxed) label height draws a chord
       * across the circle whenever a label has been pushed far from its slice,
       * and the leaders for a cluster of slivers then cut visibly through the
       * neighbouring wedges. Leaving radially first means every line clears the
       * pie before it turns.
       */
      /*
       * Each leader in a side's stack gets a slightly longer radial leg than the
       * one before it, so a cluster of slivers — whose bisectors are almost the
       * same angle — turns at staggered radii instead of all bending at once
       * into a single overlapping bundle.
       */
      const stagger = elbow + rank * 1.6
      const startX = cx + Math.cos(item.mid) * radius
      const startY = cy + Math.sin(item.mid) * radius
      const outX = cx + Math.cos(item.mid) * (radius + stagger)
      const outY = cy + Math.sin(item.mid) * (radius + stagger)
      const endX = cx + dir * (radius + elbow + run)
      out.push({
        index: item.index,
        side,
        points: `${startX},${startY} ${outX},${outY} ${endX},${item.y}`,
        x: endX + dir * 4,
        y: item.y,
      })
    })
  }

  return out
}

/** Compact default tick formatting: 1.2k, 3.4M — never 1200.0000001. */
export const formatTick = (v: number): string => {
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${Number((v / 1e9).toFixed(1))}B`
  if (abs >= 1e6) return `${Number((v / 1e6).toFixed(1))}M`
  if (abs >= 1e3) return `${Number((v / 1e3).toFixed(1))}k`
  return String(Number(v.toFixed(2)))
}
