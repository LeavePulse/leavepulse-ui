import type { Random } from "./scramble"

/*
 * The typewriter's timeline as a pure state machine (LpTypewriter).
 *
 * One call advances one keystroke and says how long to wait before the next,
 * so the component only runs a timer, and a test can walk the whole cycle with
 * a fixed random source. Strings are passed as grapheme arrays: an emoji is one
 * keystroke, not two halves.
 */

export interface TypewriterState {
  /** The string being shown. */
  index: number
  /** How many of its characters are shown. */
  length: number
  phase: "typing" | "holding" | "erasing" | "done"
  /** The string to type once erasing has gone far enough. */
  to: number
}

export interface TypewriterOptions {
  /** Ms per typed character, before variance. */
  speed: number
  /** Ms per erased character. Erasing is steady: nobody holds backspace unevenly. */
  eraseSpeed: number
  /** Ms a finished string stays before it is erased. */
  hold: number
  /** Start over after the last string instead of stopping on it. */
  loop: boolean
}

export interface TypewriterStep {
  state: TypewriterState
  /** Ms until the next call. Infinity: nothing more to do. */
  wait: number
  /** Set when this step finished typing a string: its index. */
  typed?: number
}

export const typewriterStart = (): TypewriterState => ({ index: 0, length: 0, phase: "typing", to: 0 })

/**
 * A keystroke's delay: the base speed with some unevenness, and a pause after
 * punctuation, which is where a person typing actually stops.
 */
export function keystrokeDelay(char: string, speed: number, random: Random): number {
  const jitter = speed * (0.55 + 0.9 * random())
  if (/[.!?…]/.test(char)) return jitter + speed * 5
  if (/[,;:]/.test(char)) return jitter + speed * 2.5
  return jitter
}

/** Characters two strings share at the start: erasing stops there and typing goes on from it. */
export function sharedPrefix(a: string[], b: string[]): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

export function typewriterNext(
  state: TypewriterState,
  strings: string[][],
  options: TypewriterOptions,
  random: Random = Math.random,
): TypewriterStep {
  const count = strings.length
  if (!count) return { state: { ...state, phase: "done" }, wait: Infinity }
  const current = strings[state.index] ?? []

  switch (state.phase) {
    case "typing": {
      if (state.length >= current.length) return finish(state, count, options)
      const length = state.length + 1
      const next = { ...state, length }
      if (length < current.length) return { state: next, wait: keystrokeDelay(current[length - 1]!, options.speed, random) }
      return finish(next, count, options)
    }
    case "holding": {
      const to = (state.index + 1) % count
      return erase({ ...state, phase: "erasing", to }, strings, options)
    }
    case "erasing":
      return erase(state, strings, options)
    case "done":
      return { state, wait: Infinity }
  }
}

function finish(state: TypewriterState, count: number, options: TypewriterOptions): TypewriterStep {
  const last = state.index === count - 1
  if (last && !options.loop) return { state: { ...state, phase: "done" }, wait: Infinity, typed: state.index }
  return { state: { ...state, phase: "holding" }, wait: options.hold, typed: state.index }
}

function erase(state: TypewriterState, strings: string[][], options: TypewriterOptions): TypewriterStep {
  const keep = sharedPrefix(strings[state.index] ?? [], strings[state.to] ?? [])
  if (state.length > keep) {
    const length = state.length - 1
    // The last backspace is followed by a beat before typing starts again.
    return { state: { ...state, length }, wait: length > keep ? options.eraseSpeed : options.speed * 4 }
  }
  return { state: { index: state.to, length: state.length, phase: "typing", to: state.to }, wait: 0 }
}
