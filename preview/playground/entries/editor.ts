import { LpTableOfContents } from "../../../src"
import { defaultEditorPlugins, defineNodeBlock, LpRichEditor } from "../../../src/editor"
import CollabDemo from "../editor/CollabDemo.vue"
import StepBlock from "../editor/StepBlock.vue"
import avatarSample from "../../assets/avatar-sample.png"
import type { ComponentEntry } from "./shared"

const stepPlugin = defineNodeBlock({
  name: "steps",
  component: StepBlock,
  attrs: { done: 2, total: 5 },
  block: { label: "Progress", description: "A counter the team ticks off", icon: "lucide:gauge", group: "custom", keywords: ["steps", "progress"] },
})

const sample = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Moderator handbook" }] },
    { type: "paragraph", content: [{ type: "text", text: "Type " }, { type: "text", marks: [{ type: "code" }], text: "/" }, { type: "text", text: " on an empty line for blocks, select text for formatting, drag a block by its handle." }] },
    { type: "callout", attrs: { tone: "warning" }, content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Never" }, { type: "text", text: " hand out a mute without a reason in the log." }] }] },
    { type: "image", attrs: { src: avatarSample, alt: "Mentor", width: 28, align: "wrapRight", caption: "Your mentor for the first week" } },
    { type: "paragraph", content: [{ type: "text", text: "The picture floats to the right and this text runs around it. Hover it to pick another placement, drag its edge to resize, click under it to edit the caption." }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "First shift" }] },
    { type: "taskList", content: [
      { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Read the rules" }] }] },
      { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Sit in a gate with a mentor" }] }] },
    ] },
    { type: "steps", attrs: { done: 2, total: 5 } },
    { type: "columns", content: [
      { type: "column", content: [{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Day" }] }, { type: "paragraph", content: [{ type: "text", text: "Gates and voice rooms, two people on duty." }] }] },
      { type: "column", content: [{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Night" }] }, { type: "paragraph", content: [{ type: "text", text: "One gate, the rest on call." }] }] },
    ] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sanctions" }] },
    { type: "table", content: [
      { type: "tableRow", content: [
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Rule" }] }] },
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "First time" }] }] },
      ] },
      { type: "tableRow", content: [
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Spam" }] }] },
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Warning" }] }] },
      ] },
    ] },
  ],
}

export const editor: ComponentEntry[] = [
  {
    id: "rich-editor",
    name: "RichEditor",
    description:
      "A block editor assembled from plugins (`@leavepulse/ui/editor`).\n\n- A plugin is one description: its TipTap extensions plus the blocks and marks the UI derives from them. The `/` menu, Insert, Turn into, the toolbar and the selection bubble all read the same list, so a new block is described once.\n- `defineNodeBlock` makes a custom block from a Vue view, its attributes and its menu entry: the Progress block here is one call.\n- `/` search is the command palette's: words, keywords, and a query typed in the wrong keyboard layout.\n- Headings get stable ids; `@outline` feeds LpTableOfContents.\n- Without `collaboration` it is a v-model over TipTap JSON.",
    components: { LpRichEditor, LpTableOfContents },
    state: () => ({ doc: sample, outline: [], plugins: [...defaultEditorPlugins({ upload: async (file: File) => URL.createObjectURL(file) }), stepPlugin] }),
    template: `<div class="flex w-full gap-6">
  <div class="min-w-0 flex-1 overflow-hidden rounded-card border border-line">
    <LpRichEditor v-model="doc" :plugins="plugins" @outline="outline = $event" />
  </div>
  <LpTableOfContents class="hidden w-52 shrink-0 lg:block" :links="outline.map(h => ({ id: h.id, text: h.text, depth: h.level - 1 }))" />
</div>`,
  },
  {
    id: "rich-editor-collab",
    name: "RichEditor · together",
    description:
      "Two editors on one shared Yjs document, relayed in the page as a websocket room would. Type in either: the text merges, the other caret and selection show with a name, and the toolbar lists who is here.\n\nIn an app: `useCollaboration({ url, room, user })` joins a y-websocket or pycrdt-websocket room, keeps unsent edits in IndexedDB and reports the link state; pass the result as `collaboration`.",
    components: { CollabDemo },
    template: `<CollabDemo class="w-full" />`,
  },
]
