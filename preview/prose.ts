/*
 * Example descriptions are written as plain text with a little markup: `code`
 * in backticks, a blank line between paragraphs and "- " at the start of a list
 * line. One reader for every place that shows them, so a card's one line, the
 * palette's preview and the component page agree on what the text says.
 */

export type Inline = { text: string; code: boolean }[]
export type Block = { kind: "p"; parts: Inline } | { kind: "ul"; items: Inline[] }

function inline(text: string): Inline {
  return text.split(/`([^`]+)`/).map((part, i) => ({ text: part, code: i % 2 === 1 })).filter((part) => part.text)
}

/** The text with the markup dropped, for places that show plain words. */
export function plain(text: string): string {
  return text.replace(/`/g, "").replace(/\n+-\s+/g, " ").replace(/\s*\n\s*/g, " ").trim()
}

function flat(text: string): string {
  return text.replace(/\s*\n\s*(-\s+)?/g, " ").trim()
}

/** Where the first sentence ends, not counting a full stop inside `code`. */
function leadEnd(text: string): number {
  const cut = text.replace(/`[^`]*`/g, (code) => "x".repeat(code.length)).search(/[.!?](\s|$)/)
  return cut > 0 ? cut + 1 : text.length
}

/** The first sentence: a card's one line and the palette's lead. */
export function lead(text: string): string {
  const one = flat(text)
  return one.slice(0, leadEnd(one)).replace(/`/g, "")
}

/** Everything after the first sentence, with its `code` kept. */
export function afterLead(text: string): Inline {
  const one = flat(text)
  return inline(one.slice(leadEnd(one)).trim())
}

export function blocks(text: string): Block[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((chunk): Block => {
      const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean)
      if (lines.length && lines.every((line) => line.startsWith("- "))) {
        return { kind: "ul", items: lines.map((line) => inline(line.slice(2))) }
      }
      return { kind: "p", parts: inline(lines.join(" ")) }
    })
}
