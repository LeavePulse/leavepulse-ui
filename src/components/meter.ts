/*
 * The arithmetic shared by the kit's meters: LpGauge, LpQuota, LpStatus and
 * LpActivityLine. A reading against a range, the tone it earns, and the colour
 * that tone paints in. Kept in one place so a gauge and a quota showing the same
 * disk agree on when it turns amber, instead of each picking its own breakpoints.
 * The colours themselves are tone.ts's: a meter tone is one of its aliases.
 */
import { TONE_ALIASES, TONES, type ToneLook } from "./tone"

/**
 * The semantic tones a meter speaks in. They name what the reading MEANS, not
 * which colour it is: a theme decides the colour, and `ok` stays the "fine"
 * colour whatever that happens to be.
 */
export type MeterTone = "ok" | "warning" | "danger" | "brand" | "neutral"

/** One step of a scale: from `at` (in the meter's own units) upward, `tone`. */
export interface MeterThreshold {
  at: number
  tone: MeterTone
}

const METER_TONES: readonly MeterTone[] = ["ok", "warning", "danger", "brand", "neutral"]
const byMeterTone = (pick: (look: ToneLook) => string) =>
  Object.fromEntries(METER_TONES.map((t) => [t, pick(TONES[TONE_ALIASES[t]])])) as Record<MeterTone, string>

/** The solid colour of a tone, as a CSS value a style or an SVG stroke takes. */
export const TONE_COLOR: Record<MeterTone, string> = byMeterTone((look) => look.color)

/** The tinted background of a tone, for pills and highlighted rows. */
export const TONE_SOFT: Record<MeterTone, string> = byMeterTone((look) => look.soft)

/**
 * Where `value` sits between `min` and `max`, as 0–1. An empty or inverted
 * range (no limit known yet) reads as empty rather than as NaN or Infinity,
 * which would otherwise reach an SVG attribute and draw nothing at all.
 */
export function meterFraction(value: number, min: number, max: number): number {
  const span = max - min
  if (!(span > 0) || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, (value - min) / span))
}

/**
 * The capacity scale every finite resource is read against: comfortable well
 * past half, uncomfortable in the last fifth, urgent in the last tenth. The
 * same breakpoints LpProgress's `auto` tone uses, so the two never disagree
 * about one disk.
 */
export function capacityThresholds(
  min: number,
  max: number,
  warnAt = 0.8,
  dangerAt = 0.9,
): MeterThreshold[] {
  const span = max - min
  return [
    { at: min + span * warnAt, tone: "warning" },
    { at: min + span * dangerAt, tone: "danger" },
  ]
}

/**
 * The tone a reading earns on a scale. Thresholds are steps, not bands: each
 * one holds from its `at` until the next, and below the first the reading is
 * `base`. Sorted here, so a caller can list them in whatever order reads best.
 *
 * Steps go either way, which is what lets one shape describe both "higher is
 * worse" (load: ok → warning → danger) and "higher is better" (a score:
 * danger from 0, warning from 50, ok from 80).
 */
export function toneAt(value: number, thresholds: readonly MeterThreshold[], base: MeterTone = "ok"): MeterTone {
  let tone = base
  for (const step of [...thresholds].sort((a, b) => a.at - b.at)) {
    if (value >= step.at) tone = step.tone
  }
  return tone
}

/* ── Bar (LpProgress, LpQuota) ──────────────────────────────────────────── */

/**
 * The track a bar meter fills, shared so LpProgress's bar and LpQuota's read as
 * one family. Each adds its own clipping: a progress bar clips its fill, a
 * quota lets its limit mark stand out past the track.
 */
export const METER_TRACK = "h-1.5 w-full rounded-pill bg-surface-soft"

/** The row above a bar: what is measured at the start, the reading at the end. Each sets its own size and gap. */
export const METER_HEADER = "flex items-baseline justify-between"

/* ── Arc geometry (LpGauge) ─────────────────────────────────────────────── */

/**
 * A point on a circle, with the angle in degrees clockwise from twelve
 * o'clock — the way a dial is read, so -90 is nine o'clock and 90 is three.
 */
export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

/** An SVG path along a circle from one angle to another, clockwise. */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = polar(cx, cy, r, from)
  const b = polar(cx, cy, r, to)
  const large = to - from > 180 ? 1 : 0
  const f = (n: number) => Number(n.toFixed(3))
  return `M ${f(a.x)} ${f(a.y)} A ${f(r)} ${f(r)} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`
}

/**
 * The sweep of each gauge shape, as [start, end] angles. A semicircle reads
 * left to right across the top; the full dial opens at the bottom, a 270°
 * sweep, because a closed circle has no visible start or end and that is
 * LpProgress's ring, a different thing (progress toward done, not a reading
 * within a range).
 */
export const GAUGE_SWEEP: Record<"semi" | "full", readonly [number, number]> = {
  semi: [-90, 90],
  full: [-135, 135],
}
