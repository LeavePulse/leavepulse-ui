import { computed, toValue, type MaybeRefOrGetter } from "vue"

/*
 * Format-as-you-type for a native <input> without losing the caret.
 *
 * A mask is a string of tokens and literals: "+0 (000) 000-00-00",
 * "0000 0000 0000 0000", "AA-0000". Each token accepts one character; anything
 * else is a literal the mask inserts itself. A backslash makes the next mask
 * character literal ("\\0" is a literal zero). A list of masks picks the first
 * one the typed characters fit, and a function derives the mask from the raw
 * value typed so far (card networks, phone plans).
 *
 * The caret is tracked by how many accepted characters sit before it, not by
 * its offset, so inserting a literal ahead of it never shoves it backwards.
 * Literals are only written once a character follows them, so Backspace walks
 * back naturally instead of hitting an auto-inserted separator.
 */

export type MaskToken = RegExp | { pattern: RegExp; transform?: (ch: string) => string }
export type MaskTokens = Record<string, MaskToken>
export type MaskSpec = string | readonly string[] | ((raw: string) => string)

export const DEFAULT_MASK_TOKENS: MaskTokens = {
  "0": /\d/,
  a: /\p{L}/u,
  A: { pattern: /\p{L}/u, transform: (ch) => ch.toLocaleUpperCase() },
  "*": /[\p{L}\d]/u,
}

type Slot = { literal: string } | { test: (ch: string) => boolean; transform: (ch: string) => string }

export interface MaskResult {
  masked: string
  raw: string
  /** Caret offset in `masked`. */
  caret: number
  /** Every token of the mask is filled. */
  complete: boolean
}

export interface MaskOptions {
  mask: MaskSpec
  tokens?: MaskTokens
  /**
   * Caret position: an offset into `input`, or with `fromRaw` the number of raw
   * characters before it. Defaults to the end.
   */
  caret?: number
  /** `input` holds raw characters only; literals in it are never consumed as mask literals. */
  fromRaw?: boolean
}

function tester(token: MaskToken): { test: (ch: string) => boolean; transform: (ch: string) => string } {
  const pattern = token instanceof RegExp ? token : token.pattern
  const re = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""))
  const transform = token instanceof RegExp ? undefined : token.transform
  return { test: (ch) => re.test(ch), transform: transform ?? ((ch) => ch) }
}

export function parseMask(mask: string, tokens: MaskTokens = DEFAULT_MASK_TOKENS): Slot[] {
  const slots: Slot[] = []
  const chars = Array.from(mask)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!
    if (ch === "\\" && i + 1 < chars.length) {
      slots.push({ literal: chars[++i]! })
      continue
    }
    const token = tokens[ch]
    slots.push(token ? tester(token) : { literal: ch })
  }
  return slots
}

interface Run extends MaskResult {
  overflow: boolean
  /** Offsets in the input of the characters consumed as tokens. */
  tokenOffsets: number[]
}

function run(slots: Slot[], input: string, caret: number, fromRaw: boolean): Run {
  const tokenStarts: number[] = []
  const tokenEnds: number[] = []
  const tokenOffsets: number[] = []
  let out = ""
  let raw = ""
  let pending = ""
  let si = 0
  let offset = 0
  let before = 0
  let overflow = false
  for (const ch of input) {
    const at = offset
    offset += ch.length
    if (si >= slots.length) {
      if (slots.some((s) => "test" in s && s.test(ch))) overflow = true
      continue
    }
    while (si < slots.length) {
      const slot = slots[si]!
      if ("literal" in slot) {
        pending += slot.literal
        si++
        if (!fromRaw && slot.literal === ch) break
        continue
      }
      if (slot.test(ch)) {
        const value = slot.transform(ch)
        out += pending
        pending = ""
        tokenStarts.push(out.length)
        out += value
        tokenEnds.push(out.length)
        raw += value
        tokenOffsets.push(at)
        si++
        if (fromRaw ? raw.length <= caret : at < caret) before++
      }
      break
    }
  }
  const rest = slots.slice(si)
  const complete = !rest.some((s) => "test" in s)
  // A fully typed mask also shows its closing literals ("(000)" ends with ")").
  if (complete && out) out += pending + rest.map((s) => ("literal" in s ? s.literal : "")).join("")
  const at = before === 0 ? (tokenStarts[0] ?? 0) : tokenEnds[before - 1]!
  return {
    masked: out,
    raw,
    caret: complete && before === tokenEnds.length ? out.length : at,
    complete,
    overflow,
    tokenOffsets,
  }
}

function resolve(options: MaskOptions, input: string, caret: number): Run {
  const tokens = options.tokens ?? DEFAULT_MASK_TOKENS
  const fromRaw = !!options.fromRaw
  const { mask } = options
  if (typeof mask === "string") return run(parseMask(mask, tokens), input, caret, fromRaw)
  if (typeof mask === "function") {
    let current = mask("")
    let result = run(parseMask(current, tokens), input, caret, fromRaw)
    for (let i = 0; i < 4; i++) {
      const next = mask(result.raw)
      if (next === current) break
      current = next
      result = run(parseMask(current, tokens), input, caret, fromRaw)
    }
    return result
  }
  let last: Run | undefined
  for (const m of mask) {
    last = run(parseMask(m, tokens), input, caret, fromRaw)
    if (!last.overflow) return last
  }
  return last ?? run([], input, caret, fromRaw)
}

/** Format `input` through a mask and map the caret into the result. */
export function applyMask(input: string, options: MaskOptions): MaskResult {
  const caret = options.caret ?? (options.fromRaw ? Number.POSITIVE_INFINITY : input.length)
  const { masked, raw, caret: at, complete } = resolve(options, input, caret)
  return { masked, raw, caret: at, complete }
}

/**
 * The value after deleting one accepted character next to a collapsed caret,
 * skipping over literals, or null when there is nothing to delete that way.
 */
export function maskDelete(
  value: string,
  caret: number,
  direction: "backward" | "forward",
  options: Omit<MaskOptions, "caret" | "fromRaw">,
): MaskResult | null {
  const { tokenOffsets, raw } = resolve(options, value, caret)
  const index =
    direction === "backward"
      ? tokenOffsets.filter((o) => o < caret).length - 1
      : tokenOffsets.findIndex((o) => o >= caret)
  if (index < 0) return null
  const chars = Array.from(raw)
  chars.splice(index, 1)
  return applyMask(chars.join(""), { ...options, caret: index, fromRaw: true })
}

export interface UseInputMaskOptions {
  mask: MaybeRefOrGetter<MaskSpec | undefined>
  tokens?: MaybeRefOrGetter<MaskTokens | undefined>
  /** Called with every value the user produces. */
  onChange?: (masked: string, raw: string, complete: boolean) => void
}

/**
 * Bind `onBeforeInput`, `onInput` and `onCompositionEnd` to the input, and show
 * `format(model).masked` as its value.
 */
export function useInputMask(options: UseInputMaskOptions) {
  const spec = computed(() => {
    const mask = toValue(options.mask)
    return mask === undefined || mask === "" ? undefined : { mask, tokens: toValue(options.tokens) }
  })

  function format(value: string | null | undefined): MaskResult {
    const s = spec.value
    const text = value ?? ""
    return s ? applyMask(text, s) : { masked: text, raw: text, caret: text.length, complete: true }
  }

  function commit(el: HTMLInputElement, result: MaskResult): void {
    if (el.value !== result.masked) el.value = result.masked
    if (el.ownerDocument.activeElement === el) {
      try {
        el.setSelectionRange(result.caret, result.caret)
      } catch {
        // Input types without a selection cannot place a caret.
      }
    }
    options.onChange?.(result.masked, result.raw, result.complete)
  }

  function onBeforeInput(event: InputEvent): void {
    const s = spec.value
    const el = event.target
    if (!s || event.isComposing || !(el instanceof HTMLInputElement)) return
    const backward = event.inputType === "deleteContentBackward"
    if (!backward && event.inputType !== "deleteContentForward") return
    const start = el.selectionStart
    if (start === null || start !== el.selectionEnd) return
    event.preventDefault()
    const result = maskDelete(el.value, start, backward ? "backward" : "forward", s)
    if (result) commit(el, result)
  }

  function reformat(el: HTMLInputElement): void {
    const s = spec.value
    if (!s) return
    commit(el, applyMask(el.value, { ...s, caret: el.selectionStart ?? el.value.length }))
  }

  /** Attach to `input`. Composition is left alone until it ends. */
  function onInput(event: Event): void {
    if ((event as InputEvent).isComposing || !(event.target instanceof HTMLInputElement)) return
    reformat(event.target)
  }

  function onCompositionEnd(event: CompositionEvent): void {
    if (event.target instanceof HTMLInputElement) reformat(event.target)
  }

  return { active: computed(() => !!spec.value), format, onBeforeInput, onInput, onCompositionEnd }
}
