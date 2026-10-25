/*
 * Shapes for a chart that is still loading: bars of uneven height and a gentle
 * wave through them, drawn in the plot area the real marks will occupy.
 *
 * Fixed rather than random. A placeholder that reshuffles on every render (a
 * resize, a theme switch) reads as data arriving and changing, which is the one
 * thing a placeholder must not suggest. Uneven rather than flat, because a row
 * of identical bars reads as a striped background, not as a chart.
 */

const PATTERN = [0.42, 0.58, 0.5, 0.72, 0.64, 0.8, 0.7, 0.55, 0.66, 0.48, 0.6, 0.76]

/** Bar heights for a loading chart, as fractions of the plot height (0–1). */
export function skeletonHeights(count: number): number[] {
  const n = Math.max(1, Math.floor(count))
  return Array.from({ length: n }, (_, i) => PATTERN[i % PATTERN.length])
}

/**
 * Made-up values for a tour sample (useSample): the same uneven pattern on a
 * 0–100 scale, shifted per series so two lines do not lie on top of each other.
 * Fixed for the same reason as the placeholder: a sample that changed between
 * renders would read as live data.
 */
export function sampleValues(count: number, series = 0): number[] {
  const n = Math.max(2, Math.floor(count))
  const scale = 100 - series * 30
  return Array.from({ length: n }, (_, i) => Math.round(PATTERN[(i + series * 5) % PATTERN.length] * scale))
}

/**
 * A smooth line through those heights, in a 100 × 100 box with y pointing down
 * (the SVG convention), each point centred in its slot. Scaled to the plot with
 * `preserveAspectRatio="none"`, so it needs no measuring.
 */
export function skeletonWave(heights: number[]): string {
  if (!heights.length) return ""
  const step = 100 / heights.length
  const pts = heights.map((h, i) => [step * (i + 0.5), 100 - h * 100] as const)
  let d = `M0 ${pts[0][1]} L${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mid = (x0 + x1) / 2
    d += ` C${mid} ${y0} ${mid} ${y1} ${x1} ${y1}`
  }
  const last = pts[pts.length - 1]
  return `${d} L100 ${last[1]}`
}
