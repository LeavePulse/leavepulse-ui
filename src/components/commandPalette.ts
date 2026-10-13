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
