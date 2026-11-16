/*
 * Mentions: an inline chip that keeps an id, not a name. The chip is drawn by
 * the consumer's component from that id when the document is shown, so a
 * renamed person, role or channel shows its current name everywhere it was
 * mentioned. Each kind is one row: its trigger character and its search.
 */
import { mergeAttributes, Node, type JSONContent, type MarkdownRendererHelpers } from "@tiptap/core"
import { NodeViewWrapper, VueNodeViewRenderer, nodeViewProps } from "@tiptap/vue-3"
import { defineComponent, h, type Component } from "vue"
import type { EditorPlugin, EditorTrigger, PickItem } from "./blocks"
import EditorMentionChip from "./EditorMentionChip.vue"

export interface MentionItem {
  id: string
  label: string
  description?: string
  icon?: string
  image?: string
}

export interface MentionKind {
  kind: string
  char: string
  /** Section title in the menu. */
  label: string
  icon?: string
  search: (query: string) => MentionItem[] | Promise<MentionItem[]>
}

export interface MentionChipProps {
  kind: string
  id: string
  label: string
}

export interface MentionPluginOptions {
  kinds: MentionKind[]
  /** Draws a chip from its id (a live name); the kit's chip shows the label saved with it. */
  chip?: Component<MentionChipProps>
  /** Wording when nothing matches. */
  empty?: string
}

const SEP = ":"

export function mentionPlugin(options: MentionPluginOptions): EditorPlugin {
  const chip = options.chip ?? EditorMentionChip
  const view = defineComponent({
    props: nodeViewProps,
    setup: (props) => () =>
      h(NodeViewWrapper, { as: "span", class: "lp-mention" }, () =>
        h(chip, { kind: String(props.node.attrs.kind), id: String(props.node.attrs.id), label: String(props.node.attrs.label) }),
      ),
  })
  const node = Node.create({
    name: "mention",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        kind: { default: "", parseHTML: (element) => element.getAttribute("data-kind") ?? "" },
        id: { default: "", parseHTML: (element) => element.getAttribute("data-id") ?? "" },
        label: { default: "", parseHTML: (element) => element.textContent ?? "" },
      }
    },
    parseHTML() {
      return [{ tag: "span[data-mention]" }]
    },
    renderHTML({ node: current, HTMLAttributes }) {
      return ["span", mergeAttributes(HTMLAttributes, { "data-mention": "", "data-kind": current.attrs.kind, "data-id": current.attrs.id }), String(current.attrs.label)]
    },
    renderText: ({ node: current }) => String(current.attrs.label),
    renderMarkdown: (current: JSONContent, _helpers: MarkdownRendererHelpers) => String(current.attrs?.label ?? ""),
    addNodeView() {
      return VueNodeViewRenderer(view)
    },
  })
  const chars = [...new Set(options.kinds.map((kind) => kind.char))]
  const triggers: EditorTrigger[] = chars.map((char) => {
    const kinds = options.kinds.filter((kind) => kind.char === char)
    return {
      id: `mention${char}`,
      char,
      searched: true,
      empty: options.empty,
      items: async (query) => {
        const found = await Promise.all(kinds.map(async (kind) => ({ kind, rows: await kind.search(query) })))
        return found.flatMap(({ kind, rows }) =>
          rows.map((row): PickItem => ({ ...row, id: `${kind.kind}${SEP}${row.id}`, icon: row.icon ?? kind.icon, group: kind.kind, groupLabel: kind.label })),
        )
      },
      pick: (item, editor, range) => {
        const at = item.id.indexOf(SEP)
        const attrs = { kind: item.id.slice(0, at), id: item.id.slice(at + 1), label: item.label }
        editor.chain().focus().insertContentAt(range, [{ type: "mention", attrs }, { type: "text", text: " " }]).run()
      },
    }
  })
  return { id: "mentions", extensions: [node], triggers }
}
