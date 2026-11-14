<script setup lang="ts">
import { ref } from "vue"
import { useDragDrop } from "../../src"

/*
 * Preview-only: the script half of a drag-and-drop board, so the live example
 * can show the markup half (data-drop-zone, data-drag-key) as editable code.
 * In an app this is the few lines of useDragDrop in the page's own setup.
 */
const props = defineProps<{ limit?: number }>()
const places = defineModel<Record<string, string[]>>({ required: true })
const root = ref<HTMLElement | null>(null)

const { dragging, over } = useDragDrop({
  root,
  canDrop: (_item, zone) => !props.limit || zone === "Bench" || (places.value[zone]?.length ?? 0) < props.limit,
  onDrop: (item, zone, from, { before }) => {
    const next = { ...places.value }
    if (from) next[from] = next[from]!.filter((name) => name !== item)
    const rest = (next[zone] ?? []).filter((name) => name !== item)
    const at = before === null ? rest.length : rest.indexOf(before)
    rest.splice(at < 0 ? rest.length : at, 0, item)
    next[zone] = rest
    places.value = next
  },
})
</script>

<template>
  <div ref="root">
    <slot :dragging="dragging" :over="over" />
  </div>
</template>
