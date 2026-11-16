<script setup lang="ts">
/*
 * An image the writer can place: its width dragged from either edge, where it
 * sits (one row of IMAGE_LAYOUTS: centred, to a side, or floated with the text
 * running around it) and a caption edited where it stands.
 */
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/vue-3"
import { computed, ref } from "vue"
import LpEditable from "../components/LpEditable.vue"
import LpSegmented from "../components/LpSegmented.vue"
import { startPointerDrag } from "../composables/pointerDrag"
import { useLabels } from "../composables/useLpConfig"
import { IMAGE_LAYOUTS, MIN_IMAGE_WIDTH, type ImageLabels, type ImageLayout } from "./image"

const props = defineProps<NodeViewProps>()

const text = useLabels<ImageLabels>("editorImage", {
  center: "Centre",
  left: "Left",
  right: "Right",
  wrapLeft: "Text on the right",
  wrapRight: "Text on the left",
  caption: "Add a caption",
  resize: "Drag to resize",
})

const layout = computed(() => IMAGE_LAYOUTS.find((row) => row.value === props.node.attrs.align) ?? IMAGE_LAYOUTS[0]!)
const options = computed(() => IMAGE_LAYOUTS.map((row) => ({ value: row.value, icon: row.icon, ariaLabel: text.value[row.value] })))
const editable = computed(() => props.editor.isEditable)

const figure = ref<HTMLElement | null>(null)
const draft = ref<number | null>(null)
const width = computed(() => draft.value ?? (props.node.attrs.width as number | null))

function resize(event: PointerEvent, side: -1 | 1) {
  const wrapper = figure.value?.parentElement
  const box = wrapper?.parentElement?.getBoundingClientRect()
  const start = wrapper?.getBoundingClientRect()
  if (!box || !start) return
  const centred = layout.value.value === "center"
  startPointerDrag(event, {
    cursor: "ew-resize",
    move: (move) => {
      const delta = (move.clientX - event.clientX) * side * (centred ? 2 : 1)
      draft.value = Math.round(Math.min(100, Math.max(MIN_IMAGE_WIDTH, ((start.width + delta) / box.width) * 100)))
    },
    end: (completed) => {
      if (completed && draft.value !== null) props.updateAttributes({ width: draft.value })
      draft.value = null
    },
  })
}
</script>

<template>
  <NodeViewWrapper class="lp-image" :class="[layout.box, draft === null && 'transition-[width] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none']" :style="width ? { width: `${width}%` } : undefined" data-drag-handle>
    <figure ref="figure" class="group/image relative m-0">
      <img :src="node.attrs.src" :alt="node.attrs.alt ?? ''" class="block w-full" :class="selected && editable && 'lp-image-selected'" draggable="false" />
      <template v-if="editable">
        <div
          class="absolute left-2 top-2 opacity-0 transition-opacity duration-(--duration-fast) group-hover/image:opacity-100"
          :class="selected && 'opacity-100'"
          contenteditable="false"
        >
          <LpSegmented :model-value="layout.value" :options="options" size="sm" :palette="false" @update:model-value="(value: string) => updateAttributes({ align: value as ImageLayout })" />
        </div>
        <span
          v-for="side in [-1, 1] as const"
          :key="side"
          class="absolute top-1/2 h-12 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-ink/70 opacity-0 shadow transition-opacity duration-(--duration-fast) group-hover/image:opacity-100"
          :class="[side < 0 ? 'left-1.5' : 'right-1.5', selected && 'opacity-100']"
          :title="text.resize"
          contenteditable="false"
          @pointerdown.prevent.stop="resize($event, side)"
        />
      </template>
      <figcaption
        v-if="editable || node.attrs.caption"
        class="mt-1.5 text-center text-sm text-muted transition-opacity duration-(--duration-fast)"
        :class="editable && !node.attrs.caption && !selected && 'opacity-0 group-hover/image:opacity-100 focus-within:opacity-100'"
        contenteditable="false"
      >
        <LpEditable
          v-if="editable"
          :model-value="node.attrs.caption ?? ''"
          :placeholder="text.caption"
          :label="text.caption"
          size="sm"
          trim
          :save="(value: string) => updateAttributes({ caption: value })"
        />
        <template v-else>{{ node.attrs.caption }}</template>
      </figcaption>
    </figure>
  </NodeViewWrapper>
</template>
