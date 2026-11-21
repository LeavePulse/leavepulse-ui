/*
 * The case of a small caps label (a table's column headers, a contents rail's
 * heading): `upper` draws it in capitals with the letter spacing capitals need,
 * `none` leaves the text as written at normal spacing. Size, weight and colour
 * stay with the component.
 *
 * Each label reads two custom properties, `--<name>-transform` and
 * `--<name>-tracking`, whose theme-wide defaults live in tokens.css; a
 * component's own prop writes them on its element and so wins over the theme.
 */
export type LabelCase = "upper" | "none"

const CASES: Record<LabelCase, { transform: string; tracking: string }> = {
  upper: { transform: "uppercase", tracking: "0.08em" },
  none: { transform: "none", tracking: "normal" },
}

/** Inline custom properties for `--<name>-*`; nothing when the theme decides. */
export function labelCaseVars(name: string, labelCase: LabelCase | undefined): Record<string, string> | undefined {
  if (!labelCase) return undefined
  const { transform, tracking } = CASES[labelCase]
  return { [`--${name}-transform`]: transform, [`--${name}-tracking`]: tracking }
}
