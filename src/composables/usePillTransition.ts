import { useReducedMotion } from "motion-v"
import { computed, type ComputedRef } from "vue"

/*
 * Shared motion-v transition for the sliding "pill" indicator used by LpTabs,
 * LpSegmented and LpPagination (a shared layoutId element that flies under the
 * active item). One spring keeps the feel identical across them; it collapses to
 * an instant move when the OS prefers reduced motion.
 */
export type PillTransition =
  | { duration: number }
  | { type: "spring"; stiffness: number; damping: number }

export function usePillTransition(): ComputedRef<PillTransition> {
  const reduceMotion = useReducedMotion()
  return computed<PillTransition>(() =>
    reduceMotion.value ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 },
  )
}
