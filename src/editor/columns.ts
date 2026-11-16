/*
 * Side-by-side layout: a row of 2 or 3 columns, each holding any blocks (text
 * beside a picture, two pictures, a table next to its notes). On a narrow
 * screen the columns stack. Each column count is one row of COLUMN_LAYOUTS.
 */
import { mergeAttributes, Node, type JSONContent } from "@tiptap/core"
import type { EditorBlock, EditorPlugin } from "./blocks"

export const COLUMN_LAYOUTS = [
  { count: 2, icon: "lucide:columns-2" },
  { count: 3, icon: "lucide:columns-3" },
] as const

const Column = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="column"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "column", class: "lp-column" }), 0],
  renderMarkdown: (node, helpers) => helpers.renderChildren(node.content ?? [], "\n\n"),
})

const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column{2,3}",
  draggable: true,
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ HTMLAttributes, node }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "columns", class: "lp-columns", style: `--lp-columns: ${node.childCount}` }),
    0,
  ],
  renderMarkdown: (node, helpers) => helpers.renderChildren(node.content ?? [], "\n\n"),
})

const filled = (count: number): JSONContent => ({
  type: "columns",
  content: Array.from({ length: count }, () => ({ type: "column", content: [{ type: "paragraph" }] })),
})

export const columnsPlugin: EditorPlugin = {
  id: "columns",
  extensions: [Columns, Column],
  blocks: COLUMN_LAYOUTS.map(
    ({ count, icon }): EditorBlock => ({
      id: `columns${count}`,
      label: `${count} columns`,
      icon,
      group: "layout",
      keywords: ["columns", "side", "grid", "layout"],
      insert: (chain) => chain.insertContent(filled(count)),
    }),
  ),
}
