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
 * outside a user gesture, and is missing entirely in a non-DOM test runner. A
 * copy that cannot happen is a disappointment, not an exception, and a rejected
 * promise reaching a component means an unhandled rejection in the console of
 * an app that did nothing wrong.
 *
 * The `copied` flag is here because the other half of the feedback is the
 * button itself: a tick that replaces the copy icon for a moment reads faster
 * than any message, and the two are complementary rather than alternatives.
 */

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
   */
  copy: (text: string, options?: CopyOptions) => Promise<boolean>
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

  async function copy(text: string, options: CopyOptions = {}): Promise<boolean> {
    const { toast = false, errorToast = false } = options
    try {
      // Optional-chained: `navigator.clipboard` is undefined, not throwing, on
      // an insecure origin, and that should take the same path as a rejection.
      await navigator.clipboard?.writeText(text)
      // A missing API resolves `undefined` rather than rejecting, so confirm
      // the write was actually possible before claiming it happened.
      if (!navigator.clipboard) throw new Error("clipboard unavailable")

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
