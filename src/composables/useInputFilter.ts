import { computed, type MaybeRefOrGetter, toValue } from "vue"

/*
 * Cursor- and IME-safe input filtering + pattern validation for native <input>.
 *
 * Two orthogonal jobs:
 *
 *   restrict — a character class (RegExp matching ONE allowed char, e.g. /[0-9]/)
 *     that hard-blocks disallowed input. We cancel the offending `beforeinput`
 *     instead of rewriting `value` after the fact: rewriting moves the caret to
 *     the end and aborts IME composition. By vetoing the event the browser never
 *     applies the bad edit, so the caret and any in-flight composition stay put.
 *
 *   pattern — a RegExp the WHOLE value must match to be considered valid. This
 *     never blocks typing; it only drives the invalid state (border + aria), so
 *     partially-typed values aren't punished mid-entry — the caller decides when
 *     to surface it.
 *
 * A bare string pattern is treated as a full-string match (anchored), mirroring
 * the native HTML `pattern` attribute.
 */

export interface UseInputFilterOptions {
  /** One-char RegExp of allowed characters. Disallowed input is blocked. */
  restrict?: MaybeRefOrGetter<RegExp | undefined>
  /** RegExp/string the full value must match to be valid. Validation only. */
  pattern?: MaybeRefOrGetter<RegExp | string | undefined>
}

function toAnchored(p: RegExp | string): RegExp {
  if (p instanceof RegExp) {
    // Re-anchor so `pattern` validates the whole string, like HTML's attribute.
    const src = p.source.replace(/^\^/, "").replace(/\$$/, "")
    return new RegExp(`^(?:${src})$`, p.flags.replace(/[gy]/g, ""))
  }
  return new RegExp(`^(?:${p})$`)
}

/** Does a string contain only restrict-allowed characters? */
function allAllowed(text: string, charRe: RegExp): boolean {
  // Strip g/y so lastIndex can't leak state across .test() calls, then reuse
  // the one instance per char (tested by code point, so surrogate pairs hold).
  const re = new RegExp(charRe.source, charRe.flags.replace(/[gy]/g, ""))
  for (const ch of text) {
    if (!re.test(ch)) return false
  }
  return true
}

export function useInputFilter(options: UseInputFilterOptions = {}) {
  const restrict = computed(() => toValue(options.restrict))
  const patternRe = computed(() => {
    const p = toValue(options.pattern)
    return p === undefined ? undefined : toAnchored(p)
  })

  /** True when a non-empty value fails `pattern`. Empty is treated as valid. */
  function isInvalid(value: string | undefined): boolean {
    const re = patternRe.value
    if (!re || !value) return false
    return !re.test(value)
  }

  /**
   * Attach to the input's `beforeinput`. Vetoes edits that would introduce a
   * disallowed character. No-op while composing (IME) or when no restrict set.
   */
  function onBeforeInput(event: InputEvent): void {
    const re = restrict.value
    if (!re || event.isComposing) return
    // Deletions / formatting carry no data to validate; let them through.
    const data = event.data
    if (data == null) return
    if (!allAllowed(data, re)) event.preventDefault()
  }

  /**
   * Attach to `paste`. Veto the paste if any pasted char is disallowed, rather
   * than silently dropping part of it — partial pastes confuse more than help.
   */
  function onPaste(event: ClipboardEvent): void {
    const re = restrict.value
    if (!re) return
    const text = event.clipboardData?.getData("text") ?? ""
    if (text && !allAllowed(text, re)) event.preventDefault()
  }

  return { isInvalid, onBeforeInput, onPaste, patternRe, restrict }
}
