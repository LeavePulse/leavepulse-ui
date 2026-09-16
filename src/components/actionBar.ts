import { onScopeDispose, ref } from "vue"

/*
 * Shared stack for LpActionBar.
 *
 * Two bars are not a contrived case: a cookie notice sits on a first visit
 * while the page underneath is a form, and the moment that form is edited the
 * unsaved-changes bar wants the same strip of screen. Both are fixed to the
 * bottom, both are translucent, so they landed on top of each other and the
 * text of one showed through the other.
 *
 * Each open bar registers here and gets back a live index. The bar offsets
 * itself by the heights of everything below it, so they stack upwards in the
 * order they opened — the oldest at the bottom, the newest above it, which is
 * also the order a person met them in.
 *
 * The registry is pinned to a global symbol for the same reason the toast queue
 * is: a barrel import and a deep import can resolve to two module instances,
 * and two registries would be no registry at all.
 */

export interface BarEntry {
  id: number
  /** Measured height in px, reported by the bar once it is on screen. */
  height: number
}

const STATE_KEY = Symbol.for("@leavepulse/ui:action-bar-stack")
type GlobalWithStack = typeof globalThis & {
  [STATE_KEY]?: { bars: ReturnType<typeof ref<BarEntry[]>>; nextId: number }
}
const g = globalThis as GlobalWithStack
const state = (g[STATE_KEY] ??= { bars: ref<BarEntry[]>([]), nextId: 0 })

/** Gap between stacked bars, matching the padding the bar sits in. */
export const STACK_GAP = 8

/**
 * Registers a bar for as long as the calling scope lives. `setHeight` reports
 * the measured height; `offset()` returns how far up this bar should sit —
 * the total height of every bar that opened before it.
 */
export function useBarStack() {
  const id = state.nextId++
  const bars = state.bars as ReturnType<typeof ref<BarEntry[]>>

  function register() {
    if (!bars.value!.some((b) => b.id === id)) {
      bars.value = [...bars.value!, { id, height: 0 }]
    }
  }

  function unregister() {
    bars.value = bars.value!.filter((b) => b.id !== id)
  }

  function setHeight(height: number) {
    bars.value = bars.value!.map((b) => (b.id === id ? { ...b, height } : b))
  }

  /** Sum of the heights below this one, plus a gap for each. */
  function offset(): number {
    const i = bars.value!.findIndex((b) => b.id === id)
    if (i <= 0) return 0
    return bars.value!
      .slice(0, i)
      .reduce((total, b) => total + b.height + STACK_GAP, 0)
  }

  onScopeDispose(unregister)

  return { register, unregister, setHeight, offset, bars }
}
