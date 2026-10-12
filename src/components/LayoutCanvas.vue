<script setup lang="ts">
/*
 * LayoutCanvas — a user-composable block layout.
 *
 * Renders a layout tree (v-model) of cells. Each cell is a tab stack of blocks.
 * In `edit` mode the user can drag a cell onto another cell's edge to split,
 * drop on the center to merge as tabs, drag dividers to resize, switch tabs,
 * and close tabs. Block content is supplied through the `#block` scoped slot,
 * keyed by the block id stored in the tree — the canvas owns geometry + chrome,
 * the consumer owns content. Pass a `registry` for tab titles/icons.
 *
 * The tree is plain serializable data (see layout/tree.ts).
 */
import LayoutNode from "./LayoutNode.vue"
import {
  moveLeaf,
  removeBlock,
  reorderTab,
  resizeAt,
  setActiveTab,
  type Side,
  type Split,
} from "../layout/tree"
import type { BlockRegistry } from "../layout/registry"
import { layoutController, type LayoutController } from "../layout/useLayout"
import { computed, ref } from "vue"

const props = defineProps<{
  modelValue: Split
  edit?: boolean
  /** Catalogue mapping block ids to titles/icons for the tab bars. */
  registry?: BlockRegistry
}>()

// modelValue is a reactive tree we mutate in place; no emit needed for
// structural changes, but we keep the v-model contract for replacement
// (e.g. load-from-disk swaps the whole tree).
defineEmits<{ (e: "update:modelValue", value: Split): void }>()

defineSlots<{
  block(props: { block: string; leafId: string; edit: boolean }): unknown
}>()

const dragId = ref<string | null>(null)

// A tree owned by useLayout() is edited through its controller, so every edit
// lands in undo history; a bare tree is mutated directly as before.
const edits = computed<LayoutController>(() => {
  const tree = props.modelValue
  return (
    layoutController(tree) ?? {
      move: (movingId, targetId, side) => moveLeaf(tree, movingId, targetId, side),
      removeBlock: (leafId, index) => removeBlock(tree, leafId, index),
      reorderTab: (leafId, from, to) => reorderTab(tree, leafId, from, to),
      setActive: (leafId, index) => setActiveTab(tree, leafId, index),
      resize: (parent, index, delta) => resizeAt(parent, index, delta),
      beginResize: () => {},
      endResize: () => {},
    }
  )
})

function onDrop(targetId: string, side: Side) {
  if (dragId.value) edits.value.move(dragId.value, targetId, side)
  dragId.value = null
}

function onResize(parent: Split, index: number, delta: number) {
  edits.value.resize(parent, index, delta)
}
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1">
    <LayoutNode
      :node="modelValue"
      :drag-id="dragId"
      :edit="!!edit"
      :registry="registry"
      class="flex-1"
      @dragstart="(id) => (dragId = id)"
      @dragend="dragId = null"
      @drop="onDrop"
      @set-active="(leafId, i) => edits.setActive(leafId, i)"
      @remove-block="(leafId, i) => edits.removeBlock(leafId, i)"
      @reorder-tab="(leafId, from, to) => edits.reorderTab(leafId, from, to)"
      @resize="onResize"
      @resize-start="edits.beginResize()"
      @resize-end="edits.endResize()"
    >
      <template #block="slotProps">
        <slot name="block" v-bind="slotProps" />
      </template>
    </LayoutNode>
  </div>
</template>
