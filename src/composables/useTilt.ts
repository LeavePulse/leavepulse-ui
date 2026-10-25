import { computed, ref, toValue, type ComputedRef, type CSSProperties, type MaybeRefOrGetter, type Ref } from "vue"
import { usePointerFrame } from "./usePointerFrame"
import { usePrefersReducedMotion } from "./useReducedMotion"
import { spotlightPoint } from "./useSpotlight"

/*
 * useTilt — pointer-reactive 3D tilt for a "tactile" surface (a card, a tile, a
 * floating island). The element rotates toward the cursor and lifts on hover,
 * giving physical, hand-held depth without any per-component motion wiring.
 *
 * Bind the returned handlers to the element and the returned `style` to it (it
 * needs a shared `perspective` on an ANCESTOR — see LpTilt, which supplies one).
 * Rotation eases to rest via CSS transition. The pointer is not reactive
 * state: once per animation frame (usePointerFrame, shared with LpMagnetic and
 * the spotlight) its position is written to custom properties on the element,
 * `--lp-tilt-x`/`--lp-tilt-y` from -1 to 1 for the lean and the spotlight's own
 * `--lp-spot-x`/`--lp-spot-y` for the glare, and the style reads them. It
 * re-renders on enter and leave, not on every move. SSR-safe (no window access
 * at setup) and collapses to a flat, no-tilt style when the OS prefers reduced
 * motion.
 */
export interface UseTiltOptions {
  /** Max rotation toward the pointer, in degrees (per axis). Default 10. */
  max?: number
  /** Upward lift on hover, in px. Default 8. */
  lift?: number
  /** Scale on hover. Default 1.03. */
  scale?: number
  /** Glare highlight following the pointer. Default false. */
  glare?: boolean
}

export interface UseTilt {
  /** Bind to the tilting element's style. */
  style: ComputedRef<CSSProperties>
  /** Radial-gradient background for an optional glare overlay (0 when idle). */
  glareStyle: ComputedRef<CSSProperties>
  onPointerMove: (e: PointerEvent) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  /** True while the pointer is over the element (drives lift/scale). */
  active: Ref<boolean>
}

const TILT_VARS = ["--lp-tilt-x", "--lp-tilt-y", "--lp-spot-x", "--lp-spot-y"]

export function useTilt(source: MaybeRefOrGetter<UseTiltOptions> = {}): UseTilt {
  const options = computed(() => toValue(source))
  const reduceMotion = usePrefersReducedMotion()

  const active = ref(false)
  // The element the handlers are bound to, learnt from the events themselves.
  let target: HTMLElement | null = null

  const pointer = usePointerFrame({
    anyPointer: true,
    paint: (x, y) => {
      if (!target || !active.value) return
      const r = target.getBoundingClientRect()
      // Pointer position within the element, normalized to [-1, 1] from center.
      target.style.setProperty("--lp-tilt-x", (((x - r.left) / r.width) * 2 - 1).toFixed(3))
      target.style.setProperty("--lp-tilt-y", (((y - r.top) / r.height) * 2 - 1).toFixed(3))
      const spot = spotlightPoint(r, x, y)
      target.style.setProperty("--lp-spot-x", spot.x)
      target.style.setProperty("--lp-spot-y", spot.y)
    },
  })

  function onPointerMove(e: PointerEvent): void {
    if (e.currentTarget instanceof HTMLElement) target = e.currentTarget
    pointer.move(e)
  }

  function onPointerEnter(): void {
    active.value = true
  }

  function onPointerLeave(): void {
    active.value = false
    pointer.cancel()
    for (const name of TILT_VARS) target?.style.removeProperty(name)
  }

  const style = computed<CSSProperties>(() => {
    if (reduceMotion.value) {
      return { transition: "transform 0.2s ease" }
    }
    // rotateX tips away from the pointer's vertical position; rotateY toward its
    // horizontal one. Only tilt while active so it rests flat when the pointer
    // leaves (nx/ny are already zeroed on leave).
    const { max = 10, lift = 8, scale = 1.03 } = options.value
    const rx = active.value ? `calc(var(--lp-tilt-y, 0) * ${-max}deg)` : "0deg"
    const ry = active.value ? `calc(var(--lp-tilt-x, 0) * ${max}deg)` : "0deg"
    const z = active.value ? lift : 0
    const s = active.value ? scale : 1
    return {
      transform: `translate3d(0, ${-z}px, 0) rotateX(${rx}) rotateY(${ry}) scale(${s})`,
      transformStyle: "preserve-3d",
      transition: active.value
        ? "transform 0.12s ease-out"
        : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
    }
  })

  const glareStyle = computed<CSSProperties>(() => {
    if (!options.value.glare || reduceMotion.value || !active.value) {
      return { opacity: 0 }
    }
    // Bright spot tracks the pointer, at the spotlight's own position
    // properties, which the tilting element carries and the glare inherits.
    return {
      opacity: 1,
      background: "radial-gradient(circle at var(--lp-spot-x, 50%) var(--lp-spot-y, 50%), rgba(255,255,255,0.35), transparent 55%)",
      transition: "opacity 0.2s ease",
    }
  })

  return { style, glareStyle, onPointerMove, onPointerEnter, onPointerLeave, active }
}
