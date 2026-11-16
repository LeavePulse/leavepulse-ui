/*
 * Markdown in and out, and Obsidian's mixed mode. The document stays rich
 * (blocks and marks, which is what collaborators share); Markdown is how text
 * enters and leaves it:
 *
 *   - typing `## `, `**bold**`, `- `, `> `, ``` and `[ ]` is turned into the
 *     block or mark as you type (TipTap's input rules, already in textPlugin);
 *   - pasted plain text that reads as Markdown becomes blocks, and a copy
 *     carries Markdown as its plain-text half;
 *   - the syntax of what the cursor is in shows faintly around it (the `##` of
 *     its heading, the `**` around the bold word under it), and Backspace at
 *     the start of a heading or quote turns it back into that text.
 *
 * What shows for each mark and block is one row of LIVE_MARKS / LIVE_BLOCKS.
 */
import { Extension, type Editor } from "@tiptap/core"
import { Markdown } from "@tiptap/markdown"
import type { Mark, Node as PmNode, ResolvedPos } from "@tiptap/pm/model"
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { EditorPlugin } from "./blocks"

export const LIVE_MARKS: Record<string, (mark: Mark) => [string, string]> = {
  bold: () => ["**", "**"],
  italic: () => ["_", "_"],
  strike: () => ["~~", "~~"],
  code: () => ["`", "`"],
  highlight: () => ["==", "=="],
  underline: () => ["<u>", "</u>"],
  link: (mark) => ["[", `](${String(mark.attrs.href ?? "")})`],
}

export const LIVE_BLOCKS: Record<string, (node: PmNode) => string> = {
  heading: (node) => `${"#".repeat(Number(node.attrs.level) || 1)} `,
  blockquote: () => "> ",
}

export const MARKDOWN_HINT = /^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|- \[[ x]\]\s)|\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|~~[^~]+~~/m

interface Marker {
  pos: number
  text: string
  side: -1 | 1
}

const LEAVE_MS = 180

const same = (a: Marker, b: Marker) => a.pos === b.pos && a.text === b.text && a.side === b.side

function widget(marker: Marker, leaving: boolean) {
  const render = () => {
    const outer = document.createElement("span")
    outer.className = leaving ? "lp-live-syntax lp-live-leaving" : "lp-live-syntax"
    const inner = document.createElement("span")
    inner.textContent = marker.text
    outer.append(inner)
    return outer
  }
  return Decoration.widget(marker.pos, render, {
    side: marker.side,
    key: `${leaving ? "out" : "in"}:${marker.side}:${marker.text}`,
    ignoreSelection: true,
  })
}

function quoteOf($pos: ResolvedPos): number | null {
  for (let depth = $pos.depth; depth > 0; depth--) if ($pos.node(depth).type.name === "blockquote") return depth
  return null
}

function liveMarkers(state: EditorState): Marker[] {
  const { selection } = state
  if (!selection.empty) return []
  const $from = selection.$from
  const block = $from.parent
  if (!block.isTextblock) return []
  const start = $from.start()
  const found: Marker[] = []
  const prefix = LIVE_BLOCKS[block.type.name]
  if (prefix) found.push({ pos: start, text: prefix(block), side: -1 })
  const quote = quoteOf($from)
  if (quote !== null && $from.index(quote) === 0 && $from.depth === quote + 1) found.push({ pos: start, text: LIVE_BLOCKS.blockquote!(block), side: -1 })

  const cursor = $from.parentOffset
  const spans = new Map<string, { mark: Mark; from: number; to: number }>()
  const open: { mark: Mark; from: number; to: number }[] = []
  block.forEach((child, offset) => {
    for (const mark of child.marks) {
      if (!LIVE_MARKS[mark.type.name]) continue
      const key = `${mark.type.name}:${JSON.stringify(mark.attrs)}`
      const span = spans.get(key)
      if (span && span.to === offset) span.to = offset + child.nodeSize
      else {
        const next = { mark, from: offset, to: offset + child.nodeSize }
        spans.set(key, next)
        open.push(next)
      }
    }
  })
  for (const span of open) {
    if (cursor < span.from || cursor > span.to) continue
    const [before, after] = LIVE_MARKS[span.mark.type.name]!(span.mark)
    found.push({ pos: start + span.from, text: before, side: -1 }, { pos: start + span.to, text: after, side: 1 })
  }
  return found
}

interface LiveState {
  shown: Marker[]
  leaving: Marker[]
}

const LIVE_KEY = new PluginKey<LiveState>("lpLivePreview")

const LiveSyntax = Extension.create({
  name: "lpLiveSyntax",
  addProseMirrorPlugins() {
    const editor = this.editor
    const current = (state: EditorState) => (editor.isEditable ? liveMarkers(state) : [])
    return [
      new Plugin<LiveState>({
        key: LIVE_KEY,
        state: {
          init: (_, state) => ({ shown: current(state), leaving: [] }),
          apply: (tr, old, _before, state) => {
            const shown = current(state)
            if (tr.getMeta(LIVE_KEY) === "settle") return { shown, leaving: [] }
            const moved = (marker: Marker) => ({ ...marker, pos: tr.mapping.map(marker.pos, marker.side) })
            const gone = [...old.shown, ...old.leaving].map(moved).filter((marker) => !shown.some((next) => same(next, marker)))
            if (!tr.docChanged && !tr.selectionSet && gone.length === old.leaving.length) return { shown, leaving: old.leaving }
            return { shown, leaving: tr.docChanged ? [] : gone }
          },
        },
        props: {
          decorations: (state) => {
            const live = LIVE_KEY.getState(state)
            if (!live || (!live.shown.length && !live.leaving.length)) return DecorationSet.empty
            return DecorationSet.create(state.doc, [...live.leaving.map((marker) => widget(marker, true)), ...live.shown.map((marker) => widget(marker, false))])
          },
        },
        view: () => {
          let timer: ReturnType<typeof setTimeout> | undefined
          return {
            update: (view) => {
              if (!LIVE_KEY.getState(view.state)?.leaving.length || timer) return
              timer = setTimeout(() => {
                timer = undefined
                if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(LIVE_KEY, "settle").setMeta("addToHistory", false))
              }, LEAVE_MS)
            },
            destroy: () => clearTimeout(timer),
          }
        },
      }),
    ]
  },
  addKeyboardShortcuts() {
    const unwrap = (editor: Editor) => {
      const { selection } = editor.state
      if (!selection.empty || selection.$from.parentOffset !== 0) return false
      const $from = selection.$from
      const block = $from.parent
      const heading = block.type.name === "heading" ? LIVE_BLOCKS.heading!(block) : null
      if (heading) return editor.chain().setParagraph().insertContent(heading).run()
      const quote = quoteOf($from)
      if (quote !== null && $from.index(quote) === 0 && $from.depth === quote + 1) return editor.chain().lift("blockquote").insertContent(LIVE_BLOCKS.blockquote!(block)).run()
      return false
    }
    return { Backspace: ({ editor }) => unwrap(editor) }
  },
})

const MarkdownIO = Extension.create({
  name: "lpMarkdownIO",
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const data = event?.clipboardData
            const text = data?.getData("text/plain") ?? ""
            if (!text || data?.getData("text/html") || !MARKDOWN_HINT.test(text)) return false
            if (editor.state.selection.$from.parent.type.spec.code) return false
            return editor.commands.insertContent(text, { contentType: "markdown" })
          },
          clipboardTextSerializer: (slice) => editor.markdown?.serialize({ type: "doc", content: slice.content.toJSON() as [] }) ?? slice.content.textBetween(0, slice.content.size, "\n\n"),
        },
      }),
    ]
  },
})

/** Markdown paste and copy, and `editor.getMarkdown()`. */
export const markdownPlugin: EditorPlugin = {
  id: "markdown",
  extensions: [Markdown, MarkdownIO],
}

/** Obsidian's mixed mode: the syntax of what the cursor is in, shown in place. Needs markdownPlugin's input rules only. */
export const livePreviewPlugin: EditorPlugin = {
  id: "livePreview",
  extensions: [LiveSyntax],
}
