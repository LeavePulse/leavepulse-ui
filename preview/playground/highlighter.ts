import { createHighlighter, type Highlighter } from "shiki"

// Lazy singleton — shiki is heavy, load once.
let hl: Highlighter | null = null
let pending: Promise<Highlighter> | null = null

export async function getHighlighter(): Promise<Highlighter> {
  if (hl) return hl
  if (!pending) {
    pending = createHighlighter({
      themes: ["vitesse-dark"],
      langs: ["vue-html", "vue"],
    }).then((h) => (hl = h))
  }
  return pending
}
