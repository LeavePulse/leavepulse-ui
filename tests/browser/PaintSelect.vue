<script setup lang="ts">
import { ref } from "vue"
import { usePaintSelect } from "../../src"

const root = ref<HTMLElement | null>(null)
const selected = ref<string[]>([])
const clicks = ref(0)
const paint = usePaintSelect({ root, selection: () => selected.value, set: (keys) => (selected.value = keys) })
const rows = ["r1", "r2", "r3", "r4", "r5"]
</script>

<template>
  <main ref="root" class="flex w-80 flex-col gap-1 p-6">
    <div v-for="r in rows" :key="r" :data-paint-key="r" class="flex items-center gap-2 rounded border px-2 py-2" @click="clicks++">
      <span class="tick size-4 rounded border" :data-testid="`tick-${r}`" @pointerdown.stop="paint.onPointerDown($event, r)" />
      {{ r }}
    </div>
    <p data-testid="selected">{{ [...selected].sort().join(",") || "none" }}</p>
    <p data-testid="clicks">{{ clicks }}</p>
    <p data-testid="painting">{{ paint.painting.value }}</p>
  </main>
</template>
