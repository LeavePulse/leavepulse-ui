<script setup lang="ts">
import { Motion } from "motion-v"
import { computed, onBeforeUnmount, ref } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import { startPointerDrag } from "../composables/pointerDrag"
import type { LayoutNode, Leaf, Side, Split } from "../layout/tree"
import type { BlockRegistry } from "../layout/registry"
import { blockTitle } from "../layout/registry"
import LpIcon from "./LpIcon.vue"

// The kit's layout spring, the same as LpTabs' panel height; instant under
// reduced motion, which motion-v does not apply on its own.
const layoutTransition = usePillTransition("layout")

const props = defineProps<{
  node: LayoutNode
  dragId: string | null
  edit: boolean
  registry?: BlockRegistry
}>()

const emit = defineEmits<{
  (e: "dragstart", id: string): void
  (e: "dragend"): void
  (e: "drop", targetId: string, side: Side): void
  (e: "set-active", leafId: string, index: number): void
  (e: "remove-block", leafId: string, index: number): void
  (e: "reorder-tab", leafId: string, from: number, to: number): void
  (e: "resize", parent: Split, index: number, deltaFraction: number): void
  (e: "resize-start"): void
  (e: "resize-end"): void
}>()

// Explicit slot shape so the recursive #block pass-through types cleanly.
defineSlots<{
  block(props: { block: string; leafId: string; edit: boolean }): unknown
}>()

const hoverSide = ref<Side | null>(null)

// Tab reordering is ALWAYS available (independent of edit mode). `tabDrag` holds
// the index of the tab being dragged within this cell; `tabOver` the index it's
// hovering, so we can show an insertion cue. Reordering stays inside the cell.
const tabDrag = ref<number | null>(null)
const tabOver = ref<number | null>(null)

function onTabDragStart(index: number, ev: DragEvent) {
  tabDrag.value = index
  // Mark as a move so the OS cursor is right; data is unused (in-cell only).
  ev.dataTransfer?.setData("text/plain", String(index))
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move"
}
function onTabDragOver(index: number, ev: DragEvent) {
  if (tabDrag.value === null) return
  ev.preventDefault()
  tabOver.value = index
}
function onTabDrop(index: number) {
  const from = tabDrag.value
  tabDrag.value = null
  tabOver.value = null
  if (from === null || from === index || !leaf.value) return
  emit("reorder-tab", leaf.value.id, from, index)
}
function onTabDragEnd() {
  tabDrag.value = null
  tabOver.value = null
}

const hintInset: Record<Side, string> = {
  left: "inset-y-0 left-0 right-1/2",
  right: "inset-y-0 right-0 left-1/2",
  top: "inset-x-0 top-0 bottom-1/2",
  bottom: "inset-x-0 bottom-0 top-1/2",
  center: "inset-[12%]",
}

// A leaf shows its tab bar when it actually stacks tabs, or always in edit mode
// (so a single-block cell still has a draggable handle + a close affordance).
const leaf = computed(() => (props.node.kind === "leaf" ? (props.node as Leaf) : null))
const showTabs = computed(() => !!leaf.value && (props.edit || leaf.value.blocks.length > 1))
const activeBlock = computed(() => leaf.value?.blocks[leaf.value.active] ?? "")

function tabTitle(id: string): string {
  return props.registry ? blockTitle(props.registry, id) : id
}
function tabIcon(id: string): string | undefined {
  return props.registry?.[id]?.icon
}
function tabClosable(id: string): boolean {
  return props.registry?.[id]?.closable !== false
}

function onDragOver(ev: DragEvent) {
  ev.preventDefault()
  const el = ev.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const px = (ev.clientX - r.left) / r.width
  const py = (ev.clientY - r.top) / r.height
  const edge = 0.3
  if (px < edge) hoverSide.value = "left"
  else if (px > 1 - edge) hoverSide.value = "right"
  else if (py < edge) hoverSide.value = "top"
  else if (py > 1 - edge) hoverSide.value = "bottom"
  else hoverSide.value = "center"
}

let stopSplitter: (() => void) | null = null
onBeforeUnmount(() => stopSplitter?.())

function startSplitter(ev: PointerEvent, parent: Split, index: number) {
  const handle = ev.currentTarget as HTMLElement
  const host = handle.parentElement
  if (!host) return
  emit("resize-start")
  const horizontal = parent.dir === "row"
  let last = horizontal ? ev.clientX : ev.clientY
  stopSplitter = startPointerDrag(ev, {
    move(e) {
      const cur = horizontal ? e.clientX : e.clientY
      // Measured per move: the container can resize during the drag.
      const rect = host.getBoundingClientRect()
      const span = horizontal ? rect.width : rect.height
      if (span > 0) emit("resize", parent, index, (cur - last) / span)
      last = cur
    },
    end() {
      stopSplitter = null
      emit("resize-end")
    },
  })
}
</script>

<template>
  <!-- Container: children + splitters between them -->
  <div
    v-if="node.kind === 'split'"
    class="flex min-h-0 min-w-0 flex-1"
    :class="node.dir === 'row' ? 'flex-row' : 'flex-col'"
  >
    <template v-for="(child, i) in node.children" :key="child.id">
      <LayoutNode
        :node="child"
        :drag-id="dragId"
        :edit="edit"
        :registry="registry"
        :style="{ flexGrow: child.size, flexBasis: '0px' }"
        @dragstart="(id) => emit('dragstart', id)"
        @dragend="emit('dragend')"
        @drop="(t, s) => emit('drop', t, s)"
        @set-active="(l, idx) => emit('set-active', l, idx)"
        @remove-block="(l, idx) => emit('remove-block', l, idx)"
        @reorder-tab="(l, from, to) => emit('reorder-tab', l, from, to)"
        @resize="(p, idx, d) => emit('resize', p, idx, d)"
        @resize-start="emit('resize-start')"
        @resize-end="emit('resize-end')"
      >
        <template #block="slotProps">
          <slot name="block" v-bind="slotProps" />
        </template>
      </LayoutNode>
      <div
        v-if="edit && i < node.children.length - 1"
        class="group relative z-[6] shrink-0 basis-2.5"
        :class="node.dir === 'row' ? 'cursor-col-resize' : 'cursor-row-resize'"
        @pointerdown="(e) => startSplitter(e, node as Split, i)"
      >
        <span
          class="absolute inset-0 m-auto rounded-full bg-line transition-colors group-hover:bg-brand"
          :class="node.dir === 'row' ? 'h-9 w-0.5' : 'h-0.5 w-9'"
        />
      </div>
      <div
        v-else-if="i < node.children.length - 1"
        class="shrink-0 basis-2.5"
      />
    </template>
  </div>

  <!-- Leaf: a tab stack. Header (tabs) + the active block's content. -->
  <Motion
    v-else-if="leaf"
    :layout="true"
    :transition="layoutTransition"
    class="relative flex min-h-0 min-w-0 flex-col"
    :class="{ 'opacity-35': dragId === node.id }"
  >
    <!-- Tab bar. The bar itself is the cell's move-handle (edit only); each tab
         is independently draggable to reorder within the cell — always. -->
    <div
      v-if="showTabs"
      class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-1 py-1"
      :draggable="edit"
      @dragstart="emit('dragstart', node.id)"
      @dragend="(hoverSide = null), emit('dragend')"
    >
      <!-- Tab and close are neighbours: a button inside a button is invalid and
           never reached by the keyboard. -->
      <div
        v-for="(block, i) in leaf.blocks"
        :key="block + i"
        class="inline-flex max-w-40 items-center rounded-control text-xs transition-colors"
        :class="[
          i === leaf.active
            ? 'bg-surface-soft text-ink'
            : 'text-muted hover:bg-surface-soft/60 hover:text-ink',
          tabDrag === i ? 'opacity-40' : '',
          tabOver === i && tabDrag !== null && tabDrag !== i ? 'ring-1 ring-brand' : '',
        ]"
        @dragover="onTabDragOver(i, $event)"
        @drop.stop="onTabDrop(i)"
      >
        <button
          type="button"
          draggable="true"
          :aria-current="i === leaf.active ? 'true' : undefined"
          class="inline-flex min-w-0 cursor-grab items-center gap-1.5 rounded-control px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          @click="emit('set-active', node.id, i)"
          @dragstart.stop="onTabDragStart(i, $event)"
          @dragend="onTabDragEnd"
        >
          <LpIcon v-if="tabIcon(block)" :name="tabIcon(block)!" :size="13" />
          <span class="truncate">{{ tabTitle(block) }}</span>
        </button>
        <button
          v-if="edit && tabClosable(block)"
          type="button"
          class="mr-1 grid size-3.5 shrink-0 place-items-center rounded-pill text-muted outline-none hover:bg-line hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="`Close ${tabTitle(block)}`"
          @click="emit('remove-block', node.id, i)"
        >
          <LpIcon name="lucide:x" :size="11" />
        </button>
      </div>
    </div>

    <!-- Active block content. -->
    <div class="flex min-h-0 min-w-0 flex-1">
      <slot
        name="block"
        :block="activeBlock"
        :leaf-id="node.id"
        :edit="edit"
      />
    </div>

    <!-- Drop zones (edit + something being dragged that isn't this cell). -->
    <div
      v-if="edit && dragId && dragId !== node.id"
      class="absolute inset-0 z-[5]"
      @dragover="onDragOver"
      @dragleave="hoverSide = null"
      @drop="
        () => {
          const s = hoverSide
          hoverSide = null
          if (s) emit('drop', node.id, s)
        }
      "
    >
      <div
        v-if="hoverSide"
        class="pointer-events-none absolute rounded-card border-2 border-brand bg-brand/25 transition-all"
        :class="hintInset[hoverSide]"
      />
    </div>
  </Motion>
</template>
