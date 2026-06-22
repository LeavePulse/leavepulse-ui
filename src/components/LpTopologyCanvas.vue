<script setup lang="ts">
/**
 * LpTopologyCanvas — a declarative infra topology graph on Vue Flow (the engine
 * n8n & NetBird use), themed with kit tokens. Pan/zoom, draggable nodes, bezier
 * edges, dot-grid background, minimap, controls. Data-driven: the consuming app
 * passes `nodes`/`edges` and listens to `connect` / `node-select`; this
 * component owns NO data or fetching, so any panel can reuse it.
 *
 * Edge observed-state styling: solid brand = applied, animated dashed =
 * pending, dashed danger = drift.
 */
import { Background } from "@vue-flow/background"
import { Controls } from "@vue-flow/controls"
import {
  MarkerType,
  VueFlow,
  useVueFlow,
  type Connection,
  type NodeTypesObject,
} from "@vue-flow/core"
import { MiniMap } from "@vue-flow/minimap"
import { computed, markRaw } from "vue"
import LpInfraNode, { type InfraNodeData } from "./LpInfraNode.vue"

import "@vue-flow/core/dist/style.css"
import "@vue-flow/core/dist/theme-default.css"
import "@vue-flow/controls/dist/style.css"
import "@vue-flow/minimap/dist/style.css"

export type EdgeObserved = "applied" | "pending" | "drift"

export interface TopologyNode {
  id: string
  position: { x: number; y: number }
  data: InfraNodeData
}

export interface TopologyEdge {
  id: string
  source: string
  target: string
  /** transport label shown on the edge (e.g. "wg", "cloudflared"). */
  kind?: string
  observed?: EdgeObserved
}

const props = withDefaults(
  defineProps<{
    nodes: TopologyNode[]
    edges: TopologyEdge[]
    /** Allow drag-to-connect (emits `connect`). Default false (read-only). */
    connectable?: boolean
  }>(),
  { connectable: false },
)

const emit = defineEmits<{
  (e: "connect", value: Connection): void
  (e: "node-select", id: string): void
  (e: "update:nodes", value: TopologyNode[]): void
}>()

const nodeTypes = { infra: markRaw(LpInfraNode) } as unknown as NodeTypesObject

const flowNodes = computed(() =>
  props.nodes.map((n) => ({
    id: n.id,
    type: "infra",
    position: n.position,
    data: n.data,
  })),
)

function edgeColor(o: EdgeObserved): string {
  return o === "drift"
    ? "var(--color-danger)"
    : o === "pending"
      ? "var(--color-muted-strong)"
      : "var(--color-brand)"
}

const flowEdges = computed(() =>
  props.edges.map((e) => {
    const obs = e.observed ?? "applied"
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "default",
      animated: obs !== "applied",
      label: e.kind,
      labelBgStyle: { fill: "var(--color-surface)" },
      labelStyle: { fill: "var(--color-muted-strong)", fontSize: "10px" },
      style: {
        stroke: edgeColor(obs),
        strokeWidth: 2,
        strokeDasharray: obs === "applied" ? "0" : "6 5",
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(obs) },
    }
  }),
)

const { onNodeClick, onConnect, fitView } = useVueFlow()
onNodeClick(({ node }) => emit("node-select", node.id))
onConnect((conn) => emit("connect", conn))

defineExpose({ fitView })
</script>

<template>
  <VueFlow
    :nodes="flowNodes"
    :edges="flowEdges"
    :node-types="nodeTypes"
    :nodes-connectable="connectable"
    :default-viewport="{ zoom: 0.9 }"
    :min-zoom="0.3"
    :max-zoom="2"
    fit-view-on-init
    class="lp-topology"
  >
    <Background :gap="22" :size="1.4" pattern-color="var(--color-line-strong)" />
    <MiniMap pannable zoomable node-color="var(--color-surface-soft)" mask-color="rgba(0,0,0,0.55)" />
    <Controls />
  </VueFlow>
</template>

<style scoped>
.lp-topology { background: var(--color-surface); }
.lp-topology :deep(.vue-flow__controls) {
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-control);
  overflow: hidden;
}
.lp-topology :deep(.vue-flow__controls-button) {
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-line);
  fill: var(--color-muted-strong);
}
.lp-topology :deep(.vue-flow__controls-button:hover) { background: var(--color-surface-soft); }
.lp-topology :deep(.vue-flow__minimap) {
  border-radius: var(--radius-card);
  border: 1px solid var(--color-line);
  overflow: hidden;
}
.lp-topology :deep(.vue-flow__edge-text) { fill: var(--color-muted-strong); }
.lp-topology :deep(.vue-flow__edge-textbg) { fill: var(--color-surface); }
</style>
