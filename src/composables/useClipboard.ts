import { onScopeDispose, ref } from "vue"
import { useToast } from "./useToast"

/*
 * "Copy this text, tell the person it worked, and don't throw if it didn't."
 *
 * Four components had grown their own version of this — LpCodeBlock with a
 * `copied` flag on a 1400ms timer, LpLogViewer with a silent swallow, the
 * colour picker with another — each wrapping `navigator.clipboard.writeText`
 * in a try/catch and each disagreeing about what the user should see. Copying
 * is never the task a person came to do; it is a step inside one, so the thing
 * that matters is the answer arriving and nothing blowing up on the way.
 *
 * Why every call is allowed to fail: the Clipboard API needs a secure context
 * and, in some browsers, a permission. It is absent over plain http, rejects
 * outside a user gesture, and is missing entirely in a non-DOM test runner.
 * Where it is missing or refuses, the old copy command is tried before
 * giving up (see `writeLegacy`). A
 * copy that cannot happen is a disappointment, not an exception, and a rejected
 * promise reaching a component means an unhandled rejection in the console of
 * an app that did nothing wrong.
 *
 * The `copied` flag is here because the other half of the feedback is the
 * button itself: a tick that replaces the copy icon for a moment reads faster
 * than any message, and the two are complementary rather than alternatives.
 */

/** The Clipboard API, where there is one and it agrees. */
async function writeAsync(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/*
 * The old copy command, for where the Clipboard API is missing or refuses.
 * Embedded Chromium (CEF in a Tauri or Electron-like shell) rejects
 * `writeText` when the host answers no permission requests, and plain http
 * has no API at all, while a copy command run inside the click still works
 * there. It copies the selection, so a throwaway text field holds the text
 * and the page's own selection and focus are put back afterwards.
 */
function writeLegacy(text: string): boolean {
  if (typeof document === "undefined") return false
  const active = document.activeElement as HTMLElement | null
  const selection = document.getSelection()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i)) : []
  const field = document.createElement("textarea")
  field.value = text
  field.setAttribute("readonly", "")
  field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none"
  document.body.appendChild(field)
  field.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  field.remove()
  if (selection) {
    selection.removeAllRanges()
    for (const range of ranges) selection.addRange(range)
  }
  active?.focus?.({ preventScroll: true })
  return ok
}

/*
 * A blob (an image, mostly) goes through `clipboard.write`. There is no old
 * command to fall back on here: the copy command only knows the selection,
 * and an image cannot be selected into a text field. Browsers take a narrow
 * set of types (PNG reliably, text/html and text/plain), so the caller
 * converts first; a type the browser refuses fails like any other refusal.
 */
async function writeBlob(blob: Blob): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })])
    return true
  } catch {
    return false
  }
}

/** How long `copied` stays true — long enough to read, short enough to not linger. */
const COPIED_MS = 1400

export interface CopyOptions {
  /**
   * Toast to raise on success. `false` (the default) stays silent, for callers
   * whose button already shows the tick and would otherwise say it twice.
   */
  toast?: string | false
  /**
   * Toast to raise when the copy fails. Defaults to silence for the same
   * reason the kit's other best-effort paths are silent: a copy that didn't
   * happen is usually obvious, and a scary red box over a blocked clipboard
   * helps nobody. Pass a string where losing the copy actually costs something.
   */
  errorToast?: string | false
}

export interface UseClipboard {
  /**
   * True for a moment after a successful copy. Bind it to swap a copy icon for
   * a tick:
   *
   * ```vue
   * <LpIcon :name="copied ? 'lucide:check' : 'lucide:copy'" />
   * ```
   */
  copied: import("vue").Ref<boolean>
  /**
   * Writes `text` to the clipboard. Resolves true on success, false when the
   * clipboard was unavailable or refused — it never rejects, so `await copy(x)`
   * is safe to call bare from an event handler.
   *
   * A `Blob` is written as itself under its own type (an image as a PNG blob),
   * for "copy image" next to "copy link".
   */
  copy: (data: string | Blob, options?: CopyOptions) => Promise<boolean>
}

/**
 * Clipboard writes with optional toast feedback.
 *
 * ```ts
 * const { copy, copied } = useClipboard()
 * copy(hex)                                  // silent; bind `copied` to a tick
 * copy(hex, { toast: "Copied #3b82f6" })     // says so
 * ```
 *
 * Defaults are per-call rather than per-instance: one component often copies
 * several things for different reasons — a menu item that should announce
 * itself, a button that shows its own tick — and hoisting the choice to the
 * composable would force those to agree.
 */
export function useClipboard(): UseClipboard {
  const copied = ref(false)
  const { success, error } = useToast()
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(data: string | Blob, options: CopyOptions = {}): Promise<boolean> {
    const { toast = false, errorToast = false } = options
    try {
      const written =
        typeof data === "string" ? (await writeAsync(data)) || writeLegacy(data) : await writeBlob(data)
      if (!written) throw new Error("clipboard unavailable")

      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => (copied.value = false), COPIED_MS)
      if (toast) success(toast)
      return true
    } catch {
      if (errorToast) error(errorToast)
      return false
    }
  }

  // The reset outlives a component that unmounts inside the window — a menu
  // that copies and closes is the ordinary case, not the exotic one.
  onScopeDispose(() => clearTimeout(timer))

  return { copied, copy }
}
