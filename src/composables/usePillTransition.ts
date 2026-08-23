import { useReducedMotion } from "motion-v"
import { computed, type ComputedRef } from "vue"

/*
 * Shared motion-v transition for an element that FLIES to a new position rather
 * than cutting to it: the sliding "pill" indicator in LpTabs, LpSegmented and
 * LpPagination (a shared layoutId element under the active item), and LpChart's
 * tooltip trailing the cursor. One spring per feel keeps them consistent, and
 * every preset collapses to an instant move when the OS prefers reduced motion.
 *
 * Two feels, because the two jobs want opposite things:
 *
 *   "pill"  — snappy. The move is a direct answer to a click, so it should read
 *             as already-arrived: high stiffness, almost no visible travel.
 *   "float" — trailing. The element chases a continuously moving pointer, so it
 *             wants perceptible lag and a soft landing; a pill-stiff spring
 *             tracks the cursor so exactly that it reads as jitter, not motion.
 */
export type PillTransition =
  | { duration: number }
  | { type: "spring"; stiffness: number; damping: number }

export type PillFeel = "pill" | "float"

const SPRING: Record<PillFeel, { type: "spring"; stiffness: number; damping: number }> = {
  pill: { type: "spring", stiffness: 520, damping: 40 },
  float: { type: "spring", stiffness: 210, damping: 26 },
}

export function usePillTransition(feel: PillFeel = "pill"): ComputedRef<PillTransition> {
  const reduceMotion = useReducedMotion()
  return computed<PillTransition>(() =>
    reduceMotion.value ? { duration: 0 } : SPRING[feel],
  )
}

/*
 * The same feels as a step function, for a follower that cannot be driven by
 * motion-v.
 *
 * LpChart's readout is positioned inside its own plot, so it can hand motion-v
 * an absolute target and let the library do the work. LpTooltip's panel is
 * portalled into <body> and placed by reka; all it can contribute is an offset
 * on top of that, which no declarative animation owns — so it integrates the
 * spring itself, one frame at a time.
 *
 * Two mechanisms, then, but one place to tune them. The constants below are NOT
 * the motion-v pair reused: an explicit integrator needs a mass-normalised
 * stiffness and a damping ratio, and feeding it motion-v's numbers produced a
 * spring so slack the panel crept toward the cursor and never arrived. They are
 * matched by feel and kept beside their motion-v counterparts so that a change
 * to one is an obvious prompt to check the other.
 */
const STEP_SPRING: Record<PillFeel, { stiffness: number; damping: number }> = {
  // Critically damped: reaches the target quickly, never past it.
  pill: { stiffness: 420, damping: 41 },
  float: { stiffness: 260, damping: 32 },
}

export interface SpringState {
  /** Current position; seed it with the start value. */
  value: number
  /** Current velocity; seed with 0. */
  velocity: number
}

export function springStep(
  state: SpringState,
  target: number,
  feel: PillFeel = "float",
  /** Frame time in seconds; clamped so a backgrounded tab can't explode it. */
  dt = 1 / 60,
): SpringState {
  const { stiffness, damping } = STEP_SPRING[feel]
  const step = Math.min(dt, 1 / 30)
  const force = (target - state.value) * stiffness
  const drag = state.velocity * damping
  const velocity = state.velocity + (force - drag) * step
  return { value: state.value + velocity * step, velocity }
}

/** True once a spring is close enough to its target to stop animating. */
export const springSettled = (state: SpringState, target: number): boolean =>
  Math.abs(target - state.value) < 0.3 && Math.abs(state.velocity) < 0.3
