/*
 * The parts of LpCommandPalette that are plain logic, kept out of the SFC so
 * they can be tested without mounting a dialog.
 */

/** The fields of a command that decide whether the preview pane opens for it. */
export interface PreviewableCommand {
  preview?: string
  excerpt?: string
  noPreview?: boolean
}

/**
 * Whether the pane has something to show for a row. `noPreview` on the row
 * wins, then the app's `hasPreview`; without either, a row qualifies when the
 * app supplied a `#preview` slot or the row carries text of its own.
 */
export function commandHasPreview<T extends PreviewableCommand>(
  command: T | undefined,
  options: { slot: boolean; hasPreview?: (command: T) => boolean },
): boolean {
  if (!command || command.noPreview) return false
  if (options.hasPreview) return options.hasPreview(command)
  return options.slot || !!(command.preview || command.excerpt)
}

/** One line of LpPaletteFacts: what it is, and what it is set to now. */
export interface PaletteFact {
  label: string
  /** Right-aligned value; a change rolls in rather than swapping. */
  value?: string | number
  /** A second, quieter line under the label. */
  hint?: string
  icon?: string
  /** A colour dot in place of the icon: a role colour, a status. */
  color?: string
  /** Marks the row that is in effect now: the current theme, the open tab. */
  current?: boolean
  /** Draw the value in the monospace face: ids, paths, versions. */
  mono?: boolean
}

/** One tile of LpPaletteStats. */
export interface PaletteStat {
  label: string
  /** A number counts to its new value; text rolls. */
  value: number | string
  /** Abbreviate a number: 1.2k, 3.4M. */
  compact?: boolean
  suffix?: string
  format?: (value: number) => string
}

/** The fields of a command that let typing enter its mode. */
export interface PrefixedCommand {
  prefix?: string
  children?: unknown
  disabled?: boolean
}

/**
 * The mode a query opens by its prefix, and the query left after it. Only a
 * command with `children` and a non-empty `prefix` qualifies; letters match
 * in any case, and the longest prefix wins, so "mr " and "m" can live side by
 * side. Leading spaces are ignored: they are never what someone meant.
 */
export function matchModePrefix<T extends PrefixedCommand>(
  query: string,
  commands: readonly T[],
): { command: T; rest: string } | null {
  const typed = query.trimStart().toLowerCase()
  let best: T | null = null
  for (const command of commands) {
    const prefix = command.prefix?.toLowerCase()
    if (!prefix || !command.children || command.disabled || !typed.startsWith(prefix)) continue
    if (!best || prefix.length > (best.prefix?.length ?? 0)) best = command
  }
  if (!best) return null
  return { command: best, rest: query.trimStart().slice(best.prefix!.length) }
}
