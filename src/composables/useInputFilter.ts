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
 *
 * Composition cannot be vetoed (its `beforeinput` is not cancelable), and on
 * Android most keyboards compose ordinary typing, so `beforeinput` alone left
 * `restrict` doing nothing there. `onInput` and `onCompositionEnd` clean up
 * whatever got through — composed text, a drop, an autocorrect replacement —
 * keeping the caret where it was. Bind `onInput` BEFORE reading the value.
 */

export interface UseInputFilterOptions {
  /** One-char RegExp of allowed characters. Disallowed input is blocked. */
  restrict?: MaybeRefOrGetter<RegExp | undefined>
  /** RegExp/string the full value must match to be valid. Validation only. */
  pattern?: MaybeRefOrGetter<RegExp | string | undefined>
}

/**
 * Anchor a pattern to the whole string, like HTML's `pattern` attribute. The
 * source is wrapped, never edited: anchors the caller wrote stay valid inside
 * the group, while trimming a trailing `$` broke an escaped `\$` into an
 * unterminated group.
 */
export function anchorPattern(p: RegExp | string): RegExp {
  if (p instanceof RegExp) return new RegExp(`^(?:${p.source})$`, p.flags.replace(/[gy]/g, ""))
  return new RegExp(`^(?:${p})$`)
}

// Strip g/y so lastIndex can't leak state across .test() calls.
function charTester(charRe: RegExp): (ch: string) => boolean {
  const re = new RegExp(charRe.source, charRe.flags.replace(/[gy]/g, ""))
  return (ch) => re.test(ch)
}

/** Does a string contain only restrict-allowed characters? */
function allAllowed(text: string, charRe: RegExp): boolean {
  const ok = charTester(charRe)
  // By code point, so surrogate pairs hold.
  for (const ch of text) {
    if (!ok(ch)) return false
  }
  return true
}

/**
 * `text` with every disallowed character removed, and where `caret` lands once
 * the characters before it that were removed are gone.
 */
export function stripDisallowed(text: string, charRe: RegExp, caret = text.length): { text: string; caret: number } {
  const ok = charTester(charRe)
  let kept = ""
  let at = 0
  let offset = 0
  for (const ch of text) {
    if (ok(ch)) {
      kept += ch
      if (offset < caret) at += ch.length
    }
    offset += ch.length
  }
  return { text: kept, caret: at }
}

export function useInputFilter(options: UseInputFilterOptions = {}) {
  const restrict = computed(() => toValue(options.restrict))
  const patternRe = computed(() => {
    const p = toValue(options.pattern)
    return p === undefined ? undefined : anchorPattern(p)
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
    // A drop or a replacement carries its text in dataTransfer, not data.
    // Deletions / formatting carry neither; let them through.
    const data = event.data ?? event.dataTransfer?.getData("text") ?? null
    if (data == null) return
    if (!allAllowed(data, re)) event.preventDefault()
  }

  // Remove what slipped past `beforeinput`; true when the value changed.
  function sanitize(target: EventTarget | null): boolean {
    const re = restrict.value
    if (!re) return false
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return false
    const { text, caret } = stripDisallowed(target.value, re, target.selectionStart ?? target.value.length)
    if (text === target.value) return false
    target.value = text
    try {
      target.setSelectionRange(caret, caret)
    } catch {
      // Input types without a selection (number, email) cannot place a caret.
    }
    return true
  }

  /** Attach to `input`, ahead of whatever reads the value. */
  function onInput(event: Event): void {
    if ((event as InputEvent).isComposing) return
    sanitize(event.target)
  }

  /**
   * Attach to `compositionend`. Some browsers fire the last `input` before
   * this, so a cleaned value is announced with a fresh `input` event.
   */
  function onCompositionEnd(event: CompositionEvent): void {
    if (sanitize(event.target)) event.target?.dispatchEvent(new Event("input", { bubbles: true }))
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

  return { isInvalid, onBeforeInput, onInput, onCompositionEnd, onPaste, patternRe, restrict }
}
