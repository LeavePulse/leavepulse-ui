import { onBeforeUnmount, onMounted, type MaybeRefOrGetter, toValue } from "vue"

/*
 * One keydown listener over a registry of bindings, so a shortcut is declared
 * next to the action it runs instead of growing another window-level handler.
 *
 * Three things every hand-rolled shortcut handler tends to get wrong, and the
 * reason this is worth sharing rather than rewriting per app:
 *
 *   layout — a binding names its key twice over. `key` is what the layout
 *     produced, `code` is the physical position, and either matching counts. On
 *     a Cyrillic layout Ctrl+K arrives as `key: "л"` with `code: "KeyK"`, and a
 *     user pressing the key printed "K" expects it to work either way.
 *
 *   IME — a composing input delivers every keystroke as its own event, so
 *     acting on them fires shortcuts mid-word.
 *
 *   text entry — a shortcut that steals a key from someone typing is a bug,
 *     except for the few that mean something in a field (Escape, a palette).
 *
 * Modifier note: Ctrl and Meta are one modifier here, since macOS binds ⌘ where
 * the rest bind Ctrl. Label the difference in the UI, not in the binding.
 */

export interface HotkeyBinding {
  /** Layout-produced key, compared case-insensitively ("l", "f2", "escape"). */
  key: string
  /**
   * Physical key position ("KeyL", "F2", "Digit1"). Matches on its own, which
   * is what makes non-Latin layouts work.
   */
  code?: string
  /** Ctrl on Windows/Linux, ⌘ on macOS — the two are treated as one. */
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  /**
   * Runs even while a text field has focus. Only for shortcuts that mean
   * something there — Escape, and the palette the user reaches from anywhere.
   */
  allowInInput?: boolean
  /**
   * Returning `false` declines the key: the event keeps its default and the
   * search moves on. This is what lets a binding defer to a layer that owns the
   * key better than it does — Escape belongs to whichever overlay is on top,
   * and swallowing it here would close all of them.
   */
  handler: () => void | boolean
}

/**
 * Whether this machine prints ⌘ where the rest print Ctrl. Read once: the
 * keyboard does not change under a running window, and the check is only ever
 * used to pick a label.
 */
export const isAppleKeyboard =
  typeof navigator !== "undefined"
  && /Mac|iPhone|iPad|iPod/.test(navigator.platform || "")

/**
 * The symbol to print for a modifier on this platform. Bindings treat Ctrl and
 * Meta as one modifier, so only the label may differ — never the binding.
 */
export function appleModifierLabel(key: string): string {
  if (!isAppleKeyboard) return key
  if (key === "Ctrl") return "⌘"
  if (key === "Alt") return "⌥"
  return key
}

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "number",
  "password",
  "tel",
  "url",
])

/**
 * Whether the event lands in something the user is typing into. Checked off the
 * event target rather than `document.activeElement` so it stays right inside a
 * dialog's focus trap.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type)
  }
  return false
}

function matches(event: KeyboardEvent, binding: HotkeyBinding): boolean {
  const ctrlHeld = event.ctrlKey || event.metaKey
  if (ctrlHeld !== Boolean(binding.ctrl)) return false
  if (event.shiftKey !== Boolean(binding.shift)) return false
  if (event.altKey !== Boolean(binding.alt)) return false
  return (
    event.key.toLowerCase() === binding.key.toLowerCase()
    || (binding.code !== undefined && event.code === binding.code)
  )
}

/**
 * Bind a list of hotkeys for as long as the calling component is mounted.
 *
 * The list is read on every keystroke rather than captured once, so bindings
 * may come and go with the state that owns them — a getter is the point, not a
 * formality.
 */
export function useHotkeys(bindings: MaybeRefOrGetter<HotkeyBinding[]>) {
  function onKeydown(event: KeyboardEvent) {
    if (event.isComposing) return
    const inTextEntry = isTextEntry(event.target)
    for (const binding of toValue(bindings)) {
      if (inTextEntry && !binding.allowInInput) continue
      if (!matches(event, binding)) continue
      // Claimed only once the handler has run and not declined, so a binding
      // that stands down leaves the key untouched for whoever handles it next.
      if (binding.handler() === false) continue
      event.preventDefault()
      return
    }
  }

  onMounted(() => window.addEventListener("keydown", onKeydown))
  onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown))
}
