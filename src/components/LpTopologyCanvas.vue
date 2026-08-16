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
  Panel,
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
import LpLaneNode from "./LpLaneNode.vue"
import LpServiceNode, { type ServiceNodeData } from "./LpServiceNode.vue"
import LpWaypointEdge from "./LpWaypointEdge.vue"

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

/**
 * Edge semantics, encoded with both colour AND line style so the two kinds read
 * apart at a glance (and for colour-blind users): "network" = a transport wire
 * between hosts (solid, brand-cyan); "structural" = a depends_on relation
 * between services (dotted, violet, thinner). Inferred from `kind` when omitted
 * (`depends_on` → structural, everything else → network).
 */
export type EdgeCategory = "network" | "structural"

export interface TopologyEdge {
  id: string
  source: string
  target: string
  /** transport label shown on the edge (e.g. "wg", "cloudflared"). */
  kind?: string
  /** Semantic class driving colour + dash. Inferred from `kind` if omitted. */
  category?: EdgeCategory
  observed?: EdgeObserved
  /**
   * Push the edge into the background, matching the node data's `dimmed`. A
   * focus highlight has to fade the edges too — dimming only the nodes leaves
   * every unrelated line at full strength.
   */
  dimmed?: boolean
  /**
   * Points the edge should curve through, when the host's layout knows where
   * the gaps are. Requires `edgeType: "waypoints"`; ignored otherwise.
   */
  waypoints?: { x: number; y: number }[]
}

/**
 * A background swimlane: a sized zone (one per project / overlay network) drawn
 * beneath the nodes. The consumer computes the geometry; the canvas renders it
 * as a non-interactive Vue Flow node so it pans/zooms in lockstep with the
 * graph. Lanes are layered below real nodes and never intercept pointer events.
 */
export interface TopologyLane {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  /** Optional accent colour token for the lane border + label. */
  accent?: string
}

/** Canvas viewport transform — for restoring a saved pan/zoom. */
export interface CanvasViewport {
  x: number
  y: number
  zoom: number
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
    /** Show the edge-type legend (Network / Depends-on / Pending / Drift). */
    legend?: boolean
    /**
     * Where the legend sits. Defaults to bottom-left: hosts commonly float a
     * toolbar across the top, which would cover a top-anchored legend, and the
     * minimap owns the bottom-right.
     */
    legendPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
    /**
     * Edge shape. The default bezier bulges away from the straight line between
     * its ends, which suits a free-form graph and cuts through everything in a
     * LAYERED one — a long edge crosses the cards standing between its columns.
     * `smoothstep` routes orthogonally through the gaps instead.
     */
    edgeType?: "default" | "smoothstep" | "step" | "straight" | "waypoints"
    /** Rename legend rows to match what this graph's edges actually mean. */
    legendLabels?: Partial<
      Record<"network" | "structural" | "pending" | "drift", string>
    >
    /**
     * Background swimlanes drawn beneath the nodes (one per project / overlay).
     * Non-interactive; pan/zoom with the graph. Empty = no lanes.
     */
    lanes?: TopologyLane[]
    /**
     * Minimap and zoom controls. On by default — a full-page map needs both —
     * but a graph embedded at a few hundred pixels has nothing to navigate, and
     * the overlays then cover a real share of the picture.
     */
    minimap?: boolean
    controls?: boolean
  }>(),
  {
    connectable: false,
    selectable: false,
    legend: true,
    legendPosition: "bottom-left",
    lanes: () => [],
    minimap: true,
    controls: true,
  },
)

const emit = defineEmits<{
  (e: "connect", value: Connection): void
  (e: "node-select", id: string): void
  /** Double-click — the host's "open this" gesture, distinct from selecting. */
  (e: "node-activate", id: string): void
  (e: "node-contextmenu", value: { id: string; x: number; y: number }): void
  (e: "edge-contextmenu", value: { id: string; x: number; y: number }): void
  (e: "pane-click"): void
  /** Ids of the marquee/multi-selected nodes (empty when cleared). */
  (e: "selection-change", ids: string[]): void
  (e: "update:nodes", value: TopologyNode[]): void
  /** A node finished being dragged — its new canvas position (for persistence). */
  (
    e: "node-drag-stop",
    value: { id: string; position: { x: number; y: number } },
  ): void
  /** Pan/zoom settled — the new viewport (for per-user persistence). */
  (
    e: "viewport-change",
    value: { zoom: number; x: number; y: number },
  ): void
}>()

// Vue Flow types node components as `Component<NodeProps>`; our nodes declare
// their own props (data/selected) which Vue Flow supplies at runtime as part of
// NodeProps. Widen to `Component` (not the concrete DefineComponent) so the
// registry types cleanly without a cast.
const nodeTypes: NodeTypesObject = {
  infra: markRaw(LpInfraNode) as Component,
  service: markRaw(LpServiceNode) as Component,
  lane: markRaw(LpLaneNode) as Component,
}
// `waypoints` curves through the points an edge carries, for layouts that know
// where the gaps are; with none it falls back to the plain bezier.
const edgeTypes = { waypoints: markRaw(LpWaypointEdge) as Component }

// Lanes render as non-interactive Vue Flow nodes BENEATH the graph: prepended
// so they paint first, with selecting/dragging/connecting off and a low z so
// real nodes always sit on top. They pan/zoom with the viewport for free.
const laneNodes = computed<Node[]>(() =>
  props.lanes.map(
    (l): Node => ({
      id: `lane-${l.id}`,
      type: "lane",
      position: { x: l.x, y: l.y },
      data: { label: l.label, accent: l.accent, width: l.width, height: l.height },
      selectable: false,
      draggable: false,
      connectable: false,
      focusable: false,
      zIndex: 0,
    }),
  ),
)

const graphNodes = computed<Node[]>(() =>
  props.nodes.map((n): Node => {
    const type = n.type ?? "infra"
    const node: Node = {
      id: n.id,
      type,
      position: n.position,
      data: n.data,
      zIndex: 1,
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

// Lanes first (painted beneath), then the graph nodes on top.
const flowNodes = computed<Node[]>(() => [
  ...laneNodes.value,
  ...graphNodes.value,
])

// Category drives the resting colour + base dash; `depends_on` is structural.
function edgeCategory(e: TopologyEdge): EdgeCategory {
  return e.category ?? (e.kind === "depends_on" ? "structural" : "network")
}
const CATEGORY_COLOR: Record<EdgeCategory, string> = {
  network: "var(--color-brand)",
  structural: "var(--color-accent)",
}
// Drift is an alarm and overrides the category colour; otherwise the type's
// colour stays so the kind is always legible (pending only animates).
function edgeColor(cat: EdgeCategory, o: EdgeObserved): string {
  return o === "drift" ? "var(--color-danger)" : CATEGORY_COLOR[cat]
}
// Dash encodes BOTH axes: structural is dotted at rest; pending/drift switch to
// a marching dash. Network applied = solid.
function edgeDash(cat: EdgeCategory, o: EdgeObserved): string {
  if (o !== "applied") return "6 5"
  return cat === "structural" ? "1 6" : "0"
}

const flowEdges = computed(() =>
  props.edges.map((e) => {
    const obs = e.observed ?? "applied"
    const cat = edgeCategory(e)
    const color = edgeColor(cat, obs)
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: props.edgeType ?? "default",
      data: { waypoints: e.waypoints },
      animated: obs !== "applied" && !e.dimmed,
      label: e.kind,
      labelBgStyle: { fill: "var(--color-surface)" },
      labelStyle: { fill: "var(--color-muted-strong)", fontSize: "10px" },
      style: {
        stroke: color,
        strokeWidth: cat === "structural" ? 1.5 : 2,
        strokeDasharray: edgeDash(cat, obs),
        strokeLinecap: "round" as const,
        opacity: e.dimmed ? 0.12 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    }
  }),
)

const {
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onEdgeContextMenu,
  onPaneClick,
  onConnect,
  onNodeDragStop,
  onMoveEnd,
  getSelectedNodes,
  fitView,
  setViewport,
} = useVueFlow()
onNodeClick(({ node }) => emit("node-select", node.id))
// A node usually has two levels of interest — pick it out, or open it — and a
// single click cannot carry both. Hosts that only need one can ignore this.
onNodeDoubleClick(({ node }) => emit("node-activate", node.id))
// Drag settled → surface the node's final position so the host can persist it.
onNodeDragStop(({ node }) =>
  emit("node-drag-stop", { id: node.id, position: { ...node.position } }),
)
// Pan/zoom settled → surface the viewport so the host can persist it per user.
onMoveEnd(({ flowTransform }) => {
  if (flowTransform)
    emit("viewport-change", {
      zoom: flowTransform.zoom,
      x: flowTransform.x,
      y: flowTransform.y,
    })
})
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
// Vue Flow's zoom Controls sit bottom-left and the MiniMap bottom-right; clear
// whichever the legend shares a corner with so they don't stack.
const legendOffset = computed(() => {
  if (props.legendPosition === "bottom-left") return "!left-12"
  if (props.legendPosition === "bottom-right") return "!bottom-40"
  return ""
})

// Legend rows mirror the edge encoding exactly (same colours/dashes).
// What each encoding MEANS depends on what the host is drawing: the same solid
// line is a transport on a machine graph and a call on a service graph, so
// "Network" would be wrong half the time. `legendLabels` renames any row.
const legendItems = computed(() => [
  { label: props.legendLabels?.network ?? "Network", color: CATEGORY_COLOR.network, width: 2, dash: "0" },
  {
    label: props.legendLabels?.structural ?? "Depends-on",
    color: CATEGORY_COLOR.structural,
    width: 1.5,
    dash: "1 5",
  },
  { label: props.legendLabels?.pending ?? "Pending", color: "var(--color-brand)", width: 2, dash: "6 5" },
  { label: props.legendLabels?.drift ?? "Drift", color: "var(--color-danger)", width: 2, dash: "6 5" },
])

onEdgeContextMenu(({ edge, event }) => {
  // Right-click an edge → host renders edge actions (change transport, remove…).
  const e = event as MouseEvent
  e.preventDefault?.()
  emit("edge-contextmenu", { id: edge.id, x: e.clientX, y: e.clientY })
})
onPaneClick(() => emit("pane-click"))
onConnect((conn) => emit("connect", conn))

// Restore a saved viewport (pan/zoom). The host calls this after loading the
// user's persisted CanvasViewport on mount.
async function applyViewport(v: CanvasViewport): Promise<void> {
  await setViewport({ x: v.x, y: v.y, zoom: v.zoom })
}

defineExpose({ fitView, setViewport: applyViewport })
</script>

<template>
  <VueFlow
    :nodes="flowNodes"
    :edges="flowEdges"
    :node-types="nodeTypes"
    :edge-types="edgeTypes"
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
    <MiniMap
      v-if="minimap"
      pannable
      zoomable
      node-color="var(--color-surface-soft)"
      mask-color="rgba(0,0,0,0.55)"
    />
    <Controls v-if="controls" />

    <!-- Edge-type legend: makes the colour/dash encoding self-explanatory. -->
    <Panel v-if="legend" :position="legendPosition" :class="legendOffset">
      <div
        class="flex flex-col gap-1.5 rounded-card border border-line bg-surface-overlay/90 px-3 py-2 text-[11px] backdrop-blur"
      >
        <div
          v-for="l in legendItems"
          :key="l.label"
          class="flex items-center gap-2 text-muted"
        >
          <svg width="22" height="6" class="shrink-0" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="22"
              y2="3"
              :stroke="l.color"
              :stroke-width="l.width"
              :stroke-dasharray="l.dash"
              stroke-linecap="round"
            />
          </svg>
          {{ l.label }}
        </div>
      </div>
    </Panel>
  </VueFlow>
</template>

<!-- Styling lives in src/canvas.css (shipped via @leavepulse/ui/canvas.css) so
     the Vue Flow base CSS + chrome theming reaches consuming apps reliably. -->
