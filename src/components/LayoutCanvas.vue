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
import { ref } from "vue"

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

function onDrop(targetId: string, side: Side) {
  if (dragId.value) moveLeaf(props.modelValue, dragId.value, targetId, side)
  dragId.value = null
}

function onResize(parent: Split, index: number, delta: number) {
  resizeAt(parent, index, delta)
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
      @set-active="(leafId, i) => setActiveTab(modelValue, leafId, i)"
      @remove-block="(leafId, i) => removeBlock(modelValue, leafId, i)"
      @reorder-tab="(leafId, from, to) => reorderTab(modelValue, leafId, from, to)"
      @resize="onResize"
    >
      <template #block="slotProps">
        <slot name="block" v-bind="slotProps" />
      </template>
    </LayoutNode>
  </div>
</template>
