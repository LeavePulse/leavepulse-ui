/*
 * The kit's stock plugins. Each is a description: extensions plus the blocks
 * and marks the menus derive from them. `defaultEditorPlugins()` is what an
 * editor gets when it is given nothing; a consumer adds its own plugins after
 * these (or replaces one by id).
 */
import { Extension, type Editor } from "@tiptap/core"
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details"
import Highlight from "@tiptap/extension-highlight"
import Image from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TableKit } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import { Placeholder } from "@tiptap/extensions"
import { Plugin } from "@tiptap/pm/state"
import StarterKit from "@tiptap/starter-kit"
import { VueNodeViewRenderer } from "@tiptap/vue-3"
import { defineNodeBlock, type EditorBlock, type EditorPlugin } from "./blocks"
import { h, render } from "vue"
import LpIcon from "../components/LpIcon.vue"
import EditorCallout from "./EditorCallout.vue"
import EditorImage from "./EditorImage.vue"
import EditorTaskItem from "./EditorTaskItem.vue"
import { columnsPlugin } from "./columns"
import { livePreviewPlugin, markdownPlugin } from "./markdown"

const heading = (level: 1 | 2 | 3, icon: string, keywords: string[]): EditorBlock => ({
  id: `heading${level}`,
  label: `Heading ${level}`,
  icon,
  group: "text",
  keywords: ["h" + level, "title", ...keywords],
  convertible: true,
  insert: (chain) => chain.setNode("heading", { level }),
  active: (editor) => editor.isActive("heading", { level }),
})

export interface TextPluginOptions {
  /** What an empty line says, instead of the editor's own wording. */
  placeholder?: (editor: Editor, first: boolean) => string
}

export function textPlugin(options: TextPluginOptions = {}): EditorPlugin {
  return {
    id: "text",
    extensions: ({ collaborative, placeholder }) => [
      StarterKit.configure({
        undoRedo: collaborative ? false : undefined,
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        includeChildren: true,
        placeholder: ({ editor, pos }) => {
          const first = editor.isEmpty && pos === 0
          return options.placeholder?.(editor, first) ?? placeholder(first)
        },
      }),
    ],
    blocks: [
      {
        id: "paragraph",
        label: "Text",
        icon: "lucide:pilcrow",
        group: "text",
        keywords: ["p", "paragraph", "plain"],
        convertible: true,
        insert: (chain) => chain.setParagraph(),
        active: (editor) => editor.isActive("paragraph"),
      },
      heading(1, "lucide:heading-1", ["big"]),
      heading(2, "lucide:heading-2", ["medium"]),
      heading(3, "lucide:heading-3", ["small"]),
      {
        id: "quote",
        label: "Quote",
        icon: "lucide:text-quote",
        group: "text",
        keywords: ["blockquote", "cite"],
        convertible: true,
        insert: (chain) => chain.toggleBlockquote(),
        active: (editor) => editor.isActive("blockquote"),
      },
      {
        id: "codeBlock",
        label: "Code",
        icon: "lucide:square-code",
        group: "text",
        keywords: ["pre", "snippet"],
        convertible: true,
        insert: (chain) => chain.toggleCodeBlock(),
        active: (editor) => editor.isActive("codeBlock"),
      },
      {
        id: "divider",
        label: "Divider",
        icon: "lucide:minus",
        group: "layout",
        keywords: ["hr", "line", "separator"],
        insert: (chain) => chain.setHorizontalRule(),
      },
      {
        id: "bulletList",
        label: "Bulleted list",
        icon: "lucide:list",
        group: "lists",
        keywords: ["ul", "bullets"],
        convertible: true,
        insert: (chain) => chain.toggleBulletList(),
        active: (editor) => editor.isActive("bulletList"),
      },
      {
        id: "orderedList",
        label: "Numbered list",
        icon: "lucide:list-ordered",
        group: "lists",
        keywords: ["ol", "numbers", "steps"],
        convertible: true,
        insert: (chain) => chain.toggleOrderedList(),
        active: (editor) => editor.isActive("orderedList"),
      },
    ],
    marks: [
      { id: "bold", label: "Bold", icon: "lucide:bold", shortcut: "Mod+B", toggle: (c) => c.toggleBold(), active: (e) => e.isActive("bold") },
      { id: "italic", label: "Italic", icon: "lucide:italic", shortcut: "Mod+I", toggle: (c) => c.toggleItalic(), active: (e) => e.isActive("italic") },
      { id: "underline", label: "Underline", icon: "lucide:underline", shortcut: "Mod+U", toggle: (c) => c.toggleUnderline(), active: (e) => e.isActive("underline") },
      { id: "strike", label: "Strikethrough", icon: "lucide:strikethrough", shortcut: "Mod+Shift+S", toggle: (c) => c.toggleStrike(), active: (e) => e.isActive("strike") },
      { id: "code", label: "Inline code", icon: "lucide:code", shortcut: "Mod+E", toggle: (c) => c.toggleCode(), active: (e) => e.isActive("code") },
      { id: "highlight", label: "Highlight", icon: "lucide:highlighter", shortcut: "Mod+Shift+H", toggle: (c) => c.toggleHighlight(), active: (e) => e.isActive("highlight") },
      {
        id: "link",
        label: "Link",
        icon: "lucide:link",
        shortcut: "Mod+K",
        toggle: (c) => c.unsetLink(),
        active: (e) => e.isActive("link"),
        input: {
          placeholder: "https://",
          read: (editor) => String(editor.getAttributes("link").href ?? ""),
          apply: (chain, value) => (value.trim() ? chain.extendMarkRange("link").setLink({ href: value.trim() }) : chain.extendMarkRange("link").unsetLink()),
        },
      },
    ],
  }
}

export const taskListPlugin: EditorPlugin = {
  id: "tasks",
  extensions: [
    TaskList,
    TaskItem.extend({
      addNodeView() {
        return VueNodeViewRenderer(EditorTaskItem)
      },
    }).configure({ nested: true }),
  ],
  blocks: [
    {
      id: "taskList",
      label: "Checklist",
      icon: "lucide:list-checks",
      group: "lists",
      keywords: ["todo", "task", "checkbox"],
      convertible: true,
      insert: (chain) => chain.toggleTaskList(),
      active: (editor) => editor.isActive("taskList"),
    },
  ],
}

const tableAction = (id: string, label: string, icon: string, run: (editor: Editor) => boolean, danger = false) => ({
  id,
  label,
  icon,
  danger,
  run: (editor: Editor) => void run(editor),
})

export const tablePlugin: EditorPlugin = {
  id: "table",
  actions: (editor) =>
    editor.isActive("table")
      ? [
          tableAction("addRowAfter", "Add row below", "lucide:between-horizontal-end", (e) => e.chain().focus().addRowAfter().run()),
          tableAction("addColumnAfter", "Add column right", "lucide:between-vertical-end", (e) => e.chain().focus().addColumnAfter().run()),
          tableAction("toggleHeaderRow", "Header row", "lucide:panel-top", (e) => e.chain().focus().toggleHeaderRow().run()),
          tableAction("deleteRow", "Delete row", "lucide:trash-2", (e) => e.chain().focus().deleteRow().run(), true),
          tableAction("deleteColumn", "Delete column", "lucide:trash-2", (e) => e.chain().focus().deleteColumn().run(), true),
          tableAction("deleteTable", "Delete table", "lucide:table", (e) => e.chain().focus().deleteTable().run(), true),
        ]
      : [],
  extensions: [TableKit.configure({ table: { resizable: true } })],
  blocks: [
    {
      id: "table",
      label: "Table",
      icon: "lucide:table",
      group: "layout",
      keywords: ["grid", "rows", "columns"],
      insert: (chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
    },
  ],
}

export const togglePlugin: EditorPlugin = {
  id: "toggle",
  extensions: [
    Details.configure({
      persist: true,
      renderToggleButton: ({ element, isOpen }) => {
        if (!element.firstElementChild) render(h(LpIcon, { name: "lucide:chevron-right", class: "size-4" }), element)
        element.setAttribute("aria-expanded", String(isOpen))
      },
    }),
    DetailsSummary,
    DetailsContent,
  ],
  blocks: [
    {
      id: "toggle",
      label: "Toggle",
      icon: "lucide:list-collapse",
      group: "layout",
      keywords: ["details", "collapse", "spoiler", "accordion"],
      insert: (chain) => chain.setDetails(),
      active: (editor) => editor.isActive("details"),
    },
  ],
}

export const calloutPlugin: EditorPlugin = defineNodeBlock({
  name: "callout",
  component: EditorCallout,
  attrs: { tone: "info" },
  content: "block+",
  block: { label: "Callout", icon: "lucide:info", group: "layout", keywords: ["note", "tip", "warning", "alert"] },
  markdown: (node, helpers) => helpers.wrapInBlock("> ", `[!${String(node.attrs?.tone ?? "info")}]\n${helpers.renderChildren(node.content ?? [], "\n\n")}`),
})

const PlacedImage = Image.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: (element) => Number(element.getAttribute("data-width")) || null, renderHTML: (attrs) => (attrs.width ? { "data-width": attrs.width } : {}) },
      align: { default: "center", parseHTML: (element) => element.getAttribute("data-align") ?? "center", renderHTML: (attrs) => ({ "data-align": attrs.align }) },
      caption: { default: "", parseHTML: (element) => element.getAttribute("data-caption") ?? "", renderHTML: (attrs) => (attrs.caption ? { "data-caption": attrs.caption } : {}) },
    }
  },
  addNodeView() {
    return VueNodeViewRenderer(EditorImage)
  },
})

export interface ImagePluginOptions {
  /** Stores a file and resolves to the address the document keeps. */
  upload: (file: File) => Promise<string>
  accept?: string
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** Images go through the consumer's uploader: picked from the menu, pasted or dropped. */
export function imagePlugin(options: ImagePluginOptions): EditorPlugin {
  const accept = options.accept ?? "image/*"
  const place = async (editor: Editor, file: File, at?: number) => {
    const src = await options.upload(file)
    const chain = editor.chain().focus()
    ;(at === undefined ? chain : chain.setTextSelection(at)).setImage({ src, alt: file.name }).run()
  }
  const images = (files: FileList | null | undefined) => [...(files ?? [])].filter((file) => file.type.startsWith("image/"))
  const intake = Extension.create({
    name: "imageIntake",
    addProseMirrorPlugins() {
      const editor = this.editor
      return [
        new Plugin({
          props: {
            handlePaste: (_view, event) => {
              const files = images(event?.clipboardData?.files)
              files.forEach((file) => void place(editor, file))
              return files.length > 0
            },
            handleDrop: (view, event) => {
              const files = images(event.dataTransfer?.files)
              if (!files.length) return false
              const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
              files.forEach((file) => void place(editor, file, at))
              return true
            },
          },
        }),
      ]
    },
  })
  return {
    id: "image",
    extensions: [PlacedImage.configure({ allowBase64: false }), intake],
    blocks: [
      {
        id: "image",
        label: "Image",
        icon: "lucide:image",
        group: "media",
        keywords: ["picture", "photo", "upload"],
        insert: (chain, editor) => {
          void pickFile(accept).then((file) => (file ? place(editor, file) : undefined))
          return chain
        },
      },
    ],
  }
}

export interface DefaultPluginOptions extends TextPluginOptions {
  upload?: ImagePluginOptions["upload"]
}

export function defaultEditorPlugins(options: DefaultPluginOptions = {}): EditorPlugin[] {
  return [
    textPlugin(options),
    markdownPlugin,
    livePreviewPlugin,
    taskListPlugin,
    calloutPlugin,
    togglePlugin,
    columnsPlugin,
    tablePlugin,
    ...(options.upload ? [imagePlugin({ upload: options.upload })] : []),
  ]
}
