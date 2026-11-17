/*
 * The editor is described, not hand-wired. A plugin is one record that brings
 * its ProseMirror extensions together with what the UI derives from them: the
 * blocks the "/" menu, the insert menu and "Turn into" list, and the marks the
 * toolbar and the selection bubble show. Adding a block is one entry in one
 * plugin; nothing else in the editor has to learn about it.
 */
import { mergeAttributes, Node, type AnyExtension, type ChainedCommands, type Editor, type JSONContent, type MarkdownRendererHelpers, type Range } from "@tiptap/core"
import { VueNodeViewRenderer, type NodeViewProps } from "@tiptap/vue-3"
import type { Component } from "vue"

/** What a plugin's extensions may need to know about the editor they join. */
export interface EditorContext {
  /** A shared Yjs document carries the history, so the local undo stack is off. */
  collaborative: boolean
  /** The editor's own placeholder wording; `first` is the opening line of an empty document. */
  placeholder: (first: boolean) => string
}

/** Something the "/" menu, the insert menu or "Turn into" can put in the document. */
export interface EditorBlock {
  id: string
  label: string
  description?: string
  icon: string
  /** Section of the menus, a key of the editor's group labels or any text. */
  group: string
  keywords?: string[]
  insert: (chain: ChainedCommands, editor: Editor) => ChainedCommands
  /** The block the cursor is in is this one: lights it in "Turn into". */
  active?: (editor: Editor) => boolean
  /** Text-like blocks the current paragraph can be turned into. */
  convertible?: boolean
  /** Hidden from the menus while this says no (an upload with no uploader). */
  available?: (editor: Editor) => boolean
}

/** Inline value asked for before a mark applies (a link's address). */
export interface EditorMarkInput {
  placeholder: string
  read: (editor: Editor) => string
  apply: (chain: ChainedCommands, value: string) => ChainedCommands
}

/** Inline formatting: the toolbar and the selection bubble list these. */
export interface EditorMark {
  id: string
  label: string
  icon: string
  /** As LpKeys reads it: "Mod+B". */
  shortcut?: string
  toggle: (chain: ChainedCommands) => ChainedCommands
  /** Runs instead of `toggle` when the mark needs more than a click (a comment asks for its thread). */
  act?: (editor: Editor) => void
  active: (editor: Editor) => boolean
  input?: EditorMarkInput
}

/** One choice in a toolbar menu: a font, a size, a colour. */
export interface EditorMenuItem {
  id: string
  label: string
  icon?: string
  /** A colour shown as a dot in place of the icon. */
  swatch?: string
  /** Style on the label: a font's name written in that font. */
  labelStyle?: Record<string, string>
  active: (editor: Editor) => boolean
  apply: (chain: ChainedCommands) => ChainedCommands
}

/**
 * A dropdown on the toolbar and the selection bubble, for formatting that is
 * a choice among several values rather than an on/off mark (font, size,
 * colour, alignment). Items are built per editor so they can read what is
 * in force where the cursor is.
 */
export interface EditorMenu {
  id: string
  label: string
  icon: string
  items: (editor: Editor) => EditorMenuItem[]
}

/** A right-click action a plugin offers where it applies (table rows while in a table). */
export interface EditorAction {
  id: string
  label: string
  icon: string
  danger?: boolean
  run: (editor: Editor) => void
}

/** A row of a trigger's menu: a block for "/", a person or a channel for a mention. */
export interface PickItem {
  id: string
  label: string
  description?: string
  icon?: string
  image?: string
  /** Section of the menu. */
  group: string
  groupLabel?: string
  keywords?: string[]
}

/**
 * A character that opens a menu at the cursor ("/", "@", "#"). The editor
 * draws the menu; the trigger says what is in it and what picking does.
 */
export interface EditorTrigger {
  id: string
  char: string
  items: (query: string, editor: Editor) => PickItem[] | Promise<PickItem[]>
  /** The items are already matched to the query (a server search); otherwise the kit's command search ranks them. */
  searched?: boolean
  pick: (item: PickItem, editor: Editor, range: Range) => void
  /** Wording when nothing matches. */
  empty?: string
}

export interface EditorPlugin {
  id: string
  /** Right-click actions for where the cursor is now; an empty list adds nothing. */
  actions?: (editor: Editor) => EditorAction[]
  triggers?: EditorTrigger[]
  extensions?: AnyExtension[] | ((context: EditorContext) => AnyExtension[])
  blocks?: EditorBlock[]
  marks?: EditorMark[]
  menus?: EditorMenu[]
}

export interface ResolvedPlugins {
  actions: ((editor: Editor) => EditorAction[])[]
  triggers: EditorTrigger[]
  extensions: AnyExtension[]
  blocks: EditorBlock[]
  marks: EditorMark[]
  menus: EditorMenu[]
}

/** Folds plugins into one set; a later plugin's block or mark with the same id replaces the earlier one. */
export function resolvePlugins(plugins: EditorPlugin[], context: EditorContext): ResolvedPlugins {
  const blocks = new Map<string, EditorBlock>()
  const marks = new Map<string, EditorMark>()
  const menus = new Map<string, EditorMenu>()
  const extensions: AnyExtension[] = []
  const actions: ((editor: Editor) => EditorAction[])[] = []
  const triggers = new Map<string, EditorTrigger>()
  for (const plugin of plugins) {
    if (plugin.actions) actions.push(plugin.actions)
    for (const trigger of plugin.triggers ?? []) triggers.set(trigger.id, trigger)
    const own = typeof plugin.extensions === "function" ? plugin.extensions(context) : plugin.extensions
    extensions.push(...(own ?? []))
    for (const block of plugin.blocks ?? []) blocks.set(block.id, block)
    for (const mark of plugin.marks ?? []) marks.set(mark.id, mark)
    for (const menu of plugin.menus ?? []) menus.set(menu.id, menu)
  }
  return { actions, triggers: [...triggers.values()], extensions, blocks: [...blocks.values()], marks: [...marks.values()], menus: [...menus.values()] }
}

type AttrValue = string | number | boolean | null

export interface NodeBlockSpec<A extends Record<string, AttrValue>> {
  /** Node name, also the `data-type` it is stored and pasted under. */
  name: string
  /** Vue view of the node: gets TipTap's NodeViewProps (`node.attrs`, `updateAttributes`, …). */
  component: Component<NodeViewProps>
  attrs: A
  /** ProseMirror content expression; omit for a leaf (atom) block. */
  content?: string
  block: Omit<EditorBlock, "insert" | "id"> & Partial<Pick<EditorBlock, "insert" | "id">>
  extensions?: AnyExtension[]
  /** How a copy writes the block as Markdown; by default its content, a leaf writes nothing. */
  markdown?: (node: JSONContent, helpers: MarkdownRendererHelpers) => string
}

/**
 * A custom block from one description: the node, its Vue view, how it is
 * stored and pasted, and its entry in the menus. A consumer's own block (a
 * chat message preview, a quiz question) is one call of this.
 */
export function defineNodeBlock<A extends Record<string, AttrValue>>(spec: NodeBlockSpec<A>): EditorPlugin {
  const leaf = spec.content === undefined
  const node = Node.create({
    name: spec.name,
    group: "block",
    content: spec.content,
    atom: leaf,
    draggable: true,
    defining: !leaf,
    addAttributes() {
      return Object.fromEntries(
        Object.entries(spec.attrs).map(([key, fallback]) => [
          key,
          {
            default: fallback,
            parseHTML: (element: HTMLElement) => parseAttr(element.getAttribute(`data-${key}`), fallback),
            renderHTML: (attrs: Record<string, AttrValue>) => ({ [`data-${key}`]: attrs[key] }),
          },
        ]),
      )
    },
    parseHTML() {
      return [{ tag: `div[data-type="${spec.name}"]` }]
    },
    renderHTML({ HTMLAttributes }) {
      const attrs = mergeAttributes(HTMLAttributes, { "data-type": spec.name })
      return leaf ? ["div", attrs] : ["div", attrs, 0]
    },
    addNodeView() {
      return VueNodeViewRenderer(spec.component)
    },
    renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers) =>
      spec.markdown ? spec.markdown(node, helpers) : leaf ? "" : helpers.renderChildren(node.content ?? [], "\n\n"),
  })
  const filled: JSONContent = { type: spec.name, attrs: { ...spec.attrs }, ...(leaf ? {} : { content: [{ type: "paragraph" }] }) }
  return {
    id: spec.name,
    extensions: [node, ...(spec.extensions ?? [])],
    blocks: [
      {
        ...spec.block,
        id: spec.block.id ?? spec.name,
        insert: spec.block.insert ?? ((chain) => chain.insertContent(filled)),
        active: spec.block.active ?? ((editor) => editor.isActive(spec.name)),
      },
    ],
  }
}

function parseAttr(raw: string | null, fallback: AttrValue): AttrValue {
  if (raw === null) return fallback
  if (typeof fallback === "number") {
    const value = Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof fallback === "boolean") return raw === "true"
  return raw
}
