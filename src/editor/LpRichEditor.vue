<script lang="ts">
import { registerIconCollection } from "../icons"
import { EDITOR_ICONS } from "./editor-icons"

registerIconCollection(EDITOR_ICONS)
</script>

<script setup lang="ts">
/*
 * Block editor built from plugins (see blocks.ts). The toolbar, the "/" menu,
 * the insert menu, "Turn into" and the selection bubble are all derived from
 * the resolved plugins, so a consumer's block shows up everywhere by being
 * described once. With `collaboration` (useCollaboration) the document is a
 * shared Yjs one: carets and selections of the others, who is here, and the
 * link state; without it the editor is a plain v-model over TipTap JSON.
 */
import type { Editor, JSONContent } from "@tiptap/core"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"
import { TextSelection } from "@tiptap/pm/state"
import { DragHandle } from "@tiptap/extension-drag-handle-vue-3"
import { EditorContent, useEditor } from "@tiptap/vue-3"
import { BubbleMenu } from "@tiptap/vue-3/menus"
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { POPOVER_PANEL } from "../components/dropdown"
import LpAvatar from "../components/LpAvatar.vue"
import LpContextMenu from "../components/LpContextMenu.vue"
import LpDropdownMenu, { type MenuItem } from "../components/LpDropdownMenu.vue"
import LpIcon from "../components/LpIcon.vue"
import LpInput from "../components/LpInput.vue"
import LpRollingText from "../components/LpRollingText.vue"
import LpSkeleton from "../components/LpSkeleton.vue"
import LpTooltip from "../components/LpTooltip.vue"
import { durationToken, easingToken, prefersReducedMotion } from "../composables/easing"
import { nodeWindow } from "../composables/realm"
import { useLabels } from "../composables/useLpConfig"
import { HeadingAnchors, outlineOf, type OutlineHeading } from "./anchors"
import { defaultEditorPlugins } from "./basics"
import { resolvePlugins, type EditorBlock, type EditorMark, type EditorPlugin, type EditorTrigger, type PickItem } from "./blocks"
import type { Collaboration as Shared } from "./collaboration"
import EditorPickMenu from "./EditorPickMenu.vue"
import { MARKDOWN_HINT } from "./markdown"
import { TriggerMenu, type TriggerState } from "./slash"

/** Wording of the editor chrome. Block, mark and group names come from `editorBlocks`, keyed by id. */
export type RichEditorLabels = {
  placeholder: string
  titlePlaceholder: string
  undo: string
  redo: string
  turnInto: string
  insert: string
  noBlocks: string
  dragHandle: string
  addBlock: string
  connecting: string
  connected: string
  polling: string
  offline: string
  apply: string
  removeLink: string
  cut: string
  copy: string
  paste: string
  pasteText: string
  format: string
  insertBelow: string
  duplicate: string
  deleteBlock: string
}

const props = withDefaults(
  defineProps<{
    /** Read once when the editor is created: what it can edit is fixed for its life. */
    plugins?: EditorPlugin[]
    modelValue?: JSONContent | null
    collaboration?: Shared
    editable?: boolean
    toolbar?: boolean
    labels?: Partial<RichEditorLabels>
  }>(),
  { plugins: undefined, modelValue: null, collaboration: undefined, editable: true, toolbar: true, labels: undefined },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: JSONContent): void
  (e: "outline", headings: OutlineHeading[]): void
  (e: "ready", editor: Editor): void
}>()

const text = useLabels<RichEditorLabels>(
  "editor",
  {
    placeholder: "Type / for blocks",
    titlePlaceholder: "Untitled",
    undo: "Undo",
    redo: "Redo",
    turnInto: "Turn into",
    insert: "Insert",
    noBlocks: "No such block",
    dragHandle: "Drag to move, click for options",
    addBlock: "Add a block below",
    connecting: "Connecting…",
    connected: "Saved",
    polling: "Saved, no live link",
    offline: "Offline, changes are kept",
    apply: "Apply",
    removeLink: "Remove link",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    pasteText: "Paste as plain text",
    format: "Format",
    insertBelow: "Insert below",
    duplicate: "Duplicate block",
    deleteBlock: "Delete block",
  },
  () => props.labels,
)
const named = useLabels<Record<string, string>>("editorBlocks", {
  "group:text": "Text",
  "group:lists": "Lists",
  "group:layout": "Layout",
  "group:media": "Media",
})

const resolved = resolvePlugins(props.plugins ?? defaultEditorPlugins(), {
  collaborative: !!props.collaboration,
  placeholder: (first) => (first ? text.value.titlePlaceholder : text.value.placeholder),
})
const blockName = (block: EditorBlock) => named.value[block.id] ?? block.label
const blockHint = (block: EditorBlock) => named.value[`${block.id}:hint`] ?? block.description
const markName = (mark: EditorMark) => named.value[mark.id] ?? mark.label
const groupName = (group: string) => named.value[`group:${group}`] ?? group

const slashTrigger: EditorTrigger = {
  id: "slash",
  char: "/",
  items: () =>
    resolved.blocks.filter(visible).map((block) => ({
      id: block.id,
      label: blockName(block),
      description: blockHint(block),
      icon: block.icon,
      group: block.group,
      groupLabel: groupName(block.group),
      keywords: block.keywords,
    })),
  pick: (item, target, range) => {
    const block = resolved.blocks.find((row) => row.id === item.id)
    if (block) block.insert(target.chain().focus().deleteRange(range), target).run()
  },
}
const triggers = [slashTrigger, ...resolved.triggers]

const picking = shallowRef<TriggerState | null>(null)
const pickItems = shallowRef<PickItem[]>([])
const lastQuery = ref("")
let lastRect: DOMRect | null = null
const menuRect = () => (lastRect = picking.value?.rect() ?? lastRect)
const menu = ref<InstanceType<typeof EditorPickMenu> | null>(null)
const activeTrigger = computed(() => triggers.find((row) => row.id === picking.value?.trigger))
let pickSeq = 0
watch(picking, async (state) => {
  if (!state) return
  lastQuery.value = state.query
  const trigger = triggers.find((row) => row.id === state.trigger)
  const target = editor.value
  if (!trigger || !target) return
  const seq = ++pickSeq
  const found = await trigger.items(state.query, target)
  if (seq === pickSeq) pickItems.value = found
})

const collab = props.collaboration
const empty = ref(true)
// A shared document arrives after the editor is drawn: until it has (and no
// local copy filled it) a placeholder holds the place, then the text grows in.
const waiting = computed(() => !!collab && empty.value && !collab.synced.value)
const bodyEl = shallowRef<HTMLElement | null>(null)
watch(
  waiting,
  async (now, before) => {
    const el = bodyEl.value
    if (now || !before || !el) return
    const view = el.ownerDocument.defaultView
    const from = el.offsetHeight
    await nextTick()
    if (!view || prefersReducedMotion(view) || !el.isConnected) return
    const to = el.offsetHeight
    const base = durationToken("duration-slow", undefined, el.ownerDocument)
    const easing = easingToken("ease-travel", undefined, el.ownerDocument)
    const ms = (distance: number) => Math.min(600, base * (1 + distance / 1500))
    el.style.overflow = "hidden"
    el.lastElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(to - from), easing })
    // Images inside may still be loading, so the end is taken again once the
    // first leg lands, and the box keeps easing until it holds all of it.
    let height = from
    let target = to
    for (let leg = 0; leg < 4 && el.isConnected && target > height + 1; leg++) {
      const grow = el.animate([{ maxHeight: `${height}px` }, { maxHeight: `${target}px` }], { duration: ms(target - height), easing })
      try {
        await grow.finished
      } catch {
        break
      }
      height = target
      target = el.scrollHeight
    }
    el.style.overflow = ""
  },
  { flush: "pre" },
)
const editor = useEditor({
  editable: props.editable,
  content: collab ? undefined : (props.modelValue ?? undefined),
  extensions: [
    ...resolved.extensions,
    HeadingAnchors,
    ...triggers.map((trigger) =>
      TriggerMenu.extend({ name: `lpTrigger_${trigger.id}` }).configure({
        id: trigger.id,
        char: trigger.char,
        onState: (state) => (picking.value = state),
        onKey: (event) => menu.value?.key(event) ?? false,
      }),
    ),
    ...(collab
      ? [
          Collaboration.configure({ document: collab.document }),
          CollaborationCaret.configure({ provider: collab.provider, user: { ...collab.user } }),
        ]
      : []),
  ],
  editorProps: { attributes: { class: "lp-rich-doc" } },
  onCreate: ({ editor: created }) => {
    empty.value = created.isEmpty
    emit("ready", created)
    publishOutline(created)
  },
  onUpdate: ({ editor: changed }) => {
    empty.value = changed.isEmpty
    if (!collab) emit("update:modelValue", changed.getJSON())
    publishOutline(changed)
  },
})

let lastOutline = ""
function publishOutline(target: Editor) {
  const headings = outlineOf(target.state.doc).map(({ id, text: title, level }) => ({ id, text: title, level }))
  const key = JSON.stringify(headings)
  if (key === lastOutline) return
  lastOutline = key
  emit("outline", headings)
}

watch(
  () => props.modelValue,
  (value) => {
    const target = editor.value
    if (collab || !target || !value) return
    if (JSON.stringify(target.getJSON()) !== JSON.stringify(value)) target.commands.setContent(value, { emitUpdate: false })
  },
)
watch(
  () => props.editable,
  (value) => editor.value?.setEditable(value),
)
onBeforeUnmount(() => editor.value?.destroy())

const visible = (block: EditorBlock) => !editor.value || !block.available || block.available(editor.value)

function run(block: EditorBlock) {
  const target = editor.value
  if (target) block.insert(target.chain().focus(), target).run()
}

function pick(id: string) {
  const target = editor.value
  const state = picking.value
  const item = pickItems.value.find((row) => row.id === id)
  if (target && state && item) activeTrigger.value?.pick(item, target, state.range)
  picking.value = null
}

const convertible = computed(() => resolved.blocks.filter((block) => block.convertible && visible(block)))
const current = computed(() => {
  const target = editor.value
  if (!target) return undefined
  void target.state
  return convertible.value.find((block) => block.active?.(target) && block.id !== "paragraph") ?? convertible.value.find((block) => block.id === "paragraph")
})
const turnItems = computed<MenuItem[]>(() =>
  convertible.value.map((block) => ({ label: blockName(block), icon: block.icon, selected: block === current.value, onSelect: () => run(block) })),
)
const insertItems = computed<MenuItem[]>(() => {
  const groups = new Map<string, MenuItem[]>()
  for (const block of resolved.blocks.filter(visible)) {
    const rows = groups.get(block.group) ?? []
    rows.push({ label: blockName(block), icon: block.icon, onSelect: () => run(block) })
    groups.set(block.group, rows)
  }
  return [...groups.entries()].map(([group, children]) => ({ label: groupName(group), children }))
})

const bubbleShown = ref(0)
const bubbleOptions = {
  placement: "top" as const,
  offset: 8,
  onShow: () => bubbleShown.value++,
  onHide: () => (linking.value = null),
}

const linking = ref<EditorMark | null>(null)
const linkValue = ref("")
const linkInput = ref<InstanceType<typeof LpInput> | null>(null)

function toggleMark(mark: EditorMark) {
  const target = editor.value
  if (!target) return
  if (mark.act) {
    mark.act(target)
    return
  }
  if (mark.input && !mark.active(target)) {
    linking.value = mark
    linkValue.value = mark.input.read(target)
    void nextTick(() => linkInput.value?.focus())
    return
  }
  mark.toggle(target.chain().focus()).run()
}

function applyInput() {
  const target = editor.value
  const mark = linking.value
  if (!target || !mark?.input) return
  mark.input.apply(target.chain().focus(), linkValue.value).run()
  linking.value = null
}

function addBelow(pos: number | null) {
  const target = editor.value
  if (!target || pos === null) return
  const { doc, schema } = target.state
  const node = doc.nodeAt(pos)
  const at = node ? pos + node.nodeSize : pos
  const $pos = doc.resolve(pos)
  const paragraph = schema.nodes.paragraph!
  const sibling = node && !$pos.parent.canReplaceWith($pos.index() + 1, $pos.index() + 1, paragraph) ? node.type.createAndFill() : null
  target
    .chain()
    .focus()
    .insertContentAt(at, sibling ? sibling.toJSON() : { type: "paragraph" })
    .command(({ tr }) => {
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)))
      return true
    })
    .insertContent("/")
    .run()
}

function topBlock(target: Editor) {
  const { $from } = target.state.selection
  if ($from.depth < 1) return null
  const from = $from.before(1)
  const node = target.state.doc.nodeAt(from)
  return node ? { from, to: from + node.nodeSize, node } : null
}

async function pasteFromClipboard(plain: boolean) {
  const target = editor.value
  if (!target) return
  target.commands.focus()
  let html = ""
  let text = ""
  try {
    if (!plain && navigator.clipboard.read) {
      for (const item of await navigator.clipboard.read()) {
        if (item.types.includes("text/html")) html = await (await item.getType("text/html")).text()
        if (item.types.includes("text/plain")) text = await (await item.getType("text/plain")).text()
      }
    } else text = await navigator.clipboard.readText()
  } catch {
    return
  }
  if (html) target.view.pasteHTML(html)
  else if (text && !plain && target.markdown && MARKDOWN_HINT.test(text)) target.commands.insertContent(text, { contentType: "markdown" })
  else if (text) target.view.pasteText(text)
}

function clipboardCommand(command: "copy" | "cut") {
  editor.value?.commands.focus()
  document.execCommand(command)
}

const contextItems = shallowRef<MenuItem[]>([])
function buildMenu(event: MouseEvent) {
  const target = editor.value
  if (!target || !props.editable) {
    contextItems.value = []
    return
  }
  const at = target.view.posAtCoords({ left: event.clientX, top: event.clientY })
  const { from, to } = target.state.selection
  if (at && (at.pos < from || at.pos > to)) target.commands.setTextSelection(at.pos)
  const selected = !target.state.selection.empty
  const block = topBlock(target)
  const pluginActions = resolved.actions.flatMap((actions) => actions(target))
  contextItems.value = [
    { label: text.value.cut, icon: "lucide:scissors", shortcut: "Ctrl+X", disabled: !selected, onSelect: () => clipboardCommand("cut") },
    { label: text.value.copy, icon: "lucide:copy", shortcut: "Ctrl+C", disabled: !selected, onSelect: () => clipboardCommand("copy") },
    { label: text.value.paste, icon: "lucide:clipboard-paste", shortcut: "Ctrl+V", onSelect: () => void pasteFromClipboard(false) },
    { label: text.value.pasteText, icon: "lucide:clipboard-type", shortcut: "Ctrl+Shift+V", onSelect: () => void pasteFromClipboard(true) },
    {
      label: text.value.format,
      icon: "lucide:type",
      separatorBefore: true,
      disabled: !selected,
      children: resolved.marks.map((mark) => ({ label: markName(mark), icon: mark.icon, shortcut: mark.shortcut?.replace("Mod", "Ctrl"), checked: mark.active(target), onSelect: () => toggleMark(mark) })),
    },
    { label: text.value.turnInto, icon: "lucide:repeat", children: turnItems.value },
    {
      label: text.value.insertBelow,
      icon: "lucide:plus",
      children: insertItems.value.map((group) => ({
        ...group,
        children: group.children?.map((row) => ({ ...row, onSelect: () => (block && target.commands.setTextSelection(block.to - 1), target.chain().focus().insertContentAt(block ? block.to : target.state.doc.content.size, { type: "paragraph" }).run(), row.onSelect?.()) })),
      })),
    },
    ...pluginActions.map((action, index) => ({ label: named.value[action.id] ?? action.label, icon: action.icon, danger: action.danger, separatorBefore: index === 0, onSelect: () => action.run(target) })),
    { label: text.value.duplicate, icon: "lucide:copy-plus", separatorBefore: true, disabled: !block, onSelect: () => block && target.chain().focus().insertContentAt(block.to, block.node.toJSON()).run() },
    { label: text.value.deleteBlock, icon: "lucide:trash-2", danger: true, disabled: !block, onSelect: () => block && target.chain().focus().deleteRange({ from: block.from, to: block.to }).run() },
  ]
}

const hovered = ref<number | null>(null)
const toolbarEl = shallowRef<HTMLElement | null>(null)
const handleEl = shallowRef<HTMLElement | null>(null)

// The block handle sits in the gutter beside the sticky toolbar, so a block
// scrolled under the toolbar would leave its handle floating next to it.
function guardHandle() {
  const bar = toolbarEl.value
  const wrapper = handleEl.value?.parentElement
  if (!bar || !wrapper) return
  const covered = wrapper.getBoundingClientRect().top < bar.getBoundingClientRect().bottom - 2
  if (covered) wrapper.dataset.covered = ""
  else delete wrapper.dataset.covered
}
let handleWatch: MutationObserver | undefined
let scrollWindow: Window | undefined
const onScroll = () => guardHandle()
watch(handleEl, (el) => {
  handleWatch?.disconnect()
  handleWatch = undefined
  scrollWindow?.removeEventListener("scroll", onScroll, { capture: true })
  scrollWindow = undefined
  const wrapper = el?.parentElement
  if (!wrapper) return
  const win = nodeWindow(wrapper)
  handleWatch = new win.MutationObserver(guardHandle)
  handleWatch.observe(wrapper, { attributes: true, attributeFilter: ["style"] })
  win.addEventListener("scroll", onScroll, { capture: true, passive: true })
  scrollWindow = win
})
onBeforeUnmount(() => {
  handleWatch?.disconnect()
  scrollWindow?.removeEventListener("scroll", onScroll, { capture: true })
})
const ITEMS = new Set(["listItem", "taskItem"])
const WAIT_LINES = ["92%", "86%", "95%", "60%", "88%", "74%"]
const NESTED = {
  rules: [
    {
      id: "itemOverItsLine",
      evaluate: ({ node, parent, isFirst }: { node: { type: { name: string } }; parent: { type: { name: string } } | null; isFirst: boolean }) =>
        isFirst && node.type.name === "paragraph" && parent && ITEMS.has(parent.type.name) ? 1000 : 0,
    },
  ],
}
const hoveredItem = ref(false)
function onNodeChange({ node, pos }: { node: { type: { name: string } } | null; pos: number }) {
  hovered.value = pos >= 0 ? pos : null
  hoveredItem.value = !!node && ITEMS.has(node.type.name)
}

const peers = computed(() => collab?.peers.value ?? [])
const status = computed(() => collab?.status.value)
const statusText = computed(() => (status.value ? text.value[status.value] : ""))

const TOOL =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-strong transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:pointer-events-none disabled:opacity-40 data-[active]:bg-brand-soft data-[active]:text-brand [&_svg]:size-4"
const HANDLE = "grid size-6 place-items-center rounded-md text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink [&_svg]:size-4"

defineExpose({ editor })
</script>

<template>
  <div class="lp-rich flex min-w-0 flex-col rounded-[inherit]">
    <div v-if="toolbar && editor && editable" ref="toolbarEl" class="sticky top-0 z-20 flex flex-wrap items-center gap-1 rounded-t-[inherit] border-b border-line bg-surface/90 px-2 py-1.5 backdrop-blur">
      <LpTooltip :content="text.undo" label>
        <button type="button" :class="TOOL" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()"><LpIcon name="lucide:undo-2" /></button>
      </LpTooltip>
      <LpTooltip :content="text.redo" label>
        <button type="button" :class="TOOL" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()"><LpIcon name="lucide:redo-2" /></button>
      </LpTooltip>
      <span class="mx-1 h-5 w-px bg-line" />
      <LpDropdownMenu :items="turnItems" :title="text.turnInto" :palette="false">
        <template #trigger>
          <button type="button" :class="[TOOL, 'w-auto gap-1.5 px-2 text-sm']">
          <span class="relative grid size-4 place-items-center">
            <Transition
              enter-active-class="transition duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
              enter-from-class="opacity-0 scale-75"
              leave-active-class="absolute transition duration-(--duration-fast) motion-reduce:transition-none"
              leave-to-class="opacity-0 scale-75"
            >
              <span v-if="current" :key="current.id" class="flex"><LpIcon :name="current.icon" /></span>
            </Transition>
          </span>
          <LpRollingText align="start" :value="current ? blockName(current) : text.turnInto" />
          <LpIcon name="lucide:chevron-down" class="size-3.5 text-muted" />
        </button>
        </template>
      </LpDropdownMenu>
      <span class="mx-1 h-5 w-px bg-line" />
      <LpTooltip v-for="mark in resolved.marks" :key="mark.id" :content="mark.shortcut ? `${markName(mark)} · ${mark.shortcut.replace('Mod', 'Ctrl')}` : markName(mark)" label>
        <button type="button" :class="TOOL" :data-active="mark.active(editor) || undefined" @click="toggleMark(mark)"><LpIcon :name="mark.icon" /></button>
      </LpTooltip>
      <span class="mx-1 h-5 w-px bg-line" />
      <LpDropdownMenu :items="insertItems" :title="text.insert" :palette="false">
        <template #trigger>
          <button type="button" :class="[TOOL, 'w-auto gap-1.5 px-2 text-sm']"><LpIcon name="lucide:plus" />{{ text.insert }}</button>
        </template>
      </LpDropdownMenu>
      <div v-if="collab" class="ml-auto flex items-center gap-3">
        <TransitionGroup
          tag="div"
          class="flex -space-x-1.5"
          move-class="transition-transform duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
          enter-active-class="transition duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
          enter-from-class="opacity-0 scale-50"
          leave-active-class="absolute transition duration-(--duration-fast) motion-reduce:transition-none"
          leave-to-class="opacity-0 scale-50"
        >
          <span v-for="peer in peers" :key="peer.id" class="flex">
            <slot name="peer" :peer="peer">
              <LpTooltip :content="peer.name">
                <span class="flex rounded-full ring-2 ring-offset-1 ring-offset-surface" :style="{ '--tw-ring-color': peer.color }">
                  <LpAvatar :src="peer.avatar" :alt="peer.name" :identicon="peer.id" size="xs" />
                </span>
              </LpTooltip>
            </slot>
          </span>
        </TransitionGroup>
        <span class="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
          <span class="size-1.5 rounded-full transition-colors" :class="status === 'connected' ? 'bg-action' : status === 'offline' ? 'bg-danger' : 'bg-accent'" />
          <LpRollingText align="start" :value="statusText" />
        </span>
      </div>
    </div>

    <BubbleMenu v-if="editor && editable" :editor="editor" class="z-(--z-popover)" :options="bubbleOptions" :should-show="({ editor: target, from, to }) => from !== to && !target.isActive('codeBlock') && !target.isActive('image')">
      <div :key="bubbleShown" :class="POPOVER_PANEL" class="flex items-center gap-0.5 p-1" data-state="open" data-side="top" @mousedown.prevent>
        <template v-if="!linking">
          <button v-for="mark in resolved.marks" :key="mark.id" type="button" :class="TOOL" :data-active="mark.active(editor) || undefined" :aria-label="markName(mark)" @click="toggleMark(mark)"><LpIcon :name="mark.icon" /></button>
        </template>
        <form v-else class="flex items-center gap-1" @submit.prevent="applyInput" @mousedown.stop>
          <LpInput ref="linkInput" v-model="linkValue" size="sm" class="w-56" :placeholder="linking.input?.placeholder" :palette="false" @keydown.esc.prevent="linking = null" />
          <button type="submit" :class="TOOL" :aria-label="text.apply"><LpIcon name="lucide:check" /></button>
        </form>
      </div>
    </BubbleMenu>

    <DragHandle v-if="editor && editable" :editor="editor" :nested="NESTED" :on-node-change="onNodeChange">
      <div ref="handleEl" class="flex items-center gap-0.5 pr-1 transition-transform duration-(--duration-fast) ease-(--ease-emphasized)" :class="hoveredItem && '-translate-x-6'">
        <LpTooltip :content="text.addBlock" label>
          <button type="button" :class="HANDLE" @click="addBelow(hovered)"><LpIcon name="lucide:plus" /></button>
        </LpTooltip>
        <span :class="[HANDLE, 'cursor-grab']" :aria-label="text.dragHandle"><LpIcon name="lucide:grip-vertical" /></span>
      </div>
    </DragHandle>

    <div ref="bodyEl" class="flex min-w-0 flex-1 flex-col">
      <div v-if="waiting" class="flex flex-col gap-3 px-12 py-8" aria-hidden="true">
        <LpSkeleton class="h-7 w-2/5" />
        <LpSkeleton v-for="width in WAIT_LINES" :key="width" class="h-4" :style="{ width }" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col" :class="waiting && 'hidden'">
        <LpContextMenu v-if="editor" :items="contextItems" always no-hint :palette="false">
          <EditorContent :editor="editor" class="lp-rich-body min-w-0 flex-1" @contextmenu.capture="buildMenu" />
        </LpContextMenu>
      </div>
    </div>

    <EditorPickMenu
      ref="menu"
      :open="!!picking"
      :items="pickItems"
      :query="picking?.query ?? lastQuery"
      :searched="activeTrigger?.searched"
      :rect="menuRect"
      :empty="activeTrigger?.empty ?? text.noBlocks"
      @pick="pick"
    />
  </div>
</template>

<style>
.lp-rich-doc {
  min-height: 10rem;
  padding: 1.5rem 3rem;
  font-size: 15px;
  line-height: 1.65;
  color: var(--color-ink);
  outline: none;
}
.lp-rich-doc > * + * {
  margin-top: 0.75rem;
}
.lp-rich-doc h1,
.lp-rich-doc h2,
.lp-rich-doc h3 {
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.lp-rich-doc h1 {
  margin-top: 2rem;
  font-size: 1.875rem;
}
.lp-rich-doc h2 {
  margin-top: 1.75rem;
  font-size: 1.5rem;
}
.lp-rich-doc h3 {
  margin-top: 1.5rem;
  font-size: 1.125rem;
}
.lp-rich-doc > :first-child {
  margin-top: 0;
}
.lp-rich-doc a {
  color: var(--color-brand);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--color-brand) 40%, transparent);
  text-underline-offset: 2px;
}
.lp-rich-doc mark {
  border-radius: 3px;
  padding: 0 0.15em;
  background: var(--color-accent-soft);
  color: var(--color-ink);
}
.lp-rich-doc code {
  border-radius: 6px;
  padding: 0.1em 0.4em;
  background: var(--color-surface-soft);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.88em;
}
.lp-rich-doc pre {
  overflow-x: auto;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  padding: 1rem;
  background: var(--color-surface-raised);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.875rem;
}
.lp-rich-doc pre code {
  padding: 0;
  background: none;
  font-size: inherit;
}
.lp-rich-doc blockquote {
  border-left: 2px solid var(--color-line-strong);
  padding-left: 1rem;
  color: var(--color-muted-strong);
}
.lp-rich-doc ul {
  list-style: disc;
  padding-left: 1.5rem;
}
.lp-rich-doc ol {
  list-style: decimal;
  padding-left: 1.5rem;
}
.lp-rich-doc li > p {
  margin: 0.15rem 0;
}
.lp-rich-doc ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0.25rem;
}
.lp-rich-doc .lp-task {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.lp-rich-doc .lp-task-box {
  display: flex;
  height: 1.65em;
  align-items: center;
  user-select: none;
}
.lp-rich-doc .lp-task-text {
  flex: 1;
  min-width: 0;
  transition: color var(--duration-medium, 200ms) ease;
}
.lp-rich-doc .lp-task[data-checked="true"] > .lp-task-text {
  color: var(--color-muted);
  text-decoration: line-through;
}
.lp-rich-doc .lp-columns,
.lp-rich-doc .tableWrapper,
.lp-rich-doc hr,
.lp-rich-doc h1,
.lp-rich-doc h2 {
  clear: both;
}
.lp-rich-doc .lp-columns {
  display: grid;
  grid-template-columns: repeat(var(--lp-columns, 2), minmax(0, 1fr));
  gap: 1.25rem;
}
.lp-rich-doc .lp-column {
  min-width: 0;
  border-radius: 8px;
  outline: 1px dashed transparent;
  outline-offset: 6px;
  transition: outline-color var(--duration-fast, 160ms) ease;
}
.lp-rich-doc .lp-column > * + * {
  margin-top: 0.75rem;
}
.lp-rich-doc .lp-columns:hover > .lp-column,
.lp-rich-doc .lp-column:focus-within {
  outline-color: var(--color-line);
}
@container (max-width: 560px) {
  .lp-rich-doc .lp-columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
.lp-rich-doc {
  container-type: inline-size;
}
.lp-rich-doc::after {
  content: "";
  display: table;
  clear: both;
}
.lp-rich-doc hr {
  margin: 1.5rem 0;
  border: 0;
  border-top: 1px solid var(--color-line);
}
.lp-rich-doc img {
  max-width: 100%;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
}
.lp-rich-doc img.ProseMirror-selectednode,
.lp-rich-doc .ProseMirror-selectednode[data-type] {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}
.lp-rich-doc .tableWrapper {
  overflow-x: auto;
}
.lp-rich-doc table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.lp-rich-doc th,
.lp-rich-doc td {
  position: relative;
  border: 1px solid var(--color-line);
  padding: 0.5rem 0.75rem;
  vertical-align: top;
}
.lp-rich-doc th {
  background: var(--color-surface-raised);
  text-align: left;
  font-weight: 500;
}
.lp-rich-doc .selectedCell::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--color-brand-soft);
}
.lp-rich .drag-handle {
  transition: opacity var(--duration-fast, 160ms) var(--ease-emphasized, ease);
}
.lp-rich .drag-handle[data-covered] {
  opacity: 0;
  pointer-events: none;
}
.lp-rich-doc .column-resize-handle {
  position: absolute;
  top: 0;
  right: -1px;
  bottom: 0;
  width: 2px;
  pointer-events: none;
  background: var(--color-brand);
}
.lp-rich-doc.resize-cursor {
  cursor: col-resize;
}
.lp-rich-doc div[data-type="details"] {
  display: flex;
  gap: 0.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  padding: 0.375rem 0.5rem;
}
.lp-rich-doc div[data-type="details"] > button {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.15rem;
  border-radius: 4px;
  color: var(--color-muted);
  transition: transform 0.2s var(--ease-emphasized, ease), background-color 0.15s ease;
}
.lp-rich-doc div[data-type="details"] > button:hover {
  background: color-mix(in srgb, var(--color-ink) 6%, transparent);
}
.lp-rich-doc div[data-type="details"].is-open > button {
  transform: rotate(90deg);
}
.lp-rich-doc div[data-type="details"] > div {
  flex: 1;
  min-width: 0;
}
.lp-rich-doc div[data-type="details"] summary {
  font-weight: 500;
  list-style: none;
}
.lp-rich-doc div[data-type="details"].is-open div[data-type="detailsContent"] {
  animation: lp-rich-reveal var(--duration-medium, 200ms) var(--ease-emphasized, ease);
}
.lp-rich-doc div[data-type="details"]:not(.is-open) div[data-type="detailsContent"] {
  display: none;
}
.lp-rich-doc .is-empty::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: color-mix(in srgb, var(--color-muted) 70%, transparent);
}
.lp-rich-doc .lp-live-syntax {
  display: inline-grid;
  grid-template-columns: 1fr;
  vertical-align: baseline;
  color: color-mix(in srgb, var(--color-muted) 80%, transparent);
  font: inherit;
  text-decoration: none;
  user-select: none;
}
.lp-rich-doc .lp-live-syntax.lp-live-entering {
  animation: lp-live-syntax-in 180ms var(--ease-emphasized, ease);
}
.lp-rich-doc .lp-live-syntax > span {
  min-width: 0;
  overflow: hidden;
  white-space: pre;
}
.lp-rich-doc .lp-live-syntax.lp-live-leaving {
  animation: lp-live-syntax-out 180ms var(--ease-emphasized, ease) forwards;
}
@keyframes lp-live-syntax-in {
  from {
    grid-template-columns: 0fr;
    opacity: 0;
  }
}
@keyframes lp-live-syntax-out {
  to {
    grid-template-columns: 0fr;
    opacity: 0;
  }
}
@keyframes lp-rich-reveal {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lp-rich-doc .lp-live-syntax.lp-live-entering,
  .lp-rich-doc .lp-live-syntax.lp-live-leaving,
  .lp-rich-doc div[data-type="details"].is-open div[data-type="detailsContent"] {
    animation: none;
  }
}
.lp-rich-doc .lp-comment {
  border-bottom: 2px solid color-mix(in srgb, var(--color-accent) 70%, transparent);
  background: var(--color-accent-soft);
  cursor: pointer;
  transition: background-color var(--duration-fast, 160ms) ease;
}
.lp-rich-doc .lp-comment:hover,
.lp-rich-doc .lp-comment[data-active] {
  background: color-mix(in srgb, var(--color-accent) 30%, transparent);
}
.lp-rich-doc .lp-mention {
  white-space: nowrap;
}
.lp-rich-doc .collaboration-carets__caret {
  position: relative;
  margin: 0 -1px;
  border-left: 1px solid;
  border-right: 1px solid;
  pointer-events: none;
  word-break: normal;
}
.lp-rich-doc .collaboration-carets__label {
  position: absolute;
  top: -1.3em;
  left: -1px;
  border-radius: 3px 3px 3px 0;
  padding: 0.1rem 0.35rem;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
  white-space: nowrap;
  color: #0b1210;
  user-select: none;
}
</style>
