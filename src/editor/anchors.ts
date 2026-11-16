/*
 * Headings get stable DOM ids from their text, so an outline (LpTableOfContents)
 * can link and scroll-spy them. Decorations, not attributes: the ids are a
 * view of the text and never travel into the shared document.
 */
import { Extension } from "@tiptap/core"
import type { Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

export interface OutlineHeading {
  id: string
  text: string
  level: number
}

const slug = (text: string) =>
  text
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section"

export function outlineOf(doc: PmNode): (OutlineHeading & { pos: number; size: number })[] {
  const seen = new Map<string, number>()
  const out: (OutlineHeading & { pos: number; size: number })[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return true
    const base = `h-${slug(node.textContent)}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    out.push({ id: count ? `${base}-${count + 1}` : base, text: node.textContent, level: Number(node.attrs.level) || 1, pos, size: node.nodeSize })
    return false
  })
  return out
}

const KEY = new PluginKey<DecorationSet>("lpHeadingAnchors")

export const HeadingAnchors = Extension.create({
  name: "lpHeadingAnchors",
  addProseMirrorPlugins() {
    const build = (doc: PmNode) =>
      DecorationSet.create(
        doc,
        outlineOf(doc).map((heading) => Decoration.node(heading.pos, heading.pos + heading.size, { id: heading.id })),
      )
    return [
      new Plugin({
        key: KEY,
        state: {
          init: (_, state) => build(state.doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
        },
        props: { decorations: (state) => KEY.getState(state) },
      }),
    ]
  },
})
