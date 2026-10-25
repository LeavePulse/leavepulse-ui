import { graphemes } from "./scramble"

/*
 * Splitting text into the pieces an entrance animates (LpTextReveal).
 *
 * Words are the unit of identity: each gets a key from its text and how many
 * times that text appeared before it, so when the sentence changes the words
 * that are still there keep their key (and their DOM node, and do not replay),
 * and only the new ones animate in. Keying by position instead would replay
 * every word after an insertion.
 *
 * Whitespace is kept as its own piece and is never animated: it stays a real
 * space in the flow, which is what lets the line wrap between words. Letters
 * of one word stay inside that word's box, so letter mode never breaks a word
 * across lines.
 */

export interface TextWord {
  kind: "word"
  /** Stable across edits for the same word in the same order. */
  key: string
  text: string
  /** Letters (graphemes), or the whole word as one piece in word mode. */
  parts: string[]
}

export interface TextSpace {
  kind: "space"
  key: string
  text: string
}

export type TextPiece = TextWord | TextSpace

export function splitText(text: string, by: "word" | "letter"): TextPiece[] {
  const pieces: TextPiece[] = []
  const seen = new Map<string, number>()
  let spaces = 0
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue
    if (/^\s+$/.test(token)) {
      pieces.push({ kind: "space", key: `s${spaces++}`, text: token })
      continue
    }
    const n = seen.get(token) ?? 0
    seen.set(token, n + 1)
    pieces.push({ kind: "word", key: `${token}#${n}`, text: token, parts: by === "letter" ? graphemes(token) : [token] })
  }
  return pieces
}

/** Keys of the words in `pieces`. */
export function wordKeys(pieces: TextPiece[]): Set<string> {
  return new Set(pieces.filter((p) => p.kind === "word").map((p) => p.key))
}
