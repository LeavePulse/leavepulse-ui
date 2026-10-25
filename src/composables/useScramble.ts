import { computed, onScopeDispose, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type ShallowRef } from "vue"
import {
  planScramble,
  scrambleFrame,
  settledCells,
  SCRAMBLE_GLYPHS,
  type Random,
  type ScrambleCell,
  type ScrambleFrameCell,
} from "../components/scramble"
import { prefersReducedMotion } from "./easing"

/*
 * A value that "decrypts" into place: each position churns through random
 * glyphs and settles on its character.
 *
 * For values that are revealed rather than read: an API key shown after a
 * click, a hash arriving from a job, a code a user is about to copy. The churn
 * says "this was just produced" in a way a plain swap does not.
 *
 * The composable owns the clock; the frames themselves come from the pure
 * functions in components/scramble.ts. It hands back CELLS rather than only a
 * string, because a component that wants the width to hold still needs to know
 * which character each position will end as (LpScramble sizes each cell by it).
 */

export interface UseScrambleOptions {
  /** Travel time in ms. */
  duration?: MaybeRefOrGetter<number | undefined>
  /** See ScrambleOptions.order. */
  order?: MaybeRefOrGetter<"sequential" | "together" | undefined>
  /** Glyph pool. */
  glyphs?: MaybeRefOrGetter<string | undefined>
  /** Characters that never churn. Whitespace by default. */
  keep?: (char: string) => boolean
  /**
   * How often a churning position draws a new glyph, in ms. Every frame is too
   * fast to read as anything but noise; ~50 ms looks like a display cycling.
   */
  tick?: number
  /** Scramble when the source changes. Off: a change lands at once and only `play()` scrambles. */
  onChange?: MaybeRefOrGetter<boolean | undefined>
  /**
   * What shows before the first `play()`: the value (`settled`) or a static
   * mask of glyphs (`masked`), for a value that should decrypt on first sight
   * rather than flash its plain text first.
   */
  start?: "settled" | "masked"
  /** Inject for reproducible frames (tests, screenshots). */
  random?: Random
  /** Called when a run lands. */
  onDone?: () => void
}

export interface UseScramble {
  /** The positions as they are drawn now. */
  cells: Readonly<ShallowRef<ScrambleFrameCell[]>>
  /** The same as one string. */
  text: ComputedRef<string>
  /** A run is in progress. */
  running: Readonly<ShallowRef<boolean>>
  /** Scramble from what is shown now into the source value (into itself when unchanged). */
  play: () => void
  /** Land at once on the source value. */
  settle: () => void
}

export function useScramble(source: MaybeRefOrGetter<string>, options: UseScrambleOptions = {}): UseScramble {
  const random = options.random ?? Math.random
  const tick = options.tick ?? 50
  const glyphs = () => toValue(options.glyphs) || SCRAMBLE_GLYPHS

  const initial = toValue(source)
  const cells = shallowRef<ScrambleFrameCell[]>(
    options.start === "masked"
      ? scrambleFrame(planScramble(initial, initial, { duration: 1, keep: options.keep }, random), 0, random, glyphs())
      : settledCells(initial),
  )
  const running = shallowRef(false)
  const text = computed(() => cells.value.map((cell) => cell.char).join(""))

  let frame = 0
  let plan: ScrambleCell[] = []
  let started = 0
  let lastRoll = 0

  const stopFrame = () => {
    if (frame && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(frame)
    frame = 0
  }

  function settle() {
    stopFrame()
    cells.value = settledCells(toValue(source))
    if (running.value) {
      running.value = false
      options.onDone?.()
    }
  }

  function step(now: number) {
    const elapsed = now - started
    const duration = Math.max(1, toValue(options.duration) ?? 900)
    if (elapsed >= duration) return settle()
    if (now - lastRoll >= tick) {
      lastRoll = now
      cells.value = scrambleFrame(plan, elapsed, random, glyphs())
    } else {
      // Between re-rolls only the positions that just landed change, so the
      // settle front moves smoothly while the churn keeps its own rate.
      const shown = cells.value
      let changed = false
      const next = shown.map((cell, i) => {
        const p = plan[i]
        if (!cell.settled && p && (p.fixed || elapsed >= p.settleAt)) {
          changed = true
          return { char: p.final, sizer: p.final, settled: true }
        }
        return cell
      })
      if (changed) cells.value = next
    }
    frame = requestAnimationFrame(step)
  }

  function play() {
    const to = toValue(source)
    const duration = toValue(options.duration) ?? 900
    if (prefersReducedMotion() || duration <= 0 || typeof requestAnimationFrame === "undefined") return settle()
    stopFrame()
    // From what is DRAWN: a change that lands mid-run carries on from the
    // positions as they are, instead of snapping back to the old value first.
    const from = cells.value.map((cell) => cell.sizer).join("")
    plan = planScramble(from, to, { duration, order: toValue(options.order), keep: options.keep }, random)
    started = performance.now()
    lastRoll = -Infinity
    running.value = true
    frame = requestAnimationFrame(step)
  }

  watch(
    () => toValue(source),
    () => {
      if (toValue(options.onChange) === false) settle()
      else play()
    },
  )

  onScopeDispose(stopFrame)

  return { cells, text, running, play, settle }
}
