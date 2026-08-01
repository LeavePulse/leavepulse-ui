import { computed, ref, type ComputedRef, type CSSProperties, type Ref } from "vue"

/*
 * useZoomPan — zoom + pan for a single element inside a viewport, the way an
 * image viewer behaves: the wheel zooms toward the pointer (so the pixel under
 * the cursor stays put), dragging pans, and a two-finger pinch does both at
 * once. Pans are clamped so the content can't be flung off into empty space.
 *
 * Split out of LpLightbox because none of this is lightbox-specific — a map, a
 * diagram or a zoomable preview needs exactly the same maths.
 *
 * Bind `style` to the moving element, the handlers to the viewport, and call
 * `reset()` whenever the content changes.
 */
export interface UseZoomPanOptions {
  /** Smallest allowed scale. Default 1 (fit — never shrink past the viewport). */
  min?: number
  /** Largest allowed scale. Default 8. */
  max?: number
  /** Multiplier per wheel notch. Default 1.15. */
  step?: number
  /** Scale that a double-click/tap toggles to, from `min`. Default 2. */
  zoomedScale?: number
}

export interface UseZoomPan {
  scale: Ref<number>
  /** True once zoomed past the minimum — the point at which panning matters. */
  zoomed: ComputedRef<boolean>
  /** True while a drag is in flight, so the caller can swap the cursor. */
  panning: Ref<boolean>
  style: ComputedRef<CSSProperties>
  onWheel: (e: WheelEvent) => void
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  /** Zoom about the viewport centre (buttons, keyboard). */
  zoomBy: (factor: number) => void
  /** Toggle between fit and `zoomedScale`, optionally about a point. */
  toggleZoom: (origin?: { x: number; y: number }) => void
  reset: () => void
  /** Call with the viewport element so pointer coords can be made relative. */
  setViewport: (el: HTMLElement | null) => void
}

export function useZoomPan(options: UseZoomPanOptions = {}): UseZoomPan {
  const min = options.min ?? 1
  const max = options.max ?? 8
  const step = options.step ?? 1.15
  const zoomedScale = options.zoomedScale ?? 2

  const scale = ref(min)
  const x = ref(0)
  const y = ref(0)
  const panning = ref(false)

  let viewport: HTMLElement | null = null
  // Active pointers, so a second finger can be detected for pinch.
  const pointers = new Map<number, { x: number; y: number }>()
  let start = { x: 0, y: 0, panX: 0, panY: 0 }
  let pinchStartDistance = 0
  let pinchStartScale = 1

  const zoomed = computed(() => scale.value > min + 0.001)

  function setViewport(el: HTMLElement | null) {
    viewport = el
  }

  function clamp(value: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, value))
  }

  /**
   * Keep the content overlapping the viewport. The translate is applied before
   * the scale, so the slack on each axis is half of what the growth adds — at
   * fit scale there's none, which pins the image centred.
   */
  function clampPan() {
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const slackX = (rect.width * (scale.value - 1)) / 2 / scale.value
    const slackY = (rect.height * (scale.value - 1)) / 2 / scale.value
    x.value = clamp(x.value, -slackX, slackX)
    y.value = clamp(y.value, -slackY, slackY)
  }

  /** Zoom to `next`, holding the viewport-relative point `px,py` in place. */
  function zoomAbout(next: number, px: number, py: number) {
    const clamped = clamp(next, min, max)
    if (clamped === scale.value) return
    // Where the cursor sits in content space before the change; solving for the
    // same content point after gives the translate that keeps it under the
    // cursor rather than drifting toward the centre.
    const contentX = px / scale.value - x.value
    const contentY = py / scale.value - y.value
    scale.value = clamped
    x.value = px / clamped - contentX
    y.value = py / clamped - contentY
    clampPan()
  }

  /** Pointer position relative to the viewport centre. */
  function relative(e: { clientX: number; clientY: number }) {
    if (!viewport) return { x: 0, y: 0 }
    const rect = viewport.getBoundingClientRect()
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const point = relative(e)
    zoomAbout(scale.value * (e.deltaY < 0 ? step : 1 / step), point.x, point.y)
  }

  function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function onPointerDown(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchStartDistance = distance(a, b)
      pinchStartScale = scale.value
      panning.value = false
      return
    }
    if (pointers.size > 2) return

    // Pan only when there's somewhere to pan to; at fit scale a drag is left
    // free for the caller (LpLightbox uses it to swipe between images).
    if (!zoomed.value) return
    panning.value = true
    start = { x: e.clientX, y: e.clientY, panX: x.value, panY: y.value }
    ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.size === 2 && pinchStartDistance > 0) {
      const [a, b] = [...pointers.values()]
      const mid = { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }
      const point = relative(mid)
      zoomAbout(pinchStartScale * (distance(a, b) / pinchStartDistance), point.x, point.y)
      return
    }

    if (!panning.value) return
    // Divide by scale: the translate is in content space, which the transform
    // then magnifies — without this the image races ahead of the cursor.
    x.value = start.panX + (e.clientX - start.x) / scale.value
    y.value = start.panY + (e.clientY - start.y) / scale.value
    clampPan()
  }

  function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchStartDistance = 0
    if (pointers.size === 0) panning.value = false
  }

  function zoomBy(factor: number) {
    zoomAbout(scale.value * factor, 0, 0)
  }

  function toggleZoom(origin?: { x: number; y: number }) {
    if (zoomed.value) {
      reset()
      return
    }
    const point = origin ? relative({ clientX: origin.x, clientY: origin.y }) : { x: 0, y: 0 }
    zoomAbout(zoomedScale, point.x, point.y)
  }

  function reset() {
    scale.value = min
    x.value = 0
    y.value = 0
    panning.value = false
    pointers.clear()
    pinchStartDistance = 0
  }

  const style = computed<CSSProperties>(() => ({
    transform: `scale(${scale.value}) translate(${x.value}px, ${y.value}px)`,
    // Settle smoothly on discrete zooms, but follow a drag or pinch exactly.
    transition: panning.value || pinchStartDistance > 0 ? "none" : undefined,
  }))

  return {
    scale,
    zoomed,
    panning,
    style,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    zoomBy,
    toggleZoom,
    reset,
    setViewport,
  }
}
