<script setup lang="ts">
import { computed, ref } from "vue"
import {
  linkChart,
  linkLog,
  linkPipeline,
  linkTable,
  linkTopology,
  LpChart,
  LpLogViewer,
  LpPipeline,
  LpTable,
  LpTopologyCanvas,
  provideLinkedView,
  type TopologyNode,
} from "../../src"

const BASE = Date.UTC(2026, 0, 1)
const MINUTE = 60_000
const times = Array.from({ length: 6 }, (_, i) => BASE + i * MINUTE)
const labels = times.map((_, i) => `t${i}`)
const series = [{ name: "CPU", data: [1, 4, 2, 8, 3, 5] }]

const rows = [{ id: "api", name: "api" }, { id: "db", name: "db" }]
const columns = [{ key: "name", label: "Server" }]
const nodes: TopologyNode[] = [
  { id: "api", position: { x: 0, y: 0 }, data: { name: "api" } },
  { id: "db", position: { x: 320, y: 0 }, data: { name: "db" } },
]
const lines = [
  { message: "api started trace_id=abc123", source: "api", time: times[1] },
  { message: "db slow query", source: "db", time: times[2] },
  { message: "api failed", source: "api", time: times[3] },
]
const steps = computed(() => [
  { label: "Build", key: "build", status: "success" as const },
  { label: "Deploy", key: "deploy", status: "failed" as const, steps: [{ label: "Push image", status: "failed" as const }] },
])

const view = provideLinkedView()
const canvas = ref<InstanceType<typeof LpTopologyCanvas> | null>(null)
const table = linkTable(view, { kind: "server" })
const topology = linkTopology(view, canvas, { kind: "server" })
const log = linkLog(view, { kind: "server" })
const chart = linkChart(view, { times })
const pipeline = linkPipeline(view, { kind: "deployment", steps })

const picked = computed(() => view.entity.value?.id ?? "none")
</script>

<template>
  <main class="mx-auto flex max-w-4xl flex-col gap-4 p-6">
    <output aria-label="Selected">{{ picked }}</output>
    <output aria-label="Trace">{{ view.traceId.value ?? "none" }}</output>
    <div class="flex gap-2">
      <button @click="view.select({ id: 'run-1', kind: 'deployment' })">Pick deployment</button>
      <button @click="view.timeRange.value = { from: times[2], to: times[3] }">Narrow time</button>
      <button @click="view.clear()">Clear</button>
    </div>
    <div data-test="table"><LpTable v-bind="table" :rows="rows" :columns="columns" row-key="id" selectable /></div>
    <div data-test="graph" class="h-64"><LpTopologyCanvas ref="canvas" v-bind="topology" :nodes="nodes" :edges="[]" /></div>
    <div data-test="log" class="h-48"><LpLogViewer v-bind="log" :lines="lines" selectable link-ids /></div>
    <div data-test="chart"><LpChart v-bind="chart" :series="series" :labels="labels" :height="160" /></div>
    <div data-test="pipeline">
      <LpPipeline v-bind="pipeline" :steps="steps" />
    </div>
  </main>
</template>
