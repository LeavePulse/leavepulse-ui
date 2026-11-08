/*
 * The arithmetic behind LpVideoTrim, kept apart from the component so the
 * rules a server will rely on (what range comes out, what a typed time means)
 * are tested without a video.
 */
import { clamp } from "../composables/clamp"
import { shiftSpan, zoomSpan } from "../composables/span"

export type TimeRange = [number, number]

/** A rectangle on the video's frame, every value a fraction of it (0..1). */
export interface FrameRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface RangeLimits {
  duration: number
  /** Shortest clip, seconds. */
  minClip: number
  /** Longest clip, seconds; Infinity for none. */
  maxClip: number
}

/* Milliseconds: finer than any frame, and what an ffmpeg -ss argument takes. */
const round = (t: number) => Math.round(t * 1000) / 1000

/**
 * A typed time, the inverse of `formatClipTime`: "75", "75.5", "1:15",
 * "75:00.5", and "1:02:03.25" for whoever types the hours. A comma reads as
 * the decimal point, as a Russian keyboard's numpad types it. Anything else,
 * a negative or a seconds field past 59 after a colon, is null.
 */
export function parseClipTime(text: string): number | null {
  const value = text.trim().replace(",", ".")
  if (!/^\d+(:\d{1,2}){0,2}(\.\d*)?$/.test(value)) return null
  const parts = value.split(":")
  let total = 0
  for (const [i, part] of parts.entries()) {
    const n = Number(part)
    if (!Number.isFinite(n)) return null
    if (i > 0 && n >= 60) return null
    total = total * 60 + n
  }
  return total
}

function limitsOf(l: RangeLimits) {
  const duration = Math.max(0, l.duration)
  const min = clamp(l.minClip, 0, duration)
  const max = Math.max(min, l.maxClip)
  return { duration, min, max }
}

/** A range that keeps every limit: inside the video, no shorter than minClip, no longer than maxClip. */
export function normalizeRange(range: TimeRange | null | undefined, limits: RangeLimits): TimeRange {
  const { duration, min, max } = limitsOf(limits)
  if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) return [0, round(Math.min(duration, max))]
  let [a, b] = range[0] <= range[1] ? range : [range[1], range[0]]
  a = clamp(a, 0, Math.max(0, duration - min))
  b = clamp(b, a + min, Math.min(duration, a + max))
  return [round(a), round(b)]
}

/**
 * One end dragged to `t`. The dragged end stops at a limit and the other end
 * stays put: a handle that pushed its partner would move the clip's other
 * edge without the person touching it.
 */
export function dragEnd(range: TimeRange, end: 0 | 1, t: number, limits: RangeLimits): TimeRange {
  const { duration, min, max } = limitsOf(limits)
  const [a, b] = range
  if (end === 0) return [round(clamp(t, Math.max(0, b - max), b - min)), b]
  return [a, round(clamp(t, a + min, Math.min(duration, a + max)))]
}

/**
 * One end set to `t` on purpose (the I or O key, a typed time). That end goes
 * where it was told, and the other follows when a limit asks for it.
 */
export function setEnd(range: TimeRange, end: 0 | 1, t: number, limits: RangeLimits): TimeRange {
  const { duration, min, max } = limitsOf(limits)
  const [a, b] = range
  if (end === 0) {
    const start = clamp(t, 0, duration - min)
    return [round(start), round(clamp(b, start + min, Math.min(duration, start + max)))]
  }
  const stop = clamp(t, min, duration)
  return [round(clamp(a, Math.max(0, stop - max), stop - min)), round(stop)]
}

export interface TimeView {
  start: number
  end: number
}

/** The view zoomed by `factor` (above 1 zooms in) around `anchor`, which stays where it is on screen. */
export function zoomView(view: TimeView, anchor: number, factor: number, duration: number, minSpan: number): TimeView {
  const span = view.end - view.start
  // No wider than the video: the shared zoom only floors the width, so cap the factor here.
  const next = zoomSpan(view.start, view.end, anchor, Math.min(1 / factor, duration / (span || 1)), Math.min(minSpan, duration))
  return shiftView(next, 0, duration)
}

/** The view moved by `delta` seconds, held inside the video. */
export function shiftView(view: TimeView, delta: number, duration: number): TimeView {
  const span = Math.min(view.end - view.start, duration)
  return shiftSpan(view.start, view.start + span, delta, 0, duration)
}

/** The view moved just enough to show `t`, with `margin` of its span to spare. */
export function revealTime(view: TimeView, t: number, duration: number, margin = 0.1): TimeView {
  const span = view.end - view.start
  const pad = span * margin
  if (t < view.start + pad) return shiftView(view, t - pad - view.start, duration)
  if (t > view.end - pad) return shiftView(view, t + pad - view.end, duration)
  return view
}

const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200]

/** Seconds between ruler marks, so that marks stand at least `minPx` apart. */
export function tickStep(span: number, width: number, minPx = 72): number {
  if (span <= 0 || width <= 0) return 1
  const perPx = span / width
  return TICK_STEPS.find((step) => step / perPx >= minPx) ?? TICK_STEPS[TICK_STEPS.length - 1]!
}

/** The ruler's marks within the view. */
export function ticks(view: TimeView, step: number): number[] {
  const out: number[] = []
  const first = Math.ceil(view.start / step - 1e-9) * step
  for (let t = first; t <= view.end + 1e-9 && out.length < 500; t += step) out.push(round(t))
  return out
}

/**
 * Where the picture sits in a box that shows it whole (object-fit: contain):
 * the region is drawn on the picture, not on the black bars around it.
 */
export function containRect(boxWidth: number, boxHeight: number, videoWidth: number, videoHeight: number) {
  if (!videoWidth || !videoHeight || !boxWidth || !boxHeight) return { x: 0, y: 0, width: boxWidth, height: boxHeight }
  const scale = Math.min(boxWidth / videoWidth, boxHeight / videoHeight)
  const width = videoWidth * scale
  const height = videoHeight * scale
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height }
}

const fix = (n: number) => Math.round(n * 10000) / 10000

/** A region held inside the frame and no smaller than `minSize` a side. */
export function clampRegion(r: FrameRegion, minSize = 0.02): FrameRegion {
  const w = clamp(r.w, minSize, 1)
  const h = clamp(r.h, minSize, 1)
  return { x: fix(clamp(r.x, 0, 1 - w)), y: fix(clamp(r.y, 0, 1 - h)), w: fix(w), h: fix(h) }
}

/** The region spanned by two corners, in either order, cut to the frame. */
export function regionBetween(ax: number, ay: number, bx: number, by: number): FrameRegion {
  const x0 = clamp(Math.min(ax, bx), 0, 1)
  const y0 = clamp(Math.min(ay, by), 0, 1)
  const x1 = clamp(Math.max(ax, bx), 0, 1)
  const y1 = clamp(Math.max(ay, by), 0, 1)
  return { x: fix(x0), y: fix(y0), w: fix(x1 - x0), h: fix(y1 - y0) }
}

export type RegionHandle = "move" | "nw" | "ne" | "sw" | "se"

/** The region after one of its handles moved by (dx, dy), fractions of the frame. */
export function adjustRegion(r: FrameRegion, handle: RegionHandle, dx: number, dy: number, minSize = 0.02): FrameRegion {
  if (handle === "move") return clampRegion({ ...r, x: r.x + dx, y: r.y + dy }, minSize)
  let x0 = r.x
  let y0 = r.y
  let x1 = r.x + r.w
  let y1 = r.y + r.h
  if (handle === "nw" || handle === "sw") x0 = clamp(x0 + dx, 0, x1 - minSize)
  else x1 = clamp(x1 + dx, x0 + minSize, 1)
  if (handle === "nw" || handle === "ne") y0 = clamp(y0 + dy, 0, y1 - minSize)
  else y1 = clamp(y1 + dy, y0 + minSize, 1)
  return { x: fix(x0), y: fix(y0), w: fix(x1 - x0), h: fix(y1 - y0) }
}

/**
 * Why the editor has no video to show, as its `error` event reports it:
 * - "load": the address did not answer (network, 404, an expired session);
 * - "decode": the file arrived but is damaged;
 * - "unsupported": a format or codec this browser cannot play (H.265 in
 *   Chromium without hardware support, ProRes anywhere).
 */
export type VideoTrimErrorCause = "load" | "decode" | "unsupported"

export function mediaErrorCause(error: MediaError | null): VideoTrimErrorCause {
  if (error?.code === 3) return "decode"
  if (error?.code === 4) return "unsupported"
  return "load"
}
