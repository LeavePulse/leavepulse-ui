import { onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter, type ShallowRef } from "vue"
import { durationToken, prefersReducedMotion, tokenEase } from "./easing"

/*
 * A value that travels to its new state instead of jumping there.
 *
 * Charts draw from data, and data changes wholesale: a poll returns new numbers,
 * a filter drops a category. Rendering straight from it redraws the shape on
 * the next frame, and the reader sees a different picture rather than the same
 * picture changing — which is the one thing a chart refreshing in place has to
 * convey. No browser interpolates a path's `d` between two arbitrary shapes, so
 * the DATA is what moves: this holds a displayed copy and steps it toward the
 * source every frame, and the component draws from the copy.
 *
 * The caller supplies the mix, because only it knows what "halfway" means for
 * its data — a pie matches slices by label and lets new ones open from nothing,
 * a line resamples to a new point count. The mix is handed whatever is
 * DISPLAYED as its starting point, not the previous target, so a change that
 * lands mid-flight carries on from where the shape actually is instead of
 * snapping back to restart.
 *
 * The first value is shown as is: arrival belongs to the component's own
 * entrance (useReveal), and this only animates what comes after it.
 */

export interface TweenOptions<T> {
  /** Travel time in ms. Defaults to `--duration-medium`, read when a tween starts. */
  duration?: MaybeRefOrGetter<number | undefined>
  /** Defaults to the curve of `--ease-emphasized`. */
  ease?: (t: number) => number
  /**
   * False makes a change land at once. Read at the moment of the change, so a
   * component can jump while its content is hidden or not yet revealed and
   * tween once it is on screen.
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>
  /**
   * Same content, new object: skip. A source rebuilt by a computed on every
   * unrelated change would otherwise spend a whole duration of frames tweening
   * a value into itself.
   */
  equal?: (a: T, b: T) => boolean
}

export function useTween<T>(
  source: () => T,
  mix: (from: T, to: T, t: number) => T,
  options: TweenOptions<T> = {},
): Readonly<ShallowRef<T>> {
  const shown = shallowRef(source())
  let target = shown.value
  let frame = 0

  const stop = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  watch(source, (to) => {
    if (options.equal?.(target, to)) return
    target = to
    const ms = toValue(options.duration) ?? durationToken("duration-medium")
    if (
      toValue(options.enabled) === false ||
      ms <= 0 ||
      prefersReducedMotion() ||
      typeof requestAnimationFrame === "undefined"
    ) {
      stop()
      shown.value = to
      return
    }

    const from = shown.value
    const ease = options.ease ?? tokenEase("ease-emphasized")
    const started = performance.now()
    stop()
    const step = (now: number) => {
      // rAF stamps the frame's start, which can precede the watcher by a few ms.
      const t = Math.min(1, Math.max(0, (now - started) / ms))
      // The last frame is the target itself, not a mix that rounds near it, so
      // whatever the mix carried for the journey (ghosts, resampled points)
      // is gone once it lands.
      shown.value = t < 1 ? mix(from, to, ease(t)) : to
      frame = t < 1 ? requestAnimationFrame(step) : 0
    }
    frame = requestAnimationFrame(step)
  })

  onScopeDispose(stop)

  return shown
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * A colour between two, as CSS — any two, `var()` tokens included, since the
 * browser resolves both ends. Mixed in oklab so a hue change passes through
 * believable colours instead of the grey a straight RGB blend dips into.
 */
export const mixColor = (from: string, to: string, t: number): string => {
  if (from === to || t >= 1) return to
  if (t <= 0) return from
  return `color-mix(in oklab, ${from}, ${to} ${(t * 100).toFixed(1)}%)`
}

/**
 * A series stretched or squeezed to `count` points along its own length.
 *
 * Morphing needs a point for every point: a line going from 12 readings to 30
 * has nothing to move its 13th to 30th points FROM. Reading the old line at the
 * new points' relative positions gives them a start on the shape as it was, so
 * the morph changes heights rather than also redrawing the curve's outline.
 * A position next to a gap takes the nearer reading, and is a gap only when
 * both neighbours are.
 */
export const resample = (values: (number | null)[], count: number): (number | null)[] => {
  const n = values.length
  if (n === count) return values
  if (!n) return new Array<number | null>(count).fill(null)
  return Array.from({ length: count }, (_, i) => {
    const pos = count <= 1 ? 0 : (i * (n - 1)) / (count - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(n - 1, lo + 1)
    const a = values[lo]
    const b = values[hi]
    const f = pos - lo
    if (a == null) return f >= 0.5 ? b : null
    if (b == null) return f < 0.5 ? a : null
    return lerp(a, b, f)
  })
}

/**
 * One series of readings partway to another. A point that is a gap at either
 * end takes the target's value: there is no height to travel from or to.
 */
export const mixValues = (
  from: (number | null)[],
  to: (number | null)[],
  t: number,
): (number | null)[] => {
  const start = resample(from, to.length)
  return to.map((v, i) => {
    const a = start[i]
    return v == null || a == null ? v : lerp(a, v, t)
  })
}
