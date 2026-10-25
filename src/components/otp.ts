/*
 * The bridge between reka PinInput's per-cell array and LpOtpInput's string
 * model. reka empties a cell by deleting its slot (numeric mode) or setting it
 * to "", so the array can have holes in the middle.
 */
import { groupCode } from "./fieldText"

export type OtpCells = (string | number | undefined)[]

/** The code typed so far: the filled cells in order. */
export function joinCells(cells: OtpCells): string {
  return Array.from(cells, (c) => (c === undefined ? "" : String(c))).join("")
}

/** Cells for a code given from outside, one character each. */
export function splitCode(code: string | undefined, length: number): string[] {
  return (code ?? "").split("").slice(0, length)
}

/*
 * Upper-case every filled cell, keeping the holes where they are.
 *
 * A phone opens its keyboard in lower case while backup and pairing codes are
 * printed in capitals, so a code typed letter by letter came out "ab12cd"
 * against an "AB12CD" on screen: a difference the reader cannot fix by looking,
 * and one a server comparing exactly rejects.
 */
export function upperCells<T extends OtpCells>(cells: T): T {
  const out = [] as unknown as T
  cells.forEach((c, i) => {
    out[i] = typeof c === "string" ? c.toUpperCase() : c
  })
  out.length = cells.length
  return out
}

/*
 * The cell indexes a group separator follows: after every `group` cells, never
 * after the last. Eight characters are read and copied as two blocks of four,
 * which is how such codes are printed, far more easily than as one row.
 *
 * The blocks are LpCodeDisplay's (`groupCode`), so a code shown by one and
 * typed into the other breaks in the same places; exact sizes (`[4, 6, 5]`)
 * work here too. Unlike there, no `group` means no breaks: an input does not
 * guess a grouping the printed code may not have.
 */
export function groupBreaks(length: number, group: number | number[] | undefined): Set<number> {
  const breaks = new Set<number>()
  if (Array.isArray(group) ? !group.some((n) => n > 0) : !group || group < 1) return breaks
  let at = 0
  for (const block of groupCode("x".repeat(Math.max(0, length)), group)) {
    at += block.length
    if (at < length) breaks.add(at - 1)
  }
  return breaks
}
