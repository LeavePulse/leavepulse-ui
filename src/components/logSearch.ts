/*
 * The log viewer's search and filtering, kept free of the component so the
 * rules (what counts as a match, how the cursor wraps) can be tested alone.
 */

/** The last `max` lines, and how many were cut from the front. */
export function ringWindow<T>(lines: readonly T[], max: number | undefined): { lines: readonly T[]; offset: number } {
  if (!max || max <= 0 || lines.length <= max) return { lines, offset: 0 }
  return { lines: lines.slice(lines.length - max), offset: lines.length - max }
}

/** Lines per level, a line with no level counting as `fallback`. */
export function countLevels<L extends string>(
  lines: readonly { level?: L }[],
  fallback: L,
): Map<L, number> {
  const counts = new Map<L, number>()
  for (const line of lines) {
    const level = line.level ?? fallback
    counts.set(level, (counts.get(level) ?? 0) + 1)
  }
  return counts
}

/** Case-insensitive substring test; an empty term matches nothing. */
export function matchesTerm(message: string, term: string): boolean {
  const needle = term.trim().toLowerCase()
  return needle.length > 0 && message.toLowerCase().includes(needle)
}

/** Positions (into `rows`) of the rows whose message or source holds the term. */
export function matchPositions(rows: readonly { message: string; source?: string }[], term: string): number[] {
  if (!term.trim()) return []
  const out: number[] = []
  rows.forEach((row, i) => {
    if (matchesTerm(row.message, term) || (row.source !== undefined && matchesTerm(row.source, term))) out.push(i)
  })
  return out
}

/** The next match cursor, wrapping at both ends; -1 when there are none. */
export function stepMatch(current: number, total: number, direction: 1 | -1): number {
  if (total <= 0) return -1
  if (current < 0 || current >= total) return direction === 1 ? 0 : total - 1
  return (current + direction + total) % total
}
