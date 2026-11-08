/*
 * A window onto a line (a chart's points, a video's seconds): zoomed around a
 * point that stays put, or slid along without changing its width. Shared by
 * LpChart's window and LpVideoTrim's timeline, which differ only in what they
 * round to and how they hold the result inside their bounds.
 */

/** The window zoomed by `factor` (below 1 is in) around `anchor`, a position on the line; no wider than it was asked, no narrower than `minSpan`. */
export function zoomSpan(start: number, end: number, anchor: number, factor: number, minSpan: number): { start: number; end: number } {
  const span = end - start
  const next = Math.max(minSpan, span * factor)
  const from = anchor - (anchor - start) * (next / (span || 1))
  return { start: from, end: from + next }
}

/** The window moved by `delta`, its width kept, stopped at `lo` and `hi`. */
export function shiftSpan(start: number, end: number, delta: number, lo: number, hi: number): { start: number; end: number } {
  const span = end - start
  const from = Math.max(lo, Math.min(hi - span, start + delta))
  return { start: from, end: from + span }
}
