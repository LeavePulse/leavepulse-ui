/*
 * The bridge between reka PinInput's per-cell array and LpOtpInput's string
 * model. reka empties a cell by deleting its slot (numeric mode) or setting it
 * to "", so the array can have holes in the middle.
 */
export type OtpCells = (string | number | undefined)[]

/** The code typed so far: the filled cells in order. */
export function joinCells(cells: OtpCells): string {
  return Array.from(cells, (c) => (c === undefined ? "" : String(c))).join("")
}

/** Cells for a code given from outside, one character each. */
export function splitCode(code: string | undefined, length: number): string[] {
  return (code ?? "").split("").slice(0, length)
}
