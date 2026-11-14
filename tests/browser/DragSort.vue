<script setup lang="ts">
import { ref } from "vue"
import { useDragDrop } from "../../src"

const root = ref<HTMLElement | null>(null)
const list = ref(["s1", "s2", "s3", "s4"])
const cats = ref([
  { id: "c1", channels: ["ch1", "ch2"] },
  { id: "c2", channels: ["ch3"] },
])
const log = ref<string[]>([])

function insert<T>(arr: T[], value: T, before: T | null): T[] {
  const rest = arr.filter((v) => v !== value)
  const at = before === null ? rest.length : rest.indexOf(before)
  return [...rest.slice(0, at < 0 ? rest.length : at), value, ...rest.slice(at < 0 ? rest.length : at)]
}

useDragDrop({
  root,
  canDrop: (item, zone) => (item.startsWith("c") && !item.startsWith("ch") ? zone === "cats" : item.startsWith("ch") ? zone.startsWith("cat:") : zone === "list"),
  onDrop: (item, zone, from, { before }) => {
    log.value = [...log.value, `${item}:${from}>${zone}@${before ?? "end"}`]
    if (zone === "list") list.value = insert(list.value, item, before)
    else if (zone === "cats") {
      const cat = cats.value.find((c) => c.id === item)!
      const ids = insert(cats.value.map((c) => c.id), item, before)
      cats.value = ids.map((id) => (id === item ? cat : cats.value.find((c) => c.id === id)!))
    } else {
      const target = zone.slice(4)
      cats.value = cats.value.map((c) => ({
        ...c,
        channels: c.id === target ? insert(c.channels, item, before) : c.channels.filter((ch) => ch !== item),
      }))
    }
  },
})
</script>

<template>
  <main ref="root" class="grid grid-cols-2 gap-6 p-6">
    <ol data-drop-zone="list" data-drop-sort data-testid="list" class="flex flex-col gap-2 rounded border p-2">
      <li v-for="s in list" :key="s"><button type="button" :data-drag-key="s" class="w-full rounded border px-2 py-2 text-left">{{ s }}</button></li>
    </ol>
    <div data-drop-zone="cats" data-drop-sort data-testid="cats" class="flex flex-col gap-3 rounded border p-2">
      <section v-for="c in cats" :key="c.id" :data-drag-key="c.id" class="rounded border p-2">
        <p>{{ c.id }}</p>
        <ul :data-drop-zone="`cat:${c.id}`" data-drop-sort :data-testid="`cat-${c.id}`" class="flex min-h-10 flex-col gap-1 p-1">
          <li v-for="ch in c.channels" :key="ch" :data-drag-key="ch" class="rounded border px-2 py-1">{{ ch }}</li>
        </ul>
      </section>
    </div>
    <p data-testid="order">{{ list.join(",") }} | {{ cats.map((c) => c.id + ":" + c.channels.join("+")).join(",") }}</p>
    <p data-testid="log">{{ log.join(",") || "none" }}</p>
  </main>
</template>
