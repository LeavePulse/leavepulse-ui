<script setup lang="ts">
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/vue-3"
import { LpProgress } from "../../../src"

const props = defineProps<NodeViewProps>()
const bump = (step: number) => props.updateAttributes({ done: Math.min(props.node.attrs.total, Math.max(0, props.node.attrs.done + step)) })
</script>

<template>
  <NodeViewWrapper class="my-3 flex items-center gap-3 rounded-card border border-line bg-surface-raised px-4 py-3" contenteditable="false">
    <span class="text-sm text-muted">Onboarding</span>
    <LpProgress :value="node.attrs.done" :max="node.attrs.total" class="flex-1" />
    <span class="w-12 text-right text-sm tabular-nums">{{ node.attrs.done }}/{{ node.attrs.total }}</span>
    <button v-if="editor.isEditable" type="button" class="rounded-md px-2 text-sm hover:bg-ink/[0.06]" @click="bump(-1)">−</button>
    <button v-if="editor.isEditable" type="button" class="rounded-md px-2 text-sm hover:bg-ink/[0.06]" @click="bump(1)">+</button>
  </NodeViewWrapper>
</template>
