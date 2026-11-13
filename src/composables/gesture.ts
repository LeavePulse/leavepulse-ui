import { clamp } from "./clamp"
import type { Direction } from "./spatialNav"

/*
 * The arithmetic behind every gesture in the kit, kept apart from the DOM so
 * it can be tested and shared: how far a finger may drift before a press
 * becomes a drag, how fast it was moving when it let go, which way a swipe
 * went, how much an edge gives when it is pulled past, and where a flick
 * comes to rest. useGesture feeds pointer events into these; a component that
 * has to read touch events itself (a pull from the screen edge) uses them
 * directly, so both decide the same way.
 */

export interface GesturePoint {
  x: number
  y: number
}

export type GestureAxis = "x" | "y"

/** How far a touch may drift before a press stops being a tap or a hold. */
export const TOUCH_SLOP = 8
/** A mouse is steadier: a press that moves this far is a drag. */
export const MOUSE_SLOP = 4
/** Px/ms at release past which a short swipe still counts (a flick). */
export const FLICK_VELOCITY = 0.45
/** How long a finger holds still before it drags (selects, paints) rather than scrolls the page. */
export const HOLD_TO_DRAG_MS = 320
/** How long a press must stay for a long press, in ms. */
export const LONG_PRESS_MS = 500
/** Only movement this recent says how fast the pointer was going at release. */
const VELOCITY_WINDOW_MS = 100
/** A pointer that rested this long before letting go was not flung. */
const REST_MS = 90

/** The slop for a pointer type: a finger gets more room than a mouse. */
export function slopFor(pointerType: string): number {
  return pointerType === "mouse" ? MOUSE_SLOP : TOUCH_SLOP
}

export interface VelocityTracker {
  /** Record where the pointer is at `time` (ms, an event's timeStamp). */
  add: (point: GesturePoint, time: number) => void
  /** Px/ms over the last moments, zero when the pointer rested before `now`. */
  velocity: (now?: number) => GesturePoint
  reset: () => void
}

/**
 * Velocity from the samples in the last VELOCITY_WINDOW_MS rather than from
 * the last two events: a jittery final frame (two events a millisecond apart)
 * would otherwise decide how far a flick travels.
 */
export function createVelocityTracker(): VelocityTracker {
  let samples: { x: number; y: number; t: number }[] = []
  return {
    add(point, time) {
      samples.push({ x: point.x, y: point.y, t: time })
      const cut = time - VELOCITY_WINDOW_MS
      while (samples.length > 2 && samples[0]!.t < cut) samples.shift()
    },
    velocity(now) {
      if (samples.length < 2) return { x: 0, y: 0 }
      const last = samples[samples.length - 1]!
      if (now !== undefined && now - last.t > REST_MS) return { x: 0, y: 0 }
      const first = samples[0]!
      const dt = last.t - first.t
      if (dt <= 0) return { x: 0, y: 0 }
      return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
    },
    reset() {
      samples = []
    },
  }
}

/**
 * Which axis a movement has committed to, or null while it is still inside
 * the slop or too diagonal to call. `ratio` is how much the winning axis must
 * lead by: 1 takes any lead, higher waits for a clearer one.
 */
export function lockAxis(movement: GesturePoint, slop: number, ratio = 1): GestureAxis | null {
  const ax = Math.abs(movement.x)
  const ay = Math.abs(movement.y)
  if (Math.hypot(ax, ay) < slop) return null
  if (ax > ay * ratio) return "x"
  if (ay > ax * ratio) return "y"
  return null
}

export interface SwipeOptions {
  /** Distance in px that is a swipe at any speed. Default 60. */
  distance?: number
  /** Px/ms that turns a shorter move into a swipe. Default FLICK_VELOCITY. */
  velocity?: number
  /** A flick must still travel this far, so a twitch is not one. Default 16. */
  minDistance?: number
  /** Only these axes count. Default both. */
  axis?: GestureAxis
  /** How much the swipe's axis must lead the other. Default 1.5. */
  ratio?: number
}

/** Which way a released movement swiped, or null when it was not a swipe. */
export function swipeDirection(movement: GesturePoint, velocity: GesturePoint, options: SwipeOptions = {}): Direction | null {
  const { distance = 60, velocity: flick = FLICK_VELOCITY, minDistance = 16, ratio = 1.5 } = options
  const ax = Math.abs(movement.x)
  const ay = Math.abs(movement.y)
  const axis: GestureAxis | null = options.axis ?? (ax > ay * ratio ? "x" : ay > ax * ratio ? "y" : null)
  if (!axis) return null
  const along = axis === "x" ? movement.x : movement.y
  const across = axis === "x" ? ay : ax
  if (Math.abs(along) <= across * ratio) return null
  const speed = axis === "x" ? velocity.x : velocity.y
  const far = Math.abs(along) >= distance
  const flung = Math.abs(along) >= minDistance && Math.abs(speed) >= flick && Math.sign(speed) === Math.sign(along)
  if (!far && !flung) return null
  if (axis === "x") return along < 0 ? "left" : "right"
  return along < 0 ? "up" : "down"
}

/**
 * How far an edge moves when pulled `overshoot` px past it: the further the
 * pull, the less each pixel gives, approaching `size` and never passing it.
 * The sign follows the overshoot. `c` is the stiffness, iOS uses 0.55.
 */
export function rubberBand(overshoot: number, size: number, c = 0.55): number {
  if (!overshoot || size <= 0) return 0
  const distance = Math.abs(overshoot)
  return Math.sign(overshoot) * (1 - 1 / ((distance * c) / size + 1)) * size
}

/** Clamp `value` into [min, max], letting it stretch past either end by rubberBand. */
export function rubberClamp(value: number, min: number, max: number, size: number, c?: number): number {
  if (value < min) return min + rubberBand(value - min, size, c)
  if (value > max) return max + rubberBand(value - max, size, c)
  return value
}

export interface DismissOptions {
  /** Offset toward the dismissing side, in px (positive is toward it). */
  offset: number
  /** Velocity toward the dismissing side, px/ms. */
  velocity: number
  /** The size of what is being swiped away along the swipe, in px. */
  size: number
  /** Fraction of `size` past which a slow release dismisses. Default 0.5. */
  ratio?: number
  /** Px/ms past which a release dismisses from any distance. Default FLICK_VELOCITY. */
  flick?: number
}

/** Swipe to dismiss: whether a release should carry it away or let it spring back. */
export function shouldDismiss({ offset, velocity, size, ratio = 0.5, flick = FLICK_VELOCITY }: DismissOptions): boolean {
  if (offset <= 0) return false
  if (velocity >= flick && offset > 4) return true
  return offset >= size * ratio && velocity > -flick
}

export interface PageSwipeOptions {
  index: number
  count: number
  /** Drag offset along the strip in px, positive toward the previous item. */
  offset: number
  /** Velocity in px/ms, same sign as `offset`. */
  velocity: number
  /** Width of one item in px. */
  size: number
  /** Fraction of `size` that pages at any speed. Default 0.25. */
  ratio?: number
  flick?: number
  /** Wrap past the ends instead of stopping. */
  loop?: boolean
}

/** Swipe between items: the index a release lands on, one step at most. */
export function pageAfterSwipe({ index, count, offset, velocity, size, ratio = 0.25, flick = FLICK_VELOCITY, loop = false }: PageSwipeOptions): number {
  if (count <= 0) return 0
  const far = Math.abs(offset) >= size * ratio
  const flung = Math.abs(velocity) >= flick && Math.sign(velocity) === Math.sign(offset) && Math.abs(offset) > 8
  if (!far && !flung) return index
  const next = index + (offset < 0 ? 1 : -1)
  if (loop) return (next + count) % count
  return clamp(next, 0, count - 1)
}

/** Where a fling at `velocity` px/ms comes to rest with exponential friction of time constant `tau` ms. */
export function momentumDistance(velocity: number, tau = 240): number {
  return velocity * tau
}

export interface PinchFrame {
  /** Distance between the two pointers now, over the distance at the start. */
  scale: number
  /** Midpoint of the two pointers. */
  origin: GesturePoint
  distance: number
}

export function distance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: GesturePoint, b: GesturePoint): GesturePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** The pinch between two pointers, measured against the distance it started at. */
export function pinchFrame(a: GesturePoint, b: GesturePoint, startDistance: number): PinchFrame {
  const now = Math.max(1, distance(a, b))
  return { scale: now / Math.max(1, startDistance), origin: midpoint(a, b), distance: now }
}

/** The wheel's delta in pixels, whatever unit the device reported it in. */
export function wheelPixels(delta: number, mode: number, page: number): number {
  if (mode === 1) return delta * 16
  if (mode === 2) return delta * page
  return delta
}

export interface DragSessionOptions {
  /** Px of travel before a press becomes a drag. */
  slop: number
  /** Only a drag along this axis counts; one along the other is rejected. `lock` takes whichever comes first. */
  axis?: GestureAxis | "lock"
}

export interface DragFrame {
  /** `pending` inside the slop, `drag` once committed, `rejected` when it went the other way. */
  phase: "pending" | "drag" | "rejected"
  /** True on the frame the drag committed. */
  first: boolean
  start: GesturePoint
  point: GesturePoint
  movement: GesturePoint
  delta: GesturePoint
  velocity: GesturePoint
  axis: GestureAxis | null
  elapsed: number
}

export interface DragSession {
  readonly phase: DragFrame["phase"]
  /** Feed the pointer's position; returns where the gesture stands. */
  move: (point: GesturePoint, time: number) => DragFrame
  /** The final frame at release, with the swipe it made (if it was a drag). */
  end: (point: GesturePoint, time: number, swipe?: SwipeOptions) => DragFrame & { swipe: Direction | null }
}

/**
 * One press followed from down to up, whatever events carry it: useGesture
 * feeds it pointer events, a pull from the screen edge feeds it touches. It
 * decides when the press becomes a drag, along which axis, how fast it moves
 * and whether the release was a swipe, so every gesture in the kit draws the
 * line in the same place.
 */
export function createDragSession(start: GesturePoint, time: number, options: DragSessionOptions): DragSession {
  const tracker = createVelocityTracker()
  tracker.add(start, time)
  let phase: DragFrame["phase"] = "pending"
  let axis: GestureAxis | null = null
  let last = start

  function frame(point: GesturePoint, at: number, first: boolean): DragFrame {
    const f: DragFrame = {
      phase,
      first,
      start,
      point,
      movement: { x: point.x - start.x, y: point.y - start.y },
      delta: { x: point.x - last.x, y: point.y - last.y },
      velocity: tracker.velocity(at),
      axis,
      elapsed: at - time,
    }
    last = point
    return f
  }

  return {
    get phase() {
      return phase
    },
    move(point, at) {
      tracker.add(point, at)
      let first = false
      if (phase === "pending") {
        const movement = { x: point.x - start.x, y: point.y - start.y }
        if (Math.hypot(movement.x, movement.y) >= options.slop) {
          if (!options.axis) {
            phase = "drag"
            first = true
          } else {
            const taken = lockAxis(movement, options.slop)
            if (taken && options.axis !== "lock" && taken !== options.axis) phase = "rejected"
            else if (taken) {
              axis = taken
              phase = "drag"
              first = true
            }
          }
        }
      }
      if (phase !== "drag") return frame(point, at, false)
      return frame(point, at, first)
    },
    end(point, at, swipe) {
      tracker.add(point, at)
      const f = frame(point, at, false)
      const direction = phase === "drag" ? swipeDirection(f.movement, f.velocity, { axis: axis ?? undefined, ...swipe }) : null
      return { ...f, swipe: direction }
    },
  }
}
