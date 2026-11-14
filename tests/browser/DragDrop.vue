<script setup lang="ts">
import { ref } from "vue"
import { useDragDrop } from "../../src"

const root = ref<HTMLElement | null>(null)
const places = ref<Record<string, string[]>>({ a: ["u1", "u2"], b: ["u3"], pool: [], locked: [] })
const log = ref<string[]>([])
const clicks = ref(0)

const dnd = useDragDrop({
  root,
  canDrop: (_item, zone) => zone !== "locked",
  onDrop: (item, zone, from) => {
    log.value = [...log.value, `${item}:${from}>${zone}`]
    if (from) places.value[from] = places.value[from]!.filter((u) => u !== item)
    places.value[zone] = [...places.value[zone]!, item]
  },
})
</script>

<template>
  <main ref="root" class="grid grid-cols-4 gap-4 p-6">
    <section
      v-for="(items, zone) in places"
      :key="zone"
      :data-drop-zone="zone"
      :data-testid="`zone-${zone}`"
      class="flex min-h-40 flex-col gap-2 rounded border p-2 data-[drop-over]:border-brand"
    >
      <p>{{ zone }}</p>
      <div v-for="u in items" :key="u" :data-drag-key="u" class="flex items-center gap-2 rounded border px-2 py-1" @click="clicks++">
        <span>{{ u }}</span>
        <button type="button" class="ml-auto" @click.stop>menu {{ u }}</button>
      </div>
    </section>
    <p data-testid="log">{{ log.join(",") || "none" }}</p>
    <p data-testid="clicks">{{ clicks }}</p>
    <p data-testid="state">{{ dnd.dragging.value ?? "idle" }}|{{ dnd.over.value ?? "-" }}</p>
  </main>
</template>
