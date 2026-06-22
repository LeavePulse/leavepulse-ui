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

// Vue Flow base CSS + canvas chrome theming is shipped via the kit's
// "@leavepulse/ui/canvas.css" export (a plain CSS file). Component-local CSS
// imports don't reach apps through the built dist, so the consuming app imports
// that one file. See src/canvas.css.

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

<!-- Styling lives in src/canvas.css (shipped via @leavepulse/ui/canvas.css) so
     the Vue Flow base CSS + chrome theming reaches consuming apps reliably. -->
