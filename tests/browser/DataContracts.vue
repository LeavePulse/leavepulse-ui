<script setup lang="ts">
import { ref } from "vue"
import { LpChart, LpDataList, LpFileTree, LpFrame, LpLogViewer, LpPipeline, LpTable, LpTopologyCanvas } from "../../src"
import type { FileNode } from "../../src"
import type { TopologyNode } from "../../src/components/LpTopologyCanvas.vue"

const params = new URLSearchParams(location.search)
const scenario = params.get("part")

const columns = [{ key: "name", label: "Name" }]
const rows = [{ id: 1, name: "alpha" }]
const rowMenu = () => [{ label: "Restart", onSelect: () => {} }]

// Pushed into in place, as a stream that owns its array does.
const lines = ref([{ message: "first" }])
const addLine = () => lines.value.push({ message: `line ${lines.value.length + 1}` })

const nodes = ref<FileNode[]>([
  { id: "a", name: "a.txt", kind: "file" },
  { id: "b", name: "b.txt", kind: "file" },
])
const removeB = () => (nodes.value = nodes.value.filter((node) => node.id !== "b"))

const series = ref([
  { name: "CPU", data: [1, 2], hidden: true },
  { name: "Memory", data: [2, 1] },
])
const replaceSeries = () => (series.value = [{ name: "CPU", data: [1, 2], hidden: true }, { name: "Memory", data: [2, 1] }])
const dropFirst = () => (series.value = series.value.slice(1))

const duplicated = [
  { label: "Status", value: "Online" },
  { label: "Status", value: "Healthy" },
]
const steps = [
  { key: "same", label: "One", status: "success" as const },
  { key: "same", label: "Two", status: "running" as const },
]
const graph: TopologyNode[] = [{ id: "n1", position: { x: 0, y: 0 }, data: { name: "Node" } as TopologyNode["data"] }]
</script>

<template>
  <main class="flex flex-col gap-4 p-6">
    <LpFrame v-if="scenario === 'frame'" :height="360" title="Data in a frame">
      <div class="flex flex-col gap-4 p-4">
        <LpTable :columns="columns" :rows="rows" row-key="id" :row-menu="rowMenu">
          <template #cell-name="{ openMenu }">
            <button aria-label="Row actions" @click="openMenu">Actions</button>
          </template>
        </LpTable>
        <LpLogViewer :lines="lines" height="120px" frozen-label="Held" />
      </div>
    </LpFrame>

    <template v-else-if="scenario === 'log'">
      <button @click="addLine">Add line</button>
      <LpLogViewer :lines="lines" height="120px" frozen-label="Held" />
    </template>

    <template v-else-if="scenario === 'tree'">
      <button @click="removeB">Remove b</button>
      <LpFileTree :nodes="nodes" />
    </template>

    <template v-else-if="scenario === 'chart'">
      <button @click="dropFirst">Drop first</button>
      <button @click="replaceSeries">Restore</button>
      <LpChart :labels="['a', 'b']" :series="series" :height="160" />
    </template>

    <LpDataList v-else-if="scenario === 'list'" :items="duplicated" />
    <LpPipeline v-else-if="scenario === 'pipeline'" :steps="steps" />

    <div v-else-if="scenario === 'canvas'" class="h-80 w-96">
      <LpTopologyCanvas :nodes="graph" :edges="[]" minimap legend />
    </div>
  </main>
</template>
