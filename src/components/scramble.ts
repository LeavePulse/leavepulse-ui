/*
 * Frame generation for the "decrypt" effect (LpScramble, useScramble).
 *
 * Kept pure and clock-free so it can be tested frame by frame: a plan says WHEN
 * each position settles, and a frame is the text at a given moment. The caller
 * owns time and randomness — the composable feeds `performance.now()` and
 * `Math.random`, a test feeds fixed numbers and a seeded generator and gets the
 * same frames every run.
 */

/** Random number in [0, 1). Injected so frames are reproducible under test. */
export type Random = () => number

/** Glyphs a position cycles through before it settles. Upper case and digits read as "code". */
export const SCRAMBLE_GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=?@$"

export interface ScrambleOptions {
  /** Total travel time in ms, from the first glyph to the last position settling. */
  duration: number
  /**
   * `sequential` settles left to right, which reads as decoding; `together`
   * holds every position until near the end and lands them in a short burst,
   * which reads as a lock opening.
   */
  order?: "sequential" | "together"
  /** Glyph pool. */
  glyphs?: string
  /**
   * Characters that never scramble: a space or a dash in a key keeps the
   * grouping visible while the rest churns, so the reader sees the shape of
   * what is coming.
   */
  keep?: (char: string) => boolean
}

export interface ScrambleCell {
  /** The character settled into, or "" for a position the new value no longer has. */
  final: string
  /** The character shown before the run started (sizes a position the value is losing). */
  initial: string
  /** Ms from the start of the run when this position shows `final`. */
  settleAt: number
  /** Never churns (see `keep`). */
  fixed: boolean
}

export interface ScrambleFrameCell {
  /** What to draw now. */
  char: string
  /** The character that gives the position its width: the final one, or the old one while it is leaving. */
  sizer: string
  settled: boolean
}

const defaultKeep = (char: string) => /\s/.test(char)

/**
 * Splits into user-perceived characters, so an emoji or an accented letter is
 * one position rather than two halves that scramble separately.
 */
export function graphemes(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment)
  return Array.from(text)
}

/**
 * When each position stops churning (all of them start at once).
 *
 * `sequential`: positions start together and settle on a ramp across the last
 * 70% of the run, so the left of the value is readable while the right still
 * moves. `together`: every position settles within the last 15%, with a
 * little random spread so they do not land as one flat click.
 */
export function planScramble(from: string, to: string, options: ScrambleOptions, random: Random = Math.random): ScrambleCell[] {
  const keep = options.keep ?? defaultKeep
  const a = graphemes(from)
  const b = graphemes(to)
  const length = Math.max(a.length, b.length)
  const duration = Math.max(0, options.duration)
  const cells: ScrambleCell[] = []
  for (let i = 0; i < length; i++) {
    const final = b[i] ?? ""
    const initial = a[i] ?? ""
    let settleAt: number
    if (options.order === "together") settleAt = duration * (0.85 + 0.15 * random())
    else settleAt = length === 1 ? duration : duration * (0.3 + (0.7 * i) / (length - 1))
    // A kept character (a space in a grouped key) stays put when it is there
    // before and after, so the grouping holds while the rest churns.
    const fixed = final !== "" && keep(final) && (initial === final || initial === "")
    cells.push({ final, initial, settleAt: fixed ? 0 : settleAt, fixed })
  }
  return cells
}

/** A glyph from the pool. */
export function randomGlyph(random: Random, glyphs: string = SCRAMBLE_GLYPHS): string {
  const pool = graphemes(glyphs)
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] ?? ""
}

/**
 * The text at `elapsed` ms into the run. A churning position draws a fresh
 * random glyph each call; the caller decides how often to call (the glyph
 * re-roll rate), not this.
 */
export function scrambleFrame(
  cells: ScrambleCell[],
  elapsed: number,
  random: Random = Math.random,
  glyphs: string = SCRAMBLE_GLYPHS,
): ScrambleFrameCell[] {
  return cells.map((cell) => {
    const sizer = cell.final || cell.initial
    if (cell.fixed || elapsed >= cell.settleAt) return { char: cell.final, sizer: cell.final, settled: true }
    return { char: randomGlyph(random, glyphs), sizer, settled: false }
  })
}

/** The cells of a value at rest, for the first paint and for reduced motion. */
export function settledCells(text: string): ScrambleFrameCell[] {
  return graphemes(text).map((char) => ({ char, sizer: char, settled: true }))
}

/**
 * A small seeded generator (mulberry32), for tests and for a scramble that
 * should look the same every time it plays (a demo, a screenshot).
 */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
