import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import { usePointerFrame } from "./usePointerFrame"

/*
 * Drives the `.lp-spotlight` glow (tokens/effects.css): writes the pointer
 * position into custom properties on the element and marks it while the
 * pointer is inside.
 *
 * Writes go straight to the element's style, not through a reactive binding,
 * one per animation frame with the latest position (usePointerFrame, shared
 * with LpMagnetic and useTilt). Touch and pen are ignored: a glow that jumps
 * to wherever a finger landed reads as a pressed state that is not one.
 * Reduced motion turns it off rather than freezing it.
 */

export interface UseSpotlightOptions {
  /** Switch the effect off without unbinding — the listeners stay, nothing is drawn. */
  disabled?: MaybeRefOrGetter<boolean | undefined>
}

export interface UseSpotlight {
  /** Attach to the element carrying `.lp-spotlight`. */
  el: Ref<HTMLElement | null>
}

/** Pointer position relative to a rect, in px, as the CSS custom properties want it. */
export function spotlightPoint(rect: { left: number; top: number }, clientX: number, clientY: number) {
  return { x: `${Math.round(clientX - rect.left)}px`, y: `${Math.round(clientY - rect.top)}px` }
}

export function useSpotlight(options: UseSpotlightOptions = {}): UseSpotlight {
  const el = ref<HTMLElement | null>(null)

  const pointer = usePointerFrame({
    disabled: options.disabled,
    paint: (clientX, clientY) => {
      const node = el.value
      if (!node) return
      const { x, y } = spotlightPoint(node.getBoundingClientRect(), clientX, clientY)
      node.style.setProperty("--lp-spot-x", x)
      node.style.setProperty("--lp-spot-y", y)
    },
  })

  function onMove(event: PointerEvent) {
    if (pointer.move(event)) el.value?.setAttribute("data-lp-spot", "")
  }

  function onLeave() {
    el.value?.removeAttribute("data-lp-spot")
  }

  function detach(node: HTMLElement) {
    node.removeEventListener("pointermove", onMove)
    node.removeEventListener("pointerleave", onLeave)
    node.removeAttribute("data-lp-spot")
  }

  watch(
    el,
    (node, previous) => {
      if (previous) detach(previous)
      if (!node) return
      node.addEventListener("pointermove", onMove, { passive: true })
      node.addEventListener("pointerleave", onLeave, { passive: true })
    },
    { flush: "post" },
  )

  watch(
    () => toValue(options.disabled),
    (disabled) => {
      if (disabled) onLeave()
    },
  )

  onBeforeUnmount(() => {
    if (el.value) detach(el.value)
  })

  return { el }
}
