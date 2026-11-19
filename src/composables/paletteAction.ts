/*
 * The palette command a button registers, without the button importing the
 * palette's registry. usePaletteCommands installs the real registration as it
 * loads; a palette scope can only be provided through that module, so before
 * it is loaded there is no scope to register in and nothing is lost.
 */
export interface PaletteActionOptions {
  label?: () => string | undefined
  element: () => HTMLElement | null | undefined
  disabled?: () => boolean
}

let register: ((options: PaletteActionOptions) => void) | null = null

/** usePaletteAction once usePaletteCommands is loaded; nothing before that. Call during setup. */
export function useOptionalPaletteAction(options: PaletteActionOptions): void {
  register?.(options)
}

/** Called by usePaletteCommands as it loads. */
export function setPaletteAction(use: (options: PaletteActionOptions) => void): void {
  register = use
}
