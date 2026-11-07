import { isElement, isHTMLElement } from "./realm"

const TYPED_INPUTS = new Set(["text", "search", "email", "number", "password", "tel", "url"])

/** Where text can be typed, for a target that may sit inside one. */
export const TEXT_FIELD_SELECTOR = "input, textarea, [contenteditable]"

export interface TextEntryOptions {
  /** Which `<input>` types count. Defaults to the ones that take typed text. */
  inputType?: (type: string) => boolean
  /** A `<select>` counts too: it keeps letters and arrows for itself. */
  select?: boolean
}

/**
 * Whether the event lands in something the user is typing into. Checked off the
 * event target rather than `document.activeElement` so it stays right inside a
 * dialog's focus trap, and by tag rather than class so a field of an LpFrame
 * counts too.
 */
export function isTextEntry(target: EventTarget | null, options: TextEntryOptions = {}): boolean {
  if (!isHTMLElement(target)) return false
  if (target.isContentEditable || target.tagName === "TEXTAREA") return true
  if (options.select && target.tagName === "SELECT") return true
  if (target.tagName !== "INPUT") return false
  const { type } = target as HTMLInputElement
  return options.inputType ? options.inputType(type) : TYPED_INPUTS.has(type)
}

/** Whether the target is, or sits inside, what the selector names. */
export function inTextField(target: EventTarget | null, selector = TEXT_FIELD_SELECTOR): boolean {
  return isElement(target) && !!target.closest(selector)
}
