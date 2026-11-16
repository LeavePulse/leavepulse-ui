/*
 * Comments anchored to text. The anchor is a mark carrying the thread id, so
 * it travels with the text through edits and collaborators; the thread itself
 * (messages, who, resolved) lives with the consumer. Clicking anchored text
 * opens its thread; resolving one removes its anchor.
 */
import { Extension, Mark, mergeAttributes, type Editor } from "@tiptap/core"
import { Plugin } from "@tiptap/pm/state"
import type { EditorPlugin } from "./blocks"

export interface CommentsOptions {
  /** Starts a thread for the selected text; resolves to its id, or null when cancelled. */
  create: (editor: Editor, quote: string) => Promise<string | null>
  open: (thread: string) => void
}

const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return { thread: { default: "", parseHTML: (element) => element.getAttribute("data-comment") ?? "" } }
  },
  parseHTML() {
    return [{ tag: "span[data-comment]" }]
  },
  renderHTML({ mark, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-comment": mark.attrs.thread, class: "lp-comment" }), 0]
  },
  renderMarkdown: (node, helpers) => helpers.renderChildren(node.content ?? []),
})

/** Every place the thread is anchored, for jumping to it or removing it. */
export function commentRanges(editor: Editor, thread: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.marks.some((mark) => mark.type.name === "comment" && mark.attrs.thread === thread)) {
      const last = ranges.at(-1)
      if (last && last.to === pos) last.to = pos + node.nodeSize
      else ranges.push({ from: pos, to: pos + node.nodeSize })
    }
  })
  return ranges
}

export function removeComment(editor: Editor, thread: string): void {
  const type = editor.schema.marks.comment
  if (!type) return
  const tr = editor.state.tr
  for (const range of commentRanges(editor, thread)) tr.removeMark(range.from, range.to, type.create({ thread }))
  if (tr.docChanged) editor.view.dispatch(tr)
}

export function commentsPlugin(options: CommentsOptions): EditorPlugin {
  const clicks = Extension.create({
    name: "lpCommentClicks",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleClick: (view, pos) => {
              const mark = view.state.doc.resolve(pos).marks().find((row) => row.type.name === "comment")
              if (!mark) return false
              options.open(String(mark.attrs.thread))
              return false
            },
          },
        }),
      ]
    },
  })
  return {
    id: "comments",
    extensions: [CommentMark, clicks],
    marks: [
      {
        id: "comment",
        label: "Comment",
        icon: "lucide:message-square-plus",
        shortcut: "Mod+Alt+M",
        toggle: (chain) => chain,
        active: (editor) => editor.isActive("comment"),
        act: (editor) => {
          const { from, to } = editor.state.selection
          if (from === to) return
          const quote = editor.state.doc.textBetween(from, to, " ")
          void options.create(editor, quote).then((thread) => {
            if (thread) editor.chain().focus().setTextSelection({ from, to }).setMark("comment", { thread }).run()
          })
        },
      },
    ],
  }
}
