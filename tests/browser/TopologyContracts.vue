<script setup lang="ts">
import { onMounted, ref } from "vue"
import { LpTopologyCanvas } from "../../src"
import type { TopologyEdge, TopologyNode, TopologySnapshot } from "../../src"
import "../../src/canvas.css"

const params = new URLSearchParams(location.search)
const mode = params.get("mode") ?? ""

const card = (id: string, x: number, y: number, region: string): TopologyNode => ({
  id,
  position: { x, y },
  data: { name: `Host ${id}`, role: "host" },
  meta: { region },
})
const nodes: TopologyNode[] = [
  card("a", 0, 0, "eu"),
  card("b", 320, 0, "eu"),
  card("c", 640, 0, "us"),
  card("d", 320, 240, "us"),
]
const edges: TopologyEdge[] = [
  { id: "ab", source: "a", target: "b", kind: "wg", rtt: 12, loss: 0.5 },
  { id: "bc", source: "b", target: "c", kind: "depends_on" },
  { id: "bd", source: "b", target: "d", kind: "wg" },
]
const frameNodes: TopologyNode[] = [
  { id: "host", type: "group", position: { x: 0, y: 0 }, width: 100, height: 60, label: "Host", data: { name: "Host", role: "host" } },
  { id: "svc", type: "service", parent: "host", position: { x: 300, y: 200 }, data: { name: "Api" } },
  { id: "other", position: { x: 700, y: 0 }, data: { name: "Other", role: "host" } },
]
const frameEdges: TopologyEdge[] = [{ id: "s", source: "svc", target: "other", kind: "wg" }]
const earlier: TopologySnapshot = { label: "Monday", nodes: nodes.slice(0, 2), edges: edges.slice(0, 1) }
const history: TopologySnapshot[] = [earlier, { label: "Tuesday", nodes, edges }]

const canvas = ref<InstanceType<typeof LpTopologyCanvas> | null>(null)
const log = ref<string[]>([])
const note = (entry: unknown) => log.value.push(JSON.stringify(entry))
onMounted(() => ((window as unknown as { canvas: unknown }).canvas = canvas.value))
</script>

<template>
  <main style="height: 640px; width: 1100px">
    <LpTopologyCanvas
      ref="canvas"
      :nodes="mode === 'frame' ? frameNodes : nodes"
      :edges="mode === 'frame' ? frameEdges : edges"
      :auto-size-groups="mode === 'frame'"
      :detail="mode === 'simple' ? 'simple' : mode === 'overview' ? 'overview' : 'full'"
      :group-by="mode === 'overview' || mode === 'group' ? 'region' : undefined"
      :highlight-neighbors="mode === 'neighbors'"
      :path="mode === 'path' ? ['a', 'c'] : undefined"
      :search="mode === 'search'"
      :keyboard-nav="mode === 'keys'"
      :edge-filter="mode === 'filter' ? (e) => e.kind !== 'depends_on' : undefined"
      :compare-to="mode === 'diff' ? earlier : undefined"
      :timeline="mode === 'timeline' ? history : undefined"
      :selectable="mode === 'select'"
      :selection-actions="mode === 'select' ? [{ id: 'restart', label: 'Restart', icon: 'lucide:rotate-ccw' }] : undefined"
      @path-change="note"
      @selection-action="note"
      @node-activate="(id) => note({ activated: id })"
      @node-select="(id) => note({ selected: id })"
      @update:nodes="(value) => note({ laidOut: value.length })"
    />
  </main>
  <output data-test-log>{{ log.join("\n") }}</output>
</template>
