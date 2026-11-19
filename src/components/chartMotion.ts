import { computed, type Ref } from "vue"
import { easeTravel } from "../composables/easing"
import { lerp, mixValues, resample, useTween } from "../composables/useTween"
import type { NormalSeries } from "./chart"

/*
 * LpChart's motion: the clock every eased value of the chart shares, how
 * present each series is while it is hidden or shown, and the readings as
 * drawn, travelling from their last values to the new ones.
 */

/** A series as drawn: its readings partway, keyed by name and how far it has arrived. */
export type ChartDrawnSeries<S> = S & {
  key: string
  /** 0 → 1 for a series arriving, 1 → 0 for one leaving; 1 otherwise. */
  enter: number
}

export interface ChartMotionOptions<S extends NormalSeries & { id: string }> {
  animate: () => boolean
  /** A zoom or pan in progress, which lands at once. */
  moving: () => boolean
  /** The plot is drawn and has been seen, so a change can morph. */
  onScreen: () => boolean
  allSeries: Ref<S[]>
  hidden: Ref<ReadonlySet<string>>
  /** Points in the window: where a leaving curve is laid while it collapses. */
  count: Ref<number>
}

/* One duration for the series leaving and the axis it was measured against, so
   the two read as a single change rather than two. 260ms sits in the 250-400ms
   band a legend toggle wants: long enough to follow, short enough to feel like
   a control responding. */
const SETTLE_MS = 260

export function useChartMotion<S extends NormalSeries & { id: string }>(options: ChartMotionOptions<S>) {
  const { allSeries, hidden, count } = options

  /*
   * How present each series is, 1 to 0, driven per frame rather than by CSS.
   *
   * A curve leaves by collapsing onto the baseline: every point travels to zero
   * together and the shape flattens into the axis before it fades. Moving the
   * whole layer down instead slides it past the axis as a picture of a chart —
   * the marks keep their shape on the way out, which reads as the plot being
   * dragged away rather than the readings going to nothing.
   *
   * It has to be JS: the collapse is a new `d` on every frame, and no browser
   * interpolates a path's `d` between two arbitrary shapes.
   */

  /*
   * Every value the chart moves — presence, both axes, the gutters, the readings
   * themselves — travels on this one clock, so a change reads as one gesture
   * rather than as several things settling at their own pace. The curve is
   * `--ease-travel`'s: an ease-out covers most of a big rescale (800 down to 40)
   * in its first frames and then creeps, which looks like a snap with a slow
   * tail rather than a scale moving.
   */
  const settle = {
    duration: SETTLE_MS,
    ease: easeTravel,
    enabled: () => options.animate() && !options.moving(),
  }

  /*
   * A series with no entry is fully present, NOT "0 because it is hidden".
   *
   * Falling back to the hidden flag raced the animation it was meant to start:
   * the computed that draws the curve and the watcher that animates it both run
   * on the same tick, and whichever order they land in, the fallback had already
   * reported the end state — so a series being hidden jumped to the floor while
   * one being shown eased up from it.
   */
  const presenceTargets = computed(
    () => new Map(allSeries.value.map((s) => [s.id, hidden.value.has(s.id) ? 0 : 1])),
  )

  const presence = useTween(
    () => presenceTargets.value,
    (from, to, t) => new Map([...to].map(([id, v]) => [id, lerp(from.get(id) ?? v, v, t)])),
    {
      ...settle,
      // `hidden` is replaced wholesale on every toggle, and the map is rebuilt on
      // every data change; only a different set of levels is a change worth moving.
      equal: (a, b) => a.size === b.size && [...b].every(([id, v]) => a.get(id) === v),
    },
  )

  const presenceOf = (id: string) => presence.value.get(id) ?? 1

  /*
   * The readings as DRAWN: each series travelling from its last values to its
   * new ones, so a refresh moves the curve rather than replacing it.
   *
   * Matched by name, not by `id`: the id carries the series' position, and a
   * series dropped from the front would shift every other one onto a new id and
   * make them all look new. A series that arrives grows up out of the baseline;
   * one that is gone stays in the drawing, collapsing onto it, until the move
   * ends. The axis is on the same clock (`settle`), so each frame is a
   * consistent picture: readings partway, on a scale partway.
   *
   * Only what is drawn moves. Hover, the tooltip's figures, the legend and the
   * exports read the data as it now is.
   */
  type DrawnSeries = ChartDrawnSeries<S>

  const targetDrawn = computed<DrawnSeries[]>(() => {
    const seen = new Map<string, number>()
    return allSeries.value.map((s) => {
      const n = seen.get(s.name) ?? 0
      seen.set(s.name, n + 1)
      return { ...s, key: `${s.name}#${n}`, enter: 1 }
    })
  })

  const mixDrawn = (from: DrawnSeries[], to: DrawnSeries[], t: number): DrawnSeries[] => {
    const before = new Map(from.map((s) => [s.key, s]))
    const after = new Set(to.map((s) => s.key))
    const out = to.map((s) => {
      const was = before.get(s.key)
      return was
        ? { ...s, values: mixValues(was.values, s.values, t), enter: lerp(was.enter, 1, t) }
        : { ...s, enter: t }
    })
    // Laid on the new x positions too, or a leaving curve drawn with the old
    // point count would stop short of (or run past) the plot while it collapses.
    const points = count.value
    for (const s of from)
      if (!after.has(s.key))
        out.push({ ...s, values: resample(s.values, points), enter: s.enter * (1 - t) })
    return out
  }

  const drawnSeries = useTween(() => targetDrawn.value, mixDrawn, {
    ...settle,
    /*
     * Only a plot already on screen morphs. While the wipe is still to come, or
     * while the placeholder stands in (no svg yet), the data that follows draws
     * itself in on its own entrance — a morph from readings nobody saw would
     * only muddy it.
     */
    enabled: () => options.animate() && !options.moving() && options.onScreen(),
  })

  /** The drawn copy of each current series, by id, for marks built from `visible`. */
  const drawnById = computed(() => {
    const out = new Map<string, DrawnSeries>()
    for (const s of drawnSeries.value) if (!out.has(s.id)) out.set(s.id, s)
    return out
  })

  return { settle, presenceOf, drawnSeries, drawnById }
}
