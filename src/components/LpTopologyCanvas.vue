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
  SelectionMode,
  VueFlow,
  useVueFlow,
  type Connection,
  type Node,
  type NodeTypesObject,
} from "@vue-flow/core"
import { MiniMap } from "@vue-flow/minimap"
import { computed, markRaw, watch, type Component } from "vue"
import LpInfraNode, { type InfraNodeData } from "./LpInfraNode.vue"
import LpServiceNode, { type ServiceNodeData } from "./LpServiceNode.vue"

// Vue Flow base CSS + canvas chrome theming is shipped via the kit's
// "@leavepulse/ui/canvas.css" export (a plain CSS file). Component-local CSS
// imports don't reach apps through the built dist, so the consuming app imports
// that one file. See src/canvas.css.

export type EdgeObserved = "applied" | "pending" | "drift"

export interface TopologyNode {
  id: string
  position: { x: number; y: number }
  /** Host/group nodes use InfraNodeData; service nodes use ServiceNodeData. */
  data: InfraNodeData | ServiceNodeData
  /**
   * Node kind: "infra" (a host card, default), "service" (a small service node
   * placed inside a host frame), or "group" (a host frame that contains
   * services). Services set `parent` to their group's id.
   */
  type?: "infra" | "service" | "group"
  /** For service nodes: the id of the host-frame group node they live in. */
  parent?: string
  /** For group nodes: pixel size of the frame, and an optional label. */
  width?: number
  height?: number
  label?: string
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
    /**
     * Desktop-style marquee selection: drag on empty canvas to rubber-band a
     * box and select every node inside; the selected set then drags together.
     * Hold Shift to add to the selection. Panning moves to a right-drag / the
     * space bar so left-drag is free for selecting. Default false (left-drag
     * pans, the classic read-only behaviour). Emits `selection-change`.
     */
    selectable?: boolean
  }>(),
  { connectable: false, selectable: false },
)

const emit = defineEmits<{
  (e: "connect", value: Connection): void
  (e: "node-select", id: string): void
  (e: "node-contextmenu", value: { id: string; x: number; y: number }): void
  (e: "pane-click"): void
  /** Ids of the marquee/multi-selected nodes (empty when cleared). */
  (e: "selection-change", ids: string[]): void
  (e: "update:nodes", value: TopologyNode[]): void
}>()

// Vue Flow types node components as `Component<NodeProps>`; our nodes declare
// their own props (data/selected) which Vue Flow supplies at runtime as part of
// NodeProps. Widen to `Component` (not the concrete DefineComponent) so the
// registry types cleanly without a cast.
const nodeTypes: NodeTypesObject = {
  infra: markRaw(LpInfraNode) as Component,
  service: markRaw(LpServiceNode) as Component,
}

const flowNodes = computed<Node[]>(() =>
  props.nodes.map((n): Node => {
    const type = n.type ?? "infra"
    const node: Node = {
      id: n.id,
      type,
      position: n.position,
      data: n.data,
      ...(n.parent ? { parentNode: n.parent } : {}),
    }
    if (type === "group") {
      // A host frame: a Vue Flow group node sized to hold its services.
      node.style = {
        width: `${n.width ?? 260}px`,
        height: `${n.height ?? 160}px`,
        background: "color-mix(in srgb, var(--color-surface-soft) 60%, transparent)",
        border: "1px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        opacity: (n.data as { dimmed?: boolean }).dimmed ? "0.35" : "1",
        transition: "opacity var(--duration-fast)",
      }
      node.label = n.label ?? n.data.name
    }
    return node
  }),
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

const {
  onNodeClick,
  onNodeContextMenu,
  onPaneClick,
  onConnect,
  getSelectedNodes,
  fitView,
} = useVueFlow()
onNodeClick(({ node }) => emit("node-select", node.id))
// Vue Flow has no onSelectionChange hook in this version; the selected set is
// reactive on the store, so watch it and surface the ids.
watch(
  () => getSelectedNodes.value.map((n) => n.id),
  (ids) => emit("selection-change", ids),
)
onNodeContextMenu(({ node, event }) => {
  // Suppress the browser menu and surface the node + cursor so the host can
  // render its own actions (open page, focus, filter, copy…).
  const e = event as MouseEvent
  e.preventDefault?.()
  emit("node-contextmenu", { id: node.id, x: e.clientX, y: e.clientY })
})
onPaneClick(() => emit("pane-click"))
onConnect((conn) => emit("connect", conn))

defineExpose({ fitView })
</script>

<template>
  <VueFlow
    :nodes="flowNodes"
    :edges="flowEdges"
    :node-types="nodeTypes"
    :nodes-connectable="connectable"
    :selection-on-drag="selectable"
    :pan-on-drag="selectable ? [1, 2] : true"
    :selection-key-code="selectable ? true : null"
    multi-selection-key-code="Shift"
    :selection-mode="SelectionMode.Partial"
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
