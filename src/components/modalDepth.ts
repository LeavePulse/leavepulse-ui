/*
 * Stacking order for dialogs that are open at the same time.
 *
 * Not provide/inject, which was the first shape tried: it only works when the
 * second dialog is rendered INSIDE the first one's subtree, and the ordinary
 * way to write a dialog opened from a dialog is to put both at the top level of
 * the same component and toggle them with separate flags. Those two are
 * siblings, so the inner one injects nothing and lands on the same rungs as the
 * outer — which is the bug.
 *
 * What decides the order is the sequence of OPENING: a dialog opened while
 * another is up belongs above it, wherever it sits in the markup.
 *
 * The newest dialog keeps the scale's own --z-overlay/--z-modal and the ones
 * beneath are pushed DOWN, rather than each new dialog climbing higher. Climbing
 * runs out of room immediately: --z-popover is only 10 above --z-modal, so the
 * second nested dialog would tie with every popover and the third with every
 * tooltip — and a select inside a dialog is ordinary. Descending has no such
 * ceiling, and it keeps the frontmost dialog exactly where a single one has
 * always been.
 */
import { computed, ref, type ComputedRef } from "vue"

/*
 * Rungs per level. Has to clear a whole level, not just its scrim: --z-overlay
 * is 100 and --z-modal 110, so a gap of 2 left the upper scrim under the lower
 * PANEL — it darkened that panel and could not blur it, a backdrop-filter
 * having nothing of it underneath to work on.
 */
const STEP = 10

/** Levels currently claimed, oldest first. */
const stack = ref<number[]>([])
let nextId = 0

/**
 * Register a dialog as open and get back the z-indexes it should paint with.
 * The result is reactive: opening another dialog moves this one down a step.
 */
export function useModalLayer(): {
  claim: () => void
  release: () => void
  layer: ComputedRef<{ scrim: string; panel: string }>
} {
  const id = nextId++

  /*
   * How far from the TOP of the stack, so the newest dialog is 0 and keeps the
   * unmodified rungs. A dialog that is not in the stack reads 0 too: it is
   * either closed, or opening this very frame and about to claim.
   */
  const fromTop = computed(() => {
    const at = stack.value.indexOf(id)
    return at === -1 ? 0 : stack.value.length - 1 - at
  })

  return {
    claim: () => {
      if (!stack.value.includes(id)) stack.value = [...stack.value, id]
    },
    release: () => {
      stack.value = stack.value.filter((x) => x !== id)
    },
    layer: computed(() => {
      const drop = fromTop.value * STEP
      return {
        scrim: `calc(var(--z-overlay) - ${drop})`,
        panel: `calc(var(--z-modal) - ${drop})`,
      }
    }),
  }
}
