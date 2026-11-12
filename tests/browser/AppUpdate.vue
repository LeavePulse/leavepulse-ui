<script setup lang="ts">
import { ref } from "vue"
import { useAppUpdate } from "../../src"

const w = window as unknown as { __latest?: string; __busy?: boolean }
const dialog = ref(false)
const update = useAppUpdate({
  current: "build-1",
  latest: async () => w.__latest ?? "build-1",
  busy: () => Boolean(w.__busy),
  idleMs: 300,
  everyMs: 0,
})
</script>

<template>
  <div class="p-4">
    <output data-testid="state">{{ update.restored.value ? "restored" : "fresh" }}</output>
    <button type="button" @click="update.check()">Check</button>
    <button type="button" @click="dialog = !dialog">Dialog</button>
    <div v-if="dialog" role="dialog" aria-label="Open dialog">Dialog body</div>
    <input aria-label="Field" />
    <div style="height: 3000px" />
  </div>
</template>
