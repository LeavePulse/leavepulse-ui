import { LpRollingText, LpTableOfContents, LpTypewriter } from "../../../src"
import { commentsPlugin, defaultEditorPlugins, defineNodeBlock, LpRichEditor, mentionPlugin, stylingPlugin } from "../../../src/editor"
import CollabDemo from "../editor/CollabDemo.vue"
import StepBlock from "../editor/StepBlock.vue"
import { reactive } from "vue"
import avatarSample from "../../assets/avatar-sample.png"
import type { ComponentEntry } from "./shared"

const stepPlugin = defineNodeBlock({
  name: "steps",
  component: StepBlock,
  attrs: { done: 2, total: 5 },
  block: { label: "Progress", description: "A counter the team ticks off", icon: "lucide:gauge", group: "custom", keywords: ["steps", "progress"] },
})

const people = [
  { id: "1", label: "Ann", description: "Moderator" },
  { id: "2", label: "Ben", description: "Support" },
  { id: "3", label: "Cleo", description: "Event host" },
]
const channels = [
  { id: "10", label: "rules", icon: "lucide:hash" },
  { id: "11", label: "gate-1", icon: "lucide:volume-2" },
]
const matching = <T extends { label: string }>(rows: T[], query: string) => rows.filter((row) => row.label.toLowerCase().includes(query.toLowerCase()))

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
      "A block editor assembled from plugins (`@leavepulse/ui/editor`).\n\n- A plugin is one description: its TipTap extensions plus the blocks and marks the UI derives from them. The `/` menu, Insert, Turn into, the toolbar and the selection bubble all read the same list, so a new block is described once.\n- `defineNodeBlock` makes a custom block from a Vue view, its attributes and its menu entry: the Progress block here is one call.\n- `@` and `#` mention people and channels (`mentionPlugin`): the chip keeps an id and the app draws the current name. Select text and press the speech bubble to comment (`commentsPlugin`): the anchor is a mark, the thread lives in the app.\n- `/` search is the command palette's: words, keywords, and a query typed in the wrong keyboard layout.\n- `stylingPlugin` adds font, size, text and background colour and alignment menus: fonts come from the app, colours default to theme tokens so a coloured word stays readable in every theme.\n- Headings get stable ids; `@outline` feeds LpTableOfContents.\n- Without `collaboration` it is a v-model over TipTap JSON.",
    components: { LpRichEditor, LpTableOfContents, LpRollingText },
    state: () => {
      const threads: string[] = []
      const state = reactive({ doc: sample, outline: [] as unknown[], opened: "", threads, plugins: [] as unknown[] })
      state.plugins = [
        ...defaultEditorPlugins({ upload: async (file: File) => URL.createObjectURL(file) }),
        stepPlugin,
        stylingPlugin({ fonts: [{ name: "Serif", family: "Georgia, serif" }, { name: "Mono", family: "ui-monospace, monospace" }, { name: "Cursive", family: "\"Comic Sans MS\", cursive" }] }),
        mentionPlugin({
          kinds: [
            { kind: "user", char: "@", label: "People", icon: "lucide:user", search: (query) => matching(people, query) },
            { kind: "channel", char: "#", label: "Channels", search: (query) => matching(channels, query) },
          ],
        }),
        commentsPlugin({
          create: async (_editor, quote) => {
            const id = `t${state.threads.length + 1}`
            state.threads.push(`${id}: "${quote}"`)
            return id
          },
          open: (thread) => (state.opened = thread),
        }),
      ]
      return state
    },
    thumb: `<div class="w-64 overflow-hidden rounded-card border border-line bg-surface text-left">
  <div class="flex items-center gap-1 border-b border-line px-2 py-1 text-muted"><span class="text-[10px]">¶ Text</span><span class="ml-2 text-[10px] font-bold">B</span><span class="text-[10px] italic">I</span><span class="text-[10px] underline">U</span></div>
  <div class="px-3 py-2">
    <p class="flex items-baseline text-sm font-semibold text-ink"><span class="mr-1 text-muted">##</span><LpRollingText :value="tTitle" align="start" /></p>
    <p class="mt-1 text-[11px] text-muted-strong">Type <span class="rounded bg-surface-soft px-1 font-mono">/</span> for blocks, <b class="text-ink">select</b> to format.</p>
    <div class="mt-1.5 rounded-md border border-accent/30 bg-accent-soft px-2 py-1 text-[10px] text-ink">Never mute without a reason.</div>
  </div>
</div>`,
    thumbLoop: { every: 2200, frames: [{ tTitle: "Moderator handbook" }, { tTitle: "First shift" }, { tTitle: "Sanctions" }] },
    template: `<div class="flex w-full gap-6">
  <div class="min-w-0 flex-1 overflow-hidden rounded-card border border-line">
    <LpRichEditor v-model="doc" :plugins="plugins" @outline="outline = $event" />
  </div>
  <div class="hidden w-52 shrink-0 flex-col gap-4 lg:flex">
    <LpTableOfContents :links="outline.map(h => ({ id: h.id, text: h.text, depth: h.level - 1 }))" />
    <div class="text-xs text-muted">
      <p class="mb-1 font-medium text-ink">Comment threads</p>
      <p v-for="t in threads" :key="t" :class="t.startsWith(opened + ':') && 'text-accent'">{{ t }}</p>
      <p v-if="!threads.length">Select text, then the speech-bubble button.</p>
    </div>
  </div>
</div>`,
  },
  {
    id: "rich-editor-collab",
    name: "RichEditor · together",
    description:
      "Two editors on one shared Yjs document, relayed in the page as a websocket room would. Type in either: the text merges, the other caret and selection show with a name, and the toolbar lists who is here.\n\nIn an app: `useCollaboration({ url, room, user })` joins a y-websocket or pycrdt-websocket room, keeps unsent edits in IndexedDB and reports the link state; pass the result as `collaboration`.",
    components: { CollabDemo, LpTypewriter },
    thumb: `<div class="w-64 overflow-hidden rounded-card border border-line bg-surface px-3 py-2 text-left">
  <div class="mb-1.5 flex items-center gap-1"><span class="size-3 rounded-full bg-brand"></span><span class="size-3 rounded-full bg-accent"></span><span class="ml-auto text-[10px] text-muted">● Saved</span></div>
  <p class="text-[11px] text-ink">Ann writes here.<LpTypewriter :text="[' Ben adds a line.', ' And a second one.']" :speed="70" :hold="1400" loop :caret="false" :reserve="false" /><span class="relative mx-px inline-block h-3 border-l border-accent align-middle"><span class="absolute -top-3.5 left-0 rounded-sm bg-accent px-1 text-[8px] font-medium leading-tight text-[#0b1210]">Ben</span></span></p>
</div>`,
    template: `<CollabDemo class="w-full" />`,
  },
]
