/*
 * Pure helpers behind LpSelect, kept out of the component so their rules are
 * testable without a DOM.
 */

/**
 * How many chips of a multiple pick fit in one row before the rest collapse
 * into a "+N" chip.
 *
 * Everything shows when everything fits. Otherwise the row keeps as many chips
 * as fit beside the "+N" chip, but never fewer than one: chips can truncate,
 * so a lone first name cut short still says more than "+3" alone would.
 */
export function fitChips(widths: readonly number[], available: number, gap: number, moreWidth: number): number {
  const n = widths.length
  if (n === 0) return 0
  let used = 0
  for (let i = 0; i < n; i++) used += widths[i]! + (i ? gap : 0)
  if (used <= available) return n
  let shown = 0
  used = moreWidth
  for (let i = 0; i < n - 1; i++) {
    used += widths[i]! + gap
    if (used > available) break
    shown = i + 1
  }
  return Math.max(1, shown)
}

/**
 * The values a multiple select's change toggled: added ones and removed ones,
 * in that order. A click toggles exactly one, but a parent swapping the model
 * between renders can move several at once.
 */
export function toggledValues<V>(previous: readonly V[], next: readonly V[]): V[] {
  const before = new Set(previous)
  const after = new Set(next)
  return [...next.filter((v) => !before.has(v)), ...previous.filter((v) => !after.has(v))]
}
