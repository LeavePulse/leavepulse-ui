import { useReducedMotion } from "motion-v"
import { computed, ref, type ComputedRef, type CSSProperties, type Ref } from "vue"

/*
 * useTilt — pointer-reactive 3D tilt for a "tactile" surface (a card, a tile, a
 * floating island). The element rotates toward the cursor and lifts on hover,
 * giving physical, hand-held depth without any per-component motion wiring.
 *
 * Bind the returned handlers to the element and the returned `style` to it (it
 * needs a shared `perspective` on an ANCESTOR — see LpTilt, which supplies one).
 * Rotation eases to rest via CSS transition; the handlers only write the target
 * transform, so there's no rAF loop. SSR-safe (no window access at setup) and
 * collapses to a flat, no-tilt style when the OS prefers reduced motion.
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

export function useTilt(options: UseTiltOptions = {}): UseTilt {
  const max = options.max ?? 10
  const lift = options.lift ?? 8
  const scale = options.scale ?? 1.03
  const reduceMotion = useReducedMotion()

  const active = ref(false)
  // Pointer position within the element, normalized to [-1, 1] from center.
  const nx = ref(0)
  const ny = ref(0)

  function onPointerMove(e: PointerEvent): void {
    if (reduceMotion.value) return
    const el = e.currentTarget as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    nx.value = ((e.clientX - r.left) / r.width) * 2 - 1
    ny.value = ((e.clientY - r.top) / r.height) * 2 - 1
  }

  function onPointerEnter(): void {
    active.value = true
  }

  function onPointerLeave(): void {
    active.value = false
    nx.value = 0
    ny.value = 0
  }

  const style = computed<CSSProperties>(() => {
    if (reduceMotion.value) {
      return { transition: "transform 0.2s ease" }
    }
    // rotateX tips away from the pointer's vertical position; rotateY toward its
    // horizontal one. Only tilt while active so it rests flat when the pointer
    // leaves (nx/ny are already zeroed on leave).
    const rx = active.value ? -ny.value * max : 0
    const ry = active.value ? nx.value * max : 0
    const z = active.value ? lift : 0
    const s = active.value ? scale : 1
    return {
      transform: `translate3d(0, ${-z}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})`,
      transformStyle: "preserve-3d",
      transition: active.value
        ? "transform 0.12s ease-out"
        : "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
    }
  })

  const glareStyle = computed<CSSProperties>(() => {
    if (!options.glare || reduceMotion.value || !active.value) {
      return { opacity: 0 }
    }
    // Bright spot tracks the pointer; map [-1,1] → [0%,100%].
    const px = (nx.value + 1) * 50
    const py = (ny.value + 1) * 50
    return {
      opacity: 1,
      background: `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.35), transparent 55%)`,
      transition: "opacity 0.2s ease",
    }
  })

  return { style, glareStyle, onPointerMove, onPointerEnter, onPointerLeave, active }
}
