/*
 * How a written combo splits into caps. One key per "+", except a "+" that is
 * the key itself: "Ctrl++" is Ctrl and plus, not Ctrl and two blanks. Spaces
 * separate the steps of a sequence: "G I" reads "G then I".
 */
export function comboKeys(chord: string): string[] {
  return chord.split(/\+(?!$)/)
}

export function comboSteps(combo: string): string[][] {
  const trimmed = combo.trim()
  return trimmed ? trimmed.split(/\s+/).map(comboKeys) : []
}
