/*
 * Pure text helpers behind the "fields and text" components: grouping a code
 * for reading aloud (LpCodeDisplay, LpOtpInput) and cutting a string out of its middle (LpTruncate). Kept apart from the
 * components so the rules can be tested without a DOM.
 */

import { ceilToSecond, formatTime } from "./timeSpan"

/**
 * Splits a code into the groups a person reads it in.
 *
 * `groups` is either one size for every group ("4" → `ABCD EFGH IJ`) or the
 * exact sizes in order (`[3, 3]` → `123 456`), the latter for formats whose
 * groups differ (a licence key `5-5-5-5`, a card `4-6-5`). Characters past
 * the listed sizes form one last group rather than being dropped: a code is
 * never shown shorter than it is. Without `groups`, short codes read best in
 * threes (6 → 3+3, 8 → 4+4) and longer ones in fours.
 */
export function groupCode(code: string, groups?: number | number[]): string[] {
  const chars = Array.from(code)
  if (!chars.length) return []
  const sizes = Array.isArray(groups)
    ? groups.filter((n) => n > 0)
    : [groups && groups > 0 ? groups : autoGroup(chars.length)]
  const out: string[] = []
  let at = 0
  let i = 0
  while (at < chars.length) {
    const size = Array.isArray(groups) ? (sizes[i] ?? chars.length - at) : sizes[0]!
    out.push(chars.slice(at, at + size).join(""))
    at += size
    i++
  }
  return out
}

function autoGroup(length: number): number {
  if (length <= 4) return length
  if (length === 6 || length === 9) return 3
  if (length % 4 === 0) return 4
  if (length % 3 === 0) return 3
  return 4
}

/** Strips what people and copy-paste add to a code: spaces, dashes, dots. */
export function normalizeCode(code: string): string {
  return code.replace(/[\s\-_.·]/g, "")
}

/**
 * A remaining time the way a countdown shows it: `0:42`, `4:05`, `1:02:03`.
 * Rounded UP to the second, so "0:00" only ever appears once time is out.
 *
 * @deprecated LpCountdown's own formatting, kept for apps that imported it:
 * use `formatTime(ceilToSecond(ms), "clock")` from the time-span helpers.
 */
export function formatRemaining(ms: number): string {
  return formatTime(ceilToSecond(ms), "clock")
}

/**
 * The longest `start…end` cut of `text` that `fits`, keeping both ends.
 *
 * For identifiers whose meaning sits at both ends: a path's root and file
 * name, a hash's first and last characters people compare, a server id's
 * prefix and number. An ellipsis at the end would throw away exactly the part
 * that tells two of them apart.
 *
 * `tail` pins how many characters the end keeps (an extension, the last
 * digits); without it both ends shrink evenly. `fits` is the measurement —
 * the component passes a canvas measure of its own font — so the search
 * itself stays a pure binary search over how many characters survive.
 */
export function middleTruncate(
  text: string,
  fits: (candidate: string) => boolean,
  options: { tail?: number; ellipsis?: string } = {},
): string {
  const ellipsis = options.ellipsis ?? "…"
  const chars = Array.from(text)
  if (fits(text)) return text
  const cut = (keep: number): string => {
    const tail = options.tail !== undefined ? Math.min(options.tail, keep) : Math.floor(keep / 2)
    const head = keep - tail
    return chars.slice(0, head).join("") + ellipsis + (tail ? chars.slice(chars.length - tail).join("") : "")
  }
  let lo = 0
  let hi = chars.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (fits(cut(mid))) lo = mid
    else hi = mid - 1
  }
  return cut(lo)
}
