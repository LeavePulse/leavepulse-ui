import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import { prefersReducedMotion } from "./easing"
import {
  createDragSession,
  distance,
  LONG_PRESS_MS,
  pinchFrame,
  slopFor,
  type DragFrame,
  type DragSession,
  type GestureAxis,
  type GesturePoint,
  type PinchFrame,
  type SwipeOptions,
} from "./gesture"
import { isElement, nodeWindow } from "./realm"
import type { Direction } from "./spatialNav"

/*
 * One engine for pointer gestures: drag, swipe, pinch, long press and tap on
 * one element, decided the same way everywhere.
 *
 * - A press becomes a drag once it travels past the slop (more for a finger
 *   than for a mouse). Until then nothing is captured and nothing is
 *   prevented, so a button or link under the press still gets its click.
 * - With `axis: "x"` (or "y") a press whose first clear movement runs along
 *   the other axis is let go: the page scrolls as it would without us.
 *   `axis: "lock"` commits to whichever axis the movement first takes.
 * - Once dragging, a mouse or pen is captured (a touch already is, to what it
 *   landed on), so the drag survives leaving the element and works inside an
 *   LpFrame; text selection is off, and the click
 *   the release produces is swallowed: a drag over a link does not follow it.
 * - A cancelled pointer (the browser took the touch for a scroll or a system
 *   gesture), a lost capture, a second finger or Escape end the drag with
 *   `cancelled`: nothing should be committed from it.
 * - Two fingers are a pinch, reported against the distance they started at.
 * - A long press fires after `longPress.delay` of staying within the slop,
 *   and the click that follows it is swallowed.
 * - Velocity is measured over the last 100 ms, so a final jittery frame does
 *   not decide a flick. Release reports a swipe direction when the movement
 *   was one (see swipeDirection).
 *
 * Touch handling is the browser's until the element says otherwise with
 * `touch-action`: an element that pans by finger needs `touch-none` (or
 * `pan-y` for a sideways gesture inside a vertical page), or the browser takes
 * the touch for a scroll and cancels the pointer.
 */

export interface GestureState {
  event: PointerEvent
  pointerType: string
  /** Where the press started, client coordinates. */
  start: GesturePoint
  /** Where the pointer is now. */
  point: GesturePoint
  /** Travel since the press. */
  movement: GesturePoint
  /** Travel since the previous report. */
  delta: GesturePoint
  /** Px/ms over the last moments. */
  velocity: GesturePoint
  /** The axis the drag committed to, with `axis` set. */
  axis: GestureAxis | null
  /** Ms since the press. */
  elapsed: number
  /** A drag that ended without being completed: do not commit it. */
  cancelled: boolean
}

export interface GestureEnd extends GestureState {
  /** The swipe this release made, or null. */
  swipe: Direction | null
}

export interface GesturePinch extends PinchFrame {
  event: PointerEvent
}

export interface GestureOptions {
  /** Off while false; read on every press. */
  enabled?: MaybeRefOrGetter<boolean | undefined>
  /** Pointer types that may start a gesture. Default all. */
  pointerTypes?: readonly ("mouse" | "pen" | "touch")[]
  /** Restrict drags to an axis, or `lock` to the first one taken. */
  axis?: GestureAxis | "lock"
  /** Override the slop in px (default by pointer type). */
  threshold?: number
  /** Presses starting inside an element matching this selector are ignored. */
  ignore?: string
  /** Capture the pointer once dragging. Default true. */
  capture?: boolean
  /** Swallow the click a drag ends with. Default true. */
  preventClick?: boolean
  /** Options for the swipe reported on release. */
  swipe?: SwipeOptions
  /** A press landed (before any threshold). Return false to ignore this press. */
  onPress?: (event: PointerEvent) => boolean | void
  onDragStart?: (state: GestureState) => void
  onDrag?: (state: GestureState) => void
  onDragEnd?: (state: GestureEnd) => void
  /** Released after a swipe; also reported on onDragEnd as `swipe`. */
  onSwipe?: (direction: Direction, state: GestureEnd) => void
  /** A press that never became a drag, released. */
  onTap?: (event: PointerEvent) => void
  onPinchStart?: (pinch: GesturePinch) => void
  onPinch?: (pinch: GesturePinch) => void
  onPinchEnd?: (pinch: GesturePinch & { cancelled: boolean }) => void
  /** A press held still for `delay` ms (default LONG_PRESS_MS); the click its release makes is swallowed. */
  longPress?: { delay?: MaybeRefOrGetter<number | undefined>; pointerTypes?: readonly ("mouse" | "pen" | "touch")[]; handler: (event: PointerEvent) => void }
}

export interface Gesture {
  /** True while a drag (past the slop) is in flight. */
  dragging: Ref<boolean>
  /** True while two pointers are pinching. */
  pinching: Ref<boolean>
  /** End whatever is in flight as cancelled. */
  cancel: () => void
  /** Bind these to the element when not using useGesture. */
  handlers: {
    onPointerdown: (event: PointerEvent) => void
    onPointermove: (event: PointerEvent) => void
    onPointerup: (event: PointerEvent) => void
    onPointercancel: (event: PointerEvent) => void
    onLostpointercapture: (event: PointerEvent) => void
    onClickCapture: (event: MouseEvent) => void
    onDragstart: (event: DragEvent) => void
    onContextmenu: (event: Event) => void
  }
  /** Detach window listeners and timers; useGesture calls it on unmount. */
  dispose: () => void
}

const CLICK_AFTER_HOLD_MS = 350

interface Press {
  id: number
  type: string
  el: HTMLElement
  session: DragSession
  dragging: boolean
  first: PointerEvent
}

/** The engine without an element: bind `handlers` yourself (to compose with other handlers). */
export function createGesture(options: GestureOptions): Gesture {
  const dragging = ref(false)
  const pinching = ref(false)
  const pointers = new Map<number, GesturePoint>()
  let press: Press | null = null
  let pinchStart = 0
  let pinchLast: GesturePinch | null = null
  let swallow = false
  let swallowTimer = 0
  let holdTimer = 0
  let held = false
  let bodyStyle: { style: CSSStyleDeclaration; userSelect: string } | null = null
  let keyWindow: Window | null = null

  const pt = (e: PointerEvent): GesturePoint => ({ x: e.clientX, y: e.clientY })

  function state(e: PointerEvent, p: Press, f: DragFrame, cancelled = false): GestureState {
    return { event: e, pointerType: p.type, start: f.start, point: f.point, movement: f.movement, delta: f.delta, velocity: f.velocity, axis: f.axis, elapsed: f.elapsed, cancelled }
  }

  /* Swallow the click a release makes. A long press may make none at all, so past `within` ms the next click is the user's own. */
  function clickSoon(win: Window, within = 0) {
    swallow = true
    win.clearTimeout(swallowTimer)
    swallowTimer = win.setTimeout(() => (swallow = false), within)
  }

  function stopHold() {
    if (holdTimer) window.clearTimeout(holdTimer)
    holdTimer = 0
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape" && dragging.value) {
      e.preventDefault()
      cancel()
    }
  }

  function beginDrag(e: PointerEvent, p: Press, f: DragFrame) {
    p.dragging = true
    dragging.value = true
    stopHold()
    // A touch is already captured to the element it landed on (inside this
    // one), so its events keep coming here; moving that capture over has been
    // seen to drop it again a frame later in Chromium.
    if (options.capture !== false && p.type !== "touch") {
      try {
        p.el.setPointerCapture(p.id)
      } catch {}
    }
    const doc = p.el.ownerDocument
    bodyStyle = { style: doc.body.style, userSelect: doc.body.style.userSelect }
    doc.body.style.userSelect = "none"
    doc.getSelection()?.removeAllRanges()
    keyWindow = nodeWindow(p.el)
    keyWindow.addEventListener("keydown", onKey, true)
    options.onDragStart?.(state(e, p, f))
  }

  function release() {
    if (bodyStyle) bodyStyle.style.userSelect = bodyStyle.userSelect
    bodyStyle = null
    keyWindow?.removeEventListener("keydown", onKey, true)
    keyWindow = null
    dragging.value = false
  }

  function endPress(e: PointerEvent, cancelled: boolean) {
    const p = press
    if (!p) return
    press = null
    stopHold()
    if (p.el.hasPointerCapture?.(p.id)) {
      try {
        p.el.releasePointerCapture(p.id)
      } catch {}
    }
    if (!p.dragging) {
      release()
      if (held) {
        if (cancelled) swallow = false
        else clickSoon(nodeWindow(p.el), CLICK_AFTER_HOLD_MS)
        held = false
      } else if (!cancelled) options.onTap?.(e)
      return
    }
    const f = p.session.end(pt(e), e.timeStamp, options.swipe)
    const s = state(e, p, f, cancelled)
    const swipe = cancelled ? null : f.swipe
    if (!cancelled && options.preventClick !== false) clickSoon(nodeWindow(p.el))
    release()
    const end: GestureEnd = { ...s, swipe }
    options.onDragEnd?.(end)
    if (swipe) options.onSwipe?.(swipe, end)
  }

  function endPinch(e: PointerEvent, cancelled: boolean) {
    if (!pinching.value) return
    pinching.value = false
    pinchStart = 0
    if (pinchLast) options.onPinchEnd?.({ ...pinchLast, event: e, cancelled })
    pinchLast = null
  }

  function allowed(e: PointerEvent): boolean {
    if (toValue(options.enabled) === false) return false
    if (options.pointerTypes && !options.pointerTypes.includes(e.pointerType as "mouse")) return false
    if (e.pointerType === "mouse" && e.button !== 0) return false
    if (options.ignore && isElement(e.target) && e.target.closest(options.ignore)) return false
    return true
  }

  function onPointerdown(e: PointerEvent) {
    if (!allowed(e)) return
    pointers.set(e.pointerId, pt(e))
    if (pointers.size === 2 && (options.onPinch || options.onPinchStart)) {
      if (press) endPress(e, true)
      const [a, b] = [...pointers.values()] as [GesturePoint, GesturePoint]
      pinchStart = distance(a, b)
      pinching.value = true
      pinchLast = { ...pinchFrame(a, b, pinchStart), event: e }
      try {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } catch {}
      options.onPinchStart?.(pinchLast)
      return
    }
    if (pointers.size > 1 || press) return
    if (options.onPress?.(e) === false) {
      pointers.delete(e.pointerId)
      return
    }
    const el = e.currentTarget as HTMLElement
    held = false
    const session = createDragSession(pt(e), e.timeStamp, { slop: options.threshold ?? slopFor(e.pointerType), axis: options.axis })
    press = { id: e.pointerId, type: e.pointerType, el, session, dragging: false, first: e }
    const lp = options.longPress
    if (lp && (!lp.pointerTypes || lp.pointerTypes.includes(e.pointerType as "mouse"))) {
      holdTimer = window.setTimeout(() => {
        holdTimer = 0
        if (!press || press.dragging) return
        held = true
        lp.handler(e)
      }, toValue(lp.delay) ?? LONG_PRESS_MS)
    }
  }

  function onPointermove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, pt(e))
    if (pinching.value && pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [GesturePoint, GesturePoint]
      pinchLast = { ...pinchFrame(a, b, pinchStart), event: e }
      options.onPinch?.(pinchLast)
      return
    }
    const p = press
    if (!p || e.pointerId !== p.id) return
    const f = p.session.move(pt(e), e.timeStamp)
    if (f.phase === "rejected") {
      press = null
      pointers.delete(e.pointerId)
      stopHold()
      return
    }
    if (f.phase === "pending") return
    if (!p.dragging) {
      stopHold()
      if (held) return
      if (!options.onDrag && !options.onDragStart && !options.onDragEnd && !options.onSwipe) return
      beginDrag(e, p, f)
    }
    options.onDrag?.(state(e, p, f))
  }

  function onPointerup(e: PointerEvent) {
    if (!pointers.delete(e.pointerId)) return
    if (pinching.value) {
      if (pointers.size < 2) endPinch(e, false)
      return
    }
    if (press?.id === e.pointerId) endPress(e, false)
  }

  function onPointercancel(e: PointerEvent) {
    if (!pointers.delete(e.pointerId)) return
    if (pinching.value) {
      endPinch(e, true)
      return
    }
    if (press?.id === e.pointerId) endPress(e, true)
  }

  function onLostpointercapture(e: PointerEvent) {
    if (press?.dragging && press.id === e.pointerId) {
      pointers.delete(e.pointerId)
      endPress(e, true)
    }
  }

  function onClickCapture(e: MouseEvent) {
    if (!swallow) return
    swallow = false
    e.preventDefault()
    e.stopImmediatePropagation()
  }

  function onDragstart(e: DragEvent) {
    if (press) e.preventDefault()
  }

  function onContextmenu(e: Event) {
    if (holdTimer || held || dragging.value) e.preventDefault()
  }

  function cancel() {
    const p = press
    if (p) {
      pointers.delete(p.id)
      endPress(p.first, true)
    }
    if (pinching.value && pinchLast) endPinch(pinchLast.event, true)
    pointers.clear()
  }

  function dispose() {
    stopHold()
    if (press?.dragging) release()
    press = null
    pointers.clear()
  }

  return {
    dragging,
    pinching,
    cancel,
    dispose,
    handlers: { onPointerdown, onPointermove, onPointerup, onPointercancel, onLostpointercapture, onClickCapture, onDragstart, onContextmenu },
  }
}

/** The engine bound to `target`: listeners follow the element and leave on unmount. */
export function useGesture(target: MaybeRefOrGetter<HTMLElement | null | undefined>, options: GestureOptions): Gesture {
  const gesture = createGesture(options)
  const h = gesture.handlers
  const bindings: [string, EventListener, AddEventListenerOptions?][] = [
    ["pointerdown", h.onPointerdown as EventListener],
    ["pointermove", h.onPointermove as EventListener],
    ["pointerup", h.onPointerup as EventListener],
    ["pointercancel", h.onPointercancel as EventListener],
    ["lostpointercapture", h.onLostpointercapture as EventListener],
    ["click", h.onClickCapture as EventListener, { capture: true }],
    ["dragstart", h.onDragstart as EventListener],
    ["contextmenu", h.onContextmenu as EventListener],
  ]
  watch(
    () => toValue(target),
    (el, _, onCleanup) => {
      if (!el) return
      for (const [name, fn, opts] of bindings) el.addEventListener(name, fn, opts)
      onCleanup(() => {
        for (const [name, fn, opts] of bindings) el.removeEventListener(name, fn, opts)
        gesture.cancel()
      })
    },
    { immediate: true, flush: "post" },
  )
  onBeforeUnmount(gesture.dispose)
  return gesture
}

export interface Glide {
  stop: () => void
}

/**
 * Momentum after a fling: keep moving at `velocity` px/ms and bleed the speed
 * off exponentially (time constant `tau` ms), so letting go drifts to a stop.
 * Time-based, so it feels the same at 60 and 144 Hz. `step` gets the px to
 * move this frame and returns false to stop early (an edge was hit). Under
 * reduced motion nothing glides.
 */
export function glide(velocity: GesturePoint, step: (dx: number, dy: number) => boolean | void, { tau = 240, win = window }: { tau?: number; win?: Window } = {}): Glide {
  let v = { ...velocity }
  let frame = 0
  const stop = () => {
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0
  }
  if (prefersReducedMotion(win) || Math.hypot(v.x, v.y) < 0.05) return { stop }
  let previous = win.performance.now()
  const tick = (now: number) => {
    const dt = Math.min(now - previous, 32)
    previous = now
    const friction = Math.exp(-dt / tau)
    v = { x: v.x * friction, y: v.y * friction }
    if (step(v.x * dt, v.y * dt) === false || Math.hypot(v.x, v.y) <= 0.015) {
      frame = 0
      return
    }
    frame = win.requestAnimationFrame(tick)
  }
  frame = win.requestAnimationFrame(tick)
  return { stop }
}
