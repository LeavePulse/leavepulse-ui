<script setup lang="ts">
import { Motion } from "motion-v"
import { ref } from "vue"
import type { LayoutNode, Side, Split } from "../layout/tree"

defineProps<{
  node: LayoutNode
  dragId: string | null
  edit: boolean
}>()

const emit = defineEmits<{
  (e: "dragstart", id: string): void
  (e: "dragend"): void
  (e: "drop", targetId: string, side: Side): void
  (e: "remove", id: string): void
  (e: "resize", parent: Split, index: number, deltaFraction: number): void
}>()

// Explicit slot shape so the recursive #block pass-through types cleanly.
defineSlots<{
  block(props: { block: string; edit: boolean; remove: () => void }): unknown
}>()

const hoverSide = ref<Side | null>(null)

const hintInset: Record<Side, string> = {
  left: "inset-y-0 left-0 right-1/2",
  right: "inset-y-0 right-0 left-1/2",
  top: "inset-x-0 top-0 bottom-1/2",
  bottom: "inset-x-0 bottom-0 top-1/2",
  center: "inset-[12%]",
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

function startSplitter(ev: PointerEvent, parent: Split, index: number) {
  ev.preventDefault()
  const host = (ev.currentTarget as HTMLElement).parentElement
  if (!host) return
  const rect = host.getBoundingClientRect()
  const horizontal = parent.dir === "row"
  const span = horizontal ? rect.width : rect.height
  let last = horizontal ? ev.clientX : ev.clientY

  const move = (e: PointerEvent) => {
    const cur = horizontal ? e.clientX : e.clientY
    emit("resize", parent, index, (cur - last) / span)
    last = cur
  }
  const up = () => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
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
        :style="{ flexGrow: child.size, flexBasis: '0px' }"
        @dragstart="(id) => emit('dragstart', id)"
        @dragend="emit('dragend')"
        @drop="(t, s) => emit('drop', t, s)"
        @remove="(id) => emit('remove', id)"
        @resize="(p, idx, d) => emit('resize', p, idx, d)"
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

  <!-- Leaf: block content via scoped slot -->
  <Motion
    v-else
    :layout="true"
    :transition="{ type: 'spring', stiffness: 520, damping: 42, mass: 0.9 }"
    class="relative flex min-h-0 min-w-0"
    :class="{ 'opacity-35': dragId === node.id }"
  >
    <div
      class="flex min-h-0 min-w-0 flex-1"
      :draggable="edit"
      @dragstart="emit('dragstart', node.id)"
      @dragend="(hoverSide = null), emit('dragend')"
    >
      <slot
        name="block"
        :block="node.block"
        :edit="edit"
        :remove="() => emit('remove', node.id)"
      />
    </div>

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
