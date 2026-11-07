<script setup lang="ts">
import { ref } from "vue"
import { LpLogViewer, type LogLine } from "../../src"

const lines: LogLine[] = [
  { time: 1000, level: "info", source: "api", message: "job 41 failed" },
  { time: 2000, level: "info", source: "db", message: "connected" },
  { time: 3000, level: "info", source: "api", message: "job 42 failed" },
  { time: 4000, level: "error", source: "api", message: '{"user":{"id":7},"trace_id":"abc123"}' },
]
const viewer = ref<InstanceType<typeof LpLogViewer> | null>(null)
const picked = ref("")
const id = ref("")
const selection = ref<[number, number] | null>(null)
const narrow = ref(false)
</script>

<template>
  <main class="p-6">
    <button @click="narrow = !narrow">Toggle range</button>
    <button @click="viewer?.jumpToTime(3100)">Jump</button>
    <output aria-label="Picked">{{ picked }}</output>
    <output aria-label="Id">{{ id }}</output>
    <output aria-label="Selection">{{ selection?.join("-") }}</output>
    <LpLogViewer
      ref="viewer"
      v-model:selection="selection"
      :lines="lines"
      toolbar
      tools
      link-ids
      selectable
      inspector
      filter-matches
      :tail="false"
      :time-range="narrow ? { from: 2000, to: 3000 } : undefined"
      @select="picked = $event.line.message"
      @id-click="id = `${$event.kind}:${$event.value}`"
    />
  </main>
</template>
