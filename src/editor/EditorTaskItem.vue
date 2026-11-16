<script setup lang="ts">
/* A checklist row drawn with the kit's own checkbox instead of the browser's. */
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/vue-3"
import LpCheckbox from "../components/LpCheckbox.vue"

const props = defineProps<NodeViewProps>()
const toggle = (checked: boolean) => props.updateAttributes({ checked })
</script>

<template>
  <NodeViewWrapper as="li" class="lp-task" :data-checked="node.attrs.checked ? 'true' : 'false'">
    <span contenteditable="false" class="lp-task-box">
      <LpCheckbox :model-value="node.attrs.checked" :disabled="!editor.isEditable" :palette="false" @update:model-value="toggle" />
    </span>
    <NodeViewContent class="lp-task-text" />
  </NodeViewWrapper>
</template>
