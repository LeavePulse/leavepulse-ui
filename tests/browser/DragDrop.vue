<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useDragDrop } from "../../src"

const root = ref<HTMLElement | null>(null)
const places = ref<Record<string, string[]>>({ a: ["u1", "u2"], b: ["u3"], pool: [], locked: [] })
const log = ref<string[]>([])
const clicks = ref(0)
const objectRoot = ref<HTMLElement | null>(null)
const objectLog = ref<string[]>([])
useDragDrop<string, { name: string }>({
  root: objectRoot,
  zone: (raw) => ({ name: raw }),
  onDrop: (item, zone) => (objectLog.value = [...objectLog.value, `${item}>${zone.name}`]),
})
const lateRoot = ref<HTMLElement | null>(null)
const ready = ref(false)
const late = ref<Record<string, string[]>>({ x: ["l1"], y: [] })
onMounted(() => setTimeout(() => (ready.value = true), 150))
useDragDrop({
  root: lateRoot,
  onDrop: (item, zone, from) => {
    if (from) late.value[from] = late.value[from]!.filter((u) => u !== item)
    late.value[zone] = [...late.value[zone]!, item]
  },
})

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
  <div>
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
    <div v-if="ready" ref="lateRoot" class="grid p-6 grid-cols-2 gap-4" data-testid="late">
      <section v-for="(items, zone) in late" :key="zone" :data-drop-zone="zone" :data-testid="`late-${zone}`" class="min-h-24 rounded border p-2">
        <div v-for="u in items" :key="u" :data-drag-key="u" class="rounded border px-2 py-1">{{ u }}</div>
      </section>
    </div>
    <div ref="objectRoot" class="grid grid-cols-2 gap-4 p-6">
      <section data-drop-zone="o1" data-testid="obj-o1" class="min-h-24 rounded border p-2"><div data-drag-key="ob1" class="rounded border px-2 py-1">ob1</div></section>
      <section data-drop-zone="o2" data-testid="obj-o2" class="min-h-24 rounded border p-2" />
      <p data-testid="obj-log">{{ objectLog.join(",") || "none" }}</p>
    </div>
  </div>
</template>
