<script setup lang="ts">
/*
 * Callout block: a tinted box with an icon and its own rich content. The tone
 * is picked from the icon button; each tone is one row of CALLOUT_TONES.
 */
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/vue-3"
import { computed } from "vue"
import LpDropdownMenu from "../components/LpDropdownMenu.vue"
import LpIcon from "../components/LpIcon.vue"
import { useLabels } from "../composables/useLpConfig"
import { CALLOUT_TONES, type CalloutLabels, type CalloutTone } from "./callout"

const props = defineProps<NodeViewProps>()

const text = useLabels<CalloutLabels>("editorCallout", { info: "Note", success: "Tip", warning: "Warning", danger: "Danger" })
const tone = computed(() => CALLOUT_TONES.find((row) => row.id === props.node.attrs.tone) ?? CALLOUT_TONES[0]!)
const items = computed(() =>
  CALLOUT_TONES.map((row) => ({
    label: text.value[row.id as CalloutTone],
    icon: row.icon,
    selected: row.id === tone.value.id,
    onSelect: () => props.updateAttributes({ tone: row.id }),
  })),
)
</script>

<template>
  <NodeViewWrapper class="lp-callout my-3 flex gap-3 rounded-card border px-4 py-3 transition-colors duration-(--duration-medium)" :class="tone.box">
    <LpDropdownMenu v-if="editor.isEditable" :items="items" :palette="false">
      <template #trigger>
        <button type="button" contenteditable="false" class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md transition-colors duration-(--duration-medium) hover:bg-ink/[0.06]" :class="tone.ink" :aria-label="text[tone.id]">
        <LpIcon :name="tone.icon" class="size-4.5" />
      </button>
      </template>
    </LpDropdownMenu>
    <span v-else contenteditable="false" class="mt-0.5 grid size-6 shrink-0 place-items-center" :class="tone.ink">
      <LpIcon :name="tone.icon" class="size-4.5" />
    </span>
    <NodeViewContent class="min-w-0 flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
  </NodeViewWrapper>
</template>
