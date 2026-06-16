<script setup lang="ts">
/*
 * LayoutCanvas — a user-composable block layout.
 *
 * Renders a layout tree (v-model) of blocks. In `edit` mode the user can drag
 * a block onto another block's edge to split, drag dividers to resize, and
 * (via the consumer's UI) add/remove blocks. Block content is supplied through
 * the `#block` scoped slot, keyed by the block id stored in the tree — the
 * canvas owns geometry, the consumer owns content.
 *
 * The tree is plain serializable data (see layout/tree.ts) — persist it with
 * serializeLayout()/deserializeLayout().
 */
import LayoutNode from "./LayoutNode.vue"
import { moveLeaf, removeLeaf, resizeAt, type Side, type Split } from "../layout/tree"
import { ref } from "vue"

const props = defineProps<{
  modelValue: Split
  edit?: boolean
}>()

// modelValue is a reactive tree we mutate in place; no emit needed for
// structural changes, but we keep the v-model contract for replacement
// (e.g. load-from-disk swaps the whole tree).
defineEmits<{ (e: "update:modelValue", value: Split): void }>()

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
      class="flex-1"
      @dragstart="(id) => (dragId = id)"
      @dragend="dragId = null"
      @drop="onDrop"
      @remove="(id) => removeLeaf(modelValue, id)"
      @resize="onResize"
    >
      <template #block="{ block, edit: inEdit, remove }">
        <slot name="block" :block="block" :edit="inEdit" :remove="remove" />
      </template>
    </LayoutNode>
  </div>
</template>
