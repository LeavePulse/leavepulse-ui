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
  type Padding,
} from "@vue-flow/core"
import { MiniMap } from "@vue-flow/minimap"
import { computed, defineComponent, h, markRaw, nextTick, ref, shallowRef, watch, type Component } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useLabels } from "../composables/useLpConfig"
import { useResizeObserver } from "../composables/useResizeObserver"
import { isHTMLElement, nodeWindow } from "../composables/useView"
import { backgroundOf, resolveCssColor, svgToPng } from "./exportData"
import LpButton from "./LpButton.vue"
import LpInfraNode, { type InfraNodeData } from "./LpInfraNode.vue"
import LpInput from "./LpInput.vue"
import LpLaneNode from "./LpLaneNode.vue"
import LpServiceNode, { type ServiceNodeData } from "./LpServiceNode.vue"
import LpSlider from "./LpSlider.vue"
import LpWaypointEdge from "./LpWaypointEdge.vue"
import {
  absolutePositions,
  clusterGraph,
  collapseChildren,
  detailAtZoom,
  diffTopology,
  edgeLabelText,
  findNodes,
  findPath,
  frameSize,
  groupBoxes,
  layeredLayout,
  nearestInDirection,
  neighborhood,
  nodeName,
  topologyToSvg,
  type DetailLevel,
  type GraphDirection,
  type GraphPath,
  type LayoutOptions,
  type TopologyDiff,
} from "./topologyGraph"

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
  /**
   * Free-form facts about the node, for `groupBy` ("region", "environment"):
   * what the card does not show but a graph can be sorted by.
   */
  meta?: Record<string, string | undefined>
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
  /** Measured round-trip time in ms, printed on the edge after its `kind`. */
  rtt?: number
  /** Measured packet loss in percent, printed on the edge after `rtt`. */
  loss?: number
}

/** One version of the graph, for `timeline` and `compareTo`. */
export interface TopologySnapshot {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  /** What the timeline shows for this version: a date, a deploy. */
  label?: string
}

/** A button over a multi-selection; pressing it emits `selection-action`. */
export interface TopologySelectionAction {
  id: string
  label: string
  icon?: string
}

/** The node facts a graph can be grouped by, or a function that picks one. */
export type TopologyGroupBy = string | ((node: TopologyNode) => string | undefined)

export type TopologyLayoutOptions = Omit<LayoutOptions, "groupOf">

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

/** Wording of the canvas's own controls. `{n}` is a count. */
export type TopologyLabels = {
  search: string
  searchResults: string
  selected: string
  timeline: string
}

const TOPOLOGY_LABELS: TopologyLabels = {
  search: "Find a node",
  searchResults: "{n} found",
  selected: "{n} selected",
  timeline: "Version",
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
    /** Hide edges this returns false for, by kind, state or anything else. */
    edgeFilter?: (edge: TopologyEdge) => boolean
    /** Picking a node fades everything not directly connected to it. */
    highlightNeighbors?: boolean
    /**
     * Two node ids: the shortest path between them stands out, the rest fades.
     * The result arrives in `path-change`. Goes by `directedPath` and by what
     * `edgeFilter` leaves visible.
     */
    path?: [string, string]
    /** Walk the path along edge direction only. Default: a wire goes both ways. */
    directedPath?: boolean
    /**
     * Draw a lane around each group of nodes, keyed by a `meta` field, a `data`
     * field or a function. `autoLayout` then keeps the groups apart.
     */
    groupBy?: TopologyGroupBy
    /** A search box that finds a node by name or id and brings it into view. */
    search?: boolean
    /** Arrow keys walk between nodes instead of nudging the focused one. */
    keyboardNav?: boolean
    /** Buttons shown while two or more nodes are selected. */
    selectionActions?: TopologySelectionAction[]
    /** An earlier version: what differs is marked on the graph drawn now. */
    compareTo?: TopologySnapshot
    /**
     * Versions of the graph, oldest first: a slider steps through them and
     * each is drawn with what changed since the one before. `nodes` and `edges`
     * are not drawn meanwhile.
     */
    timeline?: TopologySnapshot[]
    /** Fit the graph again whenever the canvas changes size. Default "never": the view is the user's. */
    fitOnResize?: "never" | "always"
    /** Change it when a new dataset arrives, to fit the graph to it once. */
    dataRevision?: string | number
    /** Grow each group frame to hold its services, however the data sized it. */
    autoSizeGroups?: boolean
    /**
     * How much to draw. "simple" leaves services out, with their edges moved to
     * their hosts; "overview" folds each `groupBy` group into one node; "auto"
     * picks by zoom. Default "full".
     */
    detail?: DetailLevel | "auto"
    labels?: Partial<TopologyLabels>
  }>(),
  {
    connectable: false,
    selectable: false,
    legend: true,
    legendPosition: "bottom-left",
    lanes: () => [],
    minimap: true,
    controls: true,
    edgeFilter: undefined,
    path: undefined,
    groupBy: undefined,
    selectionActions: undefined,
    compareTo: undefined,
    timeline: undefined,
    fitOnResize: "never",
    dataRevision: undefined,
    detail: "full",
    labels: undefined,
  },
)

const text = useLabels("topology", TOPOLOGY_LABELS, () => props.labels)
/** Index into `timeline`; unset follows the newest version. */
const timelineIndex = defineModel<number | undefined>("timelineIndex", { default: undefined })

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
  /** The path asked for by `path`: null when the two are not connected. */
  (e: "path-change", value: GraphPath | null): void
  /** A `selectionActions` button was pressed for these nodes. */
  (e: "selection-action", value: { action: string; ids: string[] }): void
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
// Vue Flow ships no "group" renderer, so a host frame without one warns and
// draws nothing inside its styled box. The frame only needs its label.
const GroupNode = defineComponent({
  props: { label: { type: [String, Object], default: undefined } },
  setup: (props) => () =>
    typeof props.label === "string"
      ? h("div", { class: "px-3 pt-2 text-xs font-medium text-muted" }, props.label)
      : null,
})

const nodeTypes: NodeTypesObject = {
  group: markRaw(GroupNode) as Component,
  infra: markRaw(LpInfraNode) as Component,
  service: markRaw(LpServiceNode) as Component,
  lane: markRaw(LpLaneNode) as Component,
}
// `waypoints` curves through the points an edge carries, for layouts that know
// where the gaps are; with none it falls back to the plain bezier.
const edgeTypes = { waypoints: markRaw(LpWaypointEdge) as Component }

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
  onNodesInitialized,
  vueFlowRef,
  viewport,
  findNode,
  getNodes,
  addSelectedNodes,
  removeSelectedNodes,
} = useVueFlow()

// What is drawn: the chosen version from the timeline, or the graph as given.
const versionIndex = computed(() => {
  const last = (props.timeline?.length ?? 0) - 1
  return Math.max(0, Math.min(timelineIndex.value ?? last, last))
})
const current = computed<TopologySnapshot>(
  () => props.timeline?.[versionIndex.value] ?? { nodes: props.nodes, edges: props.edges },
)
const baseline = computed(() => (props.timeline ? props.timeline[versionIndex.value - 1] : props.compareTo))
const diff = computed<TopologyDiff | null>(() => (baseline.value ? diffTopology(baseline.value, current.value) : null))

/*
 * A redraw hands Vue Flow every node again, position included, and highlighting
 * redraws on a click. Where the user dragged a node stands until the host
 * sends new data, so a host that does not persist positions keeps them too.
 */
const moved = shallowRef(new Map<string, { x: number; y: number }>())
watch(() => current.value.nodes, () => (moved.value = new Map()))
const placed = computed(() =>
  moved.value.size
    ? current.value.nodes.map((n) => (moved.value.has(n.id) ? { ...n, position: moved.value.get(n.id)! } : n))
    : current.value.nodes,
)

function groupOf(node: TopologyNode): string | undefined {
  const by = props.groupBy
  if (typeof by === "function") return by(node)
  if (!by) return undefined
  const value = node.meta?.[by] ?? (node.data as unknown as Record<string, unknown>)[by]
  return typeof value === "string" && value ? value : undefined
}

// With the removed parts of `diff` put back, so what went is seen going.
const versioned = computed(() => {
  const edges = props.edgeFilter ? current.value.edges.filter(props.edgeFilter) : current.value.edges
  const was = baseline.value
  if (!diff.value || !was) return { nodes: placed.value, edges }
  const goneNodes = new Set(diff.value.removedNodes)
  const goneEdges = new Set(diff.value.removedEdges)
  return {
    nodes: [...placed.value, ...was.nodes.filter((n) => goneNodes.has(n.id))],
    edges: [...edges, ...was.edges.filter((e) => goneEdges.has(e.id) && (props.edgeFilter?.(e) ?? true))],
  }
})

const detailLevel = computed<DetailLevel>(() => {
  if (props.detail === "auto") return detailAtZoom(viewport.value.zoom, !!props.groupBy)
  return props.detail === "overview" && !props.groupBy ? "simple" : props.detail
})

// Merged edges stand in for the ones they fold: the first lends its look.
function foldedEdges(merged: ReturnType<typeof collapseChildren>["edges"], all: TopologyEdge[]): TopologyEdge[] {
  const byId = new Map(all.map((e) => [e.id, e]))
  return merged.map((m) => {
    const first = byId.get(m.members[0]!)!
    const kind = m.members.length > 1 ? `${first.kind ?? ""} ×${m.members.length}`.trim() : first.kind
    return { ...first, id: m.id, source: m.source, target: m.target, kind, waypoints: undefined }
  })
}

const shown = computed<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>(() => {
  const { nodes, edges } = versioned.value
  if (detailLevel.value === "full") return { nodes, edges }
  if (detailLevel.value === "simple") {
    const folded = collapseChildren(nodes, edges)
    return { nodes: folded.nodes, edges: foldedEdges(folded.edges, edges) }
  }
  const graph = clusterGraph(nodes, edges, groupOf)
  const clusters = graph.clusters.map((c): TopologyNode => ({
    id: c.id,
    position: c.position,
    data: { name: `${c.key} (${c.members.length})`, role: "cluster" },
  }))
  return { nodes: [...graph.nodes, ...clusters], edges: foldedEdges(graph.edges, edges) }
})

const query = ref("")
const matches = computed(() => findNodes(shown.value.nodes, query.value))
const focused = ref<string | null>(null)

const pathFound = computed(() => {
  if (!props.path) return null
  return findPath(shown.value.edges, props.path[0], props.path[1], { directed: props.directedPath })
})
// By route, not by object: `:path="[a, b]"` in a template is a new array on each
// render, and an answer per render would loop if the host renders what it hears.
watch(() => JSON.stringify(pathFound.value), () => emit("path-change", pathFound.value), { immediate: !!props.path })

// What stands out, when something does. Nothing here means the graph as it is.
const emphasis = computed(() => {
  const picked: GraphPath | null =
    pathFound.value ??
    (matches.value.length ? { nodes: matches.value.map((n) => n.id), edges: [] } : null) ??
    (props.highlightNeighbors && focused.value ? neighborhood(shown.value.edges, focused.value) : null)
  if (!picked) return null
  const lit = new Set(picked.nodes)
  // A frame stays lit around a service that is, or the service fades with it.
  for (const n of shown.value.nodes) if (n.parent && lit.has(n.id)) lit.add(n.parent)
  return { nodes: lit, edges: new Set(picked.edges), path: !!pathFound.value }
})

function diffState(id: string, added: string[] | undefined, changed: string[] | undefined, removed: string[] | undefined) {
  if (added?.includes(id)) return "added"
  if (removed?.includes(id)) return "removed"
  return changed?.includes(id) ? "changed" : null
}
const GROUP_WIDTH = 260
const GROUP_HEIGHT = 160
const PATH_EXTRA_WIDTH = 1.5
const REMOVED_DASH = "3 5"
const DIFF_COLOR = {
  added: "var(--color-action)",
  changed: "var(--color-accent)",
  removed: "var(--color-danger)",
} as const

// Lanes render as non-interactive Vue Flow nodes BENEATH the graph: prepended
// so they paint first, with selecting/dragging/connecting off and a low z so
// real nodes always sit on top. They pan/zoom with the viewport for free.
// Measured where it has been drawn: a card's size is the card's own business.
function sized(node: TopologyNode): TopologyNode {
  const measured = findNode(node.id)?.dimensions
  return { ...node, width: node.width ?? (measured?.width || undefined), height: node.height ?? (measured?.height || undefined) }
}
const allLanes = computed<TopologyLane[]>(() => {
  if (!props.groupBy || detailLevel.value === "overview") return props.lanes
  const groups = groupBoxes(shown.value.nodes.map(sized), (n) => groupOf(n as TopologyNode))
  return [...props.lanes, ...groups.map(({ key, box }) => ({ id: `group-${key}`, label: key, ...box }))]
})

const laneNodes = computed<Node[]>(() =>
  allLanes.value.map(
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
  shown.value.nodes.map((n): Node => {
    const type = n.type ?? "infra"
    const faded = !!emphasis.value && !emphasis.value.nodes.has(n.id)
    const state = diffState(n.id, diff.value?.addedNodes, diff.value?.changedNodes, diff.value?.removedNodes)
    const node: Node = {
      id: n.id,
      type,
      position: n.position,
      data: faded ? { ...n.data, dimmed: true } : n.data,
      zIndex: 1,
      ariaLabel: props.keyboardNav ? nodeName(n) : undefined,
      ...(n.parent ? { parentNode: n.parent } : {}),
      ...(n.parent && props.autoSizeGroups ? { expandParent: true } : {}),
    }
    if (state) {
      node.style = { outline: `2px solid ${DIFF_COLOR[state]}`, outlineOffset: "2px", borderRadius: "var(--radius-card)" }
    }
    if (type === "group") {
      // A host frame: a Vue Flow group node sized to hold its services.
      const given = { width: n.width ?? GROUP_WIDTH, height: n.height ?? GROUP_HEIGHT }
      const frame = props.autoSizeGroups
        ? frameSize(shown.value.nodes.filter((child) => child.parent === n.id).map(sized), { minWidth: given.width, minHeight: given.height })
        : given
      node.style = {
        ...node.style,
        width: `${frame.width}px`,
        height: `${frame.height}px`,
        background: "color-mix(in srgb, var(--color-surface-soft) 60%, transparent)",
        border: "1px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        opacity: faded || (n.data as { dimmed?: boolean }).dimmed ? "0.35" : "1",
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
  shown.value.edges.map((e) => {
    const obs = e.observed ?? "applied"
    const cat = edgeCategory(e)
    const state = diffState(e.id, diff.value?.addedEdges, diff.value?.changedEdges, diff.value?.removedEdges)
    const color = state ? DIFF_COLOR[state] : edgeColor(cat, obs)
    const lit = emphasis.value?.edges.has(e.id) ?? false
    const faded = e.dimmed || (!!emphasis.value && !lit)
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: props.edgeType ?? "default",
      data: { waypoints: e.waypoints },
      animated: obs !== "applied" && !faded,
      label: edgeLabelText(e),
      labelBgStyle: { fill: "var(--color-surface)" },
      labelStyle: { fill: "var(--color-muted-strong)", fontSize: "10px" },
      style: {
        stroke: color,
        strokeWidth: (cat === "structural" ? 1.5 : 2) + (lit && emphasis.value?.path ? PATH_EXTRA_WIDTH : 0),
        strokeDasharray: state === "removed" ? REMOVED_DASH : edgeDash(cat, obs),
        strokeLinecap: "round" as const,
        opacity: faded ? 0.12 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    }
  }),
)

onNodeClick(({ node }) => {
  focused.value = node.id
  emit("node-select", node.id)
})
// A node usually has two levels of interest — pick it out, or open it — and a
// single click cannot carry both. Hosts that only need one can ignore this.
onNodeDoubleClick(({ node }) => emit("node-activate", node.id))
// Drag settled → surface the node's final position so the host can persist it.
onNodeDragStop(({ node, nodes }) => {
  const next = new Map(moved.value)
  for (const dragged of nodes.length ? nodes : [node]) next.set(dragged.id, { ...dragged.position })
  moved.value = next
  emit("node-drag-stop", { id: node.id, position: { ...node.position } })
})
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
onPaneClick(() => {
  focused.value = null
  emit("pane-click")
})
onConnect((conn) => emit("connect", conn))

// The legend and the minimap float over the canvas, so a plain fit puts the
// outermost nodes under them. Fitting reserves their corner instead: the side
// they sit on gets their height on top of the usual margin. On a phone both
// are hidden and only the margin is left. What is reserved is what is on
// screen, and they go by the canvas's own width: a canvas in a narrow panel of
// a wide window is a phone-sized canvas too.
const legendBox = ref<HTMLElement | null>(null)
const MINIMAP_HEIGHT = 165
const FRAME = 24
function framePadding(): Padding {
  const legendShown = legendBox.value?.offsetHeight ?? 0
  const legendHeight = legendShown ? legendShown + 15 : 0
  const minimap = vueFlowRef.value?.querySelector<HTMLElement>(".vue-flow__minimap")
  const legendTop = props.legendPosition.startsWith("top")
  const bottom = Math.max(legendTop ? 0 : legendHeight, minimap?.offsetHeight ? MINIMAP_HEIGHT : 0)
  return {
    top: `${FRAME + (legendTop ? legendHeight : 0)}px`,
    bottom: `${FRAME + bottom}px`,
    left: `${FRAME}px`,
    right: `${FRAME}px`,
  }
}
function fitFramed(params: Parameters<typeof fitView>[0] = {}) {
  return fitView({ padding: framePadding(), ...params })
}
// Read when the button is pressed: the panels do not exist yet at first render.
const controlsFit = {
  get padding() {
    return framePadding()
  },
}
// The canvas fits itself once, on the first nodes: after that the view is the
// user's. A host whose data arrives in stages, or whose box changed size, calls
// the exposed `fitView` when it wants the whole graph back in frame.
let fitted = false
onNodesInitialized(() => {
  if (fitted) return
  fitted = true
  void fitFramed()
})

// Restore a saved viewport (pan/zoom). The host calls this after loading the
// user's persisted CanvasViewport on mount.
async function applyViewport(v: CanvasViewport): Promise<void> {
  await setViewport({ x: v.x, y: v.y, zoom: v.zoom })
}

function refit() {
  void nextTick(() => {
    const root = vueFlowRef.value
    if (root) nodeWindow(root).requestAnimationFrame(() => void fitFramed())
  })
}

// A new dataset is the one time the canvas takes the view back. The flag also
// covers data that lands a moment later and has to be measured first.
watch(() => props.dataRevision, () => {
  fitted = false
  refit()
})

let resizeFrame = 0
useResizeObserver(vueFlowRef, (_, el) => {
  if (props.fitOnResize !== "always" || !fitted || resizeFrame) return
  resizeFrame = nodeWindow(el).requestAnimationFrame(() => {
    resizeFrame = 0
    void fitFramed()
  })
})

const FOCUS_MAX_ZOOM = 1.2
const FOCUS_DURATION_MS = 300

function nodeElement(id: string): HTMLElement | null {
  const root = vueFlowRef.value
  if (!root) return null
  return root.querySelector<HTMLElement>(`.vue-flow__node[data-id="${nodeWindow(root).CSS.escape(id)}"]`)
}

/** Bring a node into view and pick it. False when it is not on the canvas. */
async function focusNode(id: string, options: { keepFocus?: boolean } = {}): Promise<boolean> {
  if (!findNode(id)) return false
  focused.value = id
  emit("node-select", id)
  await fitView({
    nodes: [id],
    maxZoom: FOCUS_MAX_ZOOM,
    padding: framePadding(),
    duration: prefersReducedMotion() ? 0 : FOCUS_DURATION_MS,
  })
  if (!options.keepFocus) nodeElement(id)?.focus()
  return true
}

let matchCursor = 0
watch(query, () => (matchCursor = 0))
function nextMatch() {
  const hits = matches.value
  if (!hits.length) return
  void focusNode(hits[matchCursor++ % hits.length]!.id, { keepFocus: true })
}

const selectedIds = computed(() => getSelectedNodes.value.map((n) => n.id))

const ARROWS: Record<string, GraphDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
}

// In the capture phase: Vue Flow's own arrow keys nudge the focused node.
function onKeydown(event: KeyboardEvent) {
  if (!props.keyboardNav || !isHTMLElement(event.target)) return
  const id = event.target.closest(".vue-flow__node")?.getAttribute("data-id")
  if (!id) return
  const direction = ARROWS[event.key]
  if (direction) {
    const next = nearestInDirection(absolutePositions(shown.value.nodes), id, direction)
    if (next) void focusNode(next)
  } else if (event.key === "Enter") emit("node-activate", id)
  else if (event.key === " ") {
    focused.value = id
    emit("node-select", id)
  } else return
  event.preventDefault()
  event.stopPropagation()
}

/* Wider than a lane's padding and label together, so group boxes stay apart. */
const LANE_BAND_GAP = 104
const OFFSCREEN = "position:absolute;left:-99999px;top:0;visibility:hidden"
const EXPORT_NODE_WIDTH = 220
const EXPORT_NODE_HEIGHT = 96

/**
 * Lay the graph out in layers, group by group under `groupBy`. The canvas moves
 * at once; `update:nodes` carries the new positions for a host to keep.
 */
function autoLayout(options: TopologyLayoutOptions = {}) {
  const positions = layeredLayout(placed.value.map(sized), current.value.edges, {
    groupGap: LANE_BAND_GAP,
    ...options,
    groupOf: props.groupBy ? (n) => groupOf(n as TopologyNode) : undefined,
  })
  moved.value = new Map([...moved.value, ...positions])
  emit("update:nodes", current.value.nodes.map((n) => {
    const position = positions.get(n.id)
    return position ? { ...n, position } : n
  }))
  refit()
}

/** The graph as a clean SVG: boxes, wires and names, not a capture of the cards. */
function exportSvg(): string | null {
  const root = vueFlowRef.value
  if (!root) return null
  const places = absolutePositions(shown.value.nodes)
  const color = (token: string) => resolveCssColor(`var(${token})`, root)
  return topologyToSvg(
    shown.value.nodes.map((n) => {
      const size = sized(n)
      return {
        ...places.get(n.id)!,
        id: n.id,
        label: nodeName(n),
        frame: n.type === "group",
        width: size.width ?? EXPORT_NODE_WIDTH,
        height: size.height ?? EXPORT_NODE_HEIGHT,
      }
    }),
    shown.value.edges.map((e) => {
      const obs = e.observed ?? "applied"
      const cat = edgeCategory(e)
      return { ...e, label: edgeLabelText(e), dash: edgeDash(cat, obs), color: resolveCssColor(edgeColor(cat, obs), root) }
    }),
    {
      background: backgroundOf(root) ?? color("--color-surface"),
      surface: color("--color-surface-raised"),
      line: color("--color-line-strong"),
      text: color("--color-ink"),
      edge: color("--color-brand"),
    },
  )
}

/** The same drawing as a PNG. */
async function exportPng(): Promise<Blob | null> {
  const svg = exportSvg()
  const root = vueFlowRef.value
  if (!svg || !root) return null
  const parsed = new (nodeWindow(root).DOMParser)().parseFromString(svg, "image/svg+xml")
  const drawing = root.ownerDocument.importNode(parsed.documentElement, true) as unknown as SVGSVGElement
  // In the page for as long as it takes: the rasteriser measures what it draws.
  drawing.style.cssText = OFFSCREEN
  root.append(drawing)
  try {
    return await svgToPng(drawing)
  } finally {
    drawing.remove()
  }
}

/** Replace the marquee selection, for a host driving it from a list. */
function selectNodes(ids: string[]) {
  removeSelectedNodes(getSelectedNodes.value)
  addSelectedNodes(getNodes.value.filter((n) => ids.includes(n.id)))
}

defineExpose({
  fitView: fitFramed,
  setViewport: applyViewport,
  focusNode,
  searchNodes: (query: string) => findNodes(shown.value.nodes, query).map((n) => n.id),
  autoLayout,
  exportSvg,
  exportPng,
  selectNodes,
})
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
    @keydown.capture="onKeydown"
    :default-viewport="{ zoom: 0.9 }"
    :min-zoom="0.3"
    :max-zoom="2"
    class="lp-topology @container"
  >
    <Background :gap="22" :size="1.4" pattern-color="var(--color-line-strong)" />
    <!-- On a phone the minimap, the zoom controls and the legend would all
         share the bottom of a canvas a few hundred pixels wide and cover each
         other and the graph; pinch-zoom and panning do the minimap's job there. -->
    <MiniMap
      v-if="minimap"
      class="@max-[40rem]:!hidden"
      pannable
      zoomable
      node-color="var(--color-surface-soft)"
      mask-color="rgba(0,0,0,0.55)"
    />
    <Controls v-if="controls" :fit-view-params="controlsFit" />

    <Panel v-if="search" position="top-left" class="nodrag nopan w-56">
      <LpInput
        v-model="query"
        type="search"
        :aria-label="text.search"
        :placeholder="text.search"
        @keydown.enter.prevent="nextMatch"
      />
      <p v-if="query.trim()" class="mt-1 text-xs text-muted" role="status">
        {{ text.searchResults.replace("{n}", String(matches.length)) }}
      </p>
    </Panel>

    <Panel
      v-if="selectionActions?.length && selectedIds.length > 1"
      position="top-right"
      class="nodrag nopan flex items-center gap-2 rounded-card border border-line bg-surface-overlay/90 px-3 py-2 text-xs text-muted backdrop-blur"
    >
      <span>{{ text.selected.replace("{n}", String(selectedIds.length)) }}</span>
      <LpButton
        v-for="action in selectionActions"
        :key="action.id"
        size="sm"
        variant="outline"
        :icon="action.icon"
        @click="emit('selection-action', { action: action.id, ids: selectedIds })"
      >
        {{ action.label }}
      </LpButton>
    </Panel>

    <Panel
      v-if="(timeline?.length ?? 0) > 1"
      position="bottom-center"
      class="nodrag nopan flex w-72 max-w-[60%] flex-col gap-1 rounded-card border border-line bg-surface-overlay/90 px-3 py-2 text-xs text-muted backdrop-blur"
    >
      <span>{{ timeline?.[versionIndex]?.label ?? `${text.timeline} ${versionIndex + 1}` }}</span>
      <LpSlider
        :model-value="versionIndex"
        :min="0"
        :max="(timeline?.length ?? 1) - 1"
        :step="1"
        :aria-label="text.timeline"
        @update:model-value="timelineIndex = $event"
      />
    </Panel>

    <!-- Edge-type legend: makes the colour/dash encoding self-explanatory. -->
    <!-- On a phone the legend would sit on the graph itself; the edge styles
         stay readable without it there. -->
    <Panel v-if="legend" :position="legendPosition" :class="legendOffset" class="@max-[40rem]:hidden">
      <div
        ref="legendBox"
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
        <!-- Edges are only half of what a graph encodes; a node also carries
             state (offline, stale readings) that the legend cannot know the
             meaning of. The host explains its own node encoding here. -->
        <slot name="legend-extra" />
      </div>
    </Panel>
  </VueFlow>
</template>

<!-- Styling lives in src/canvas.css (shipped via @leavepulse/ui/canvas.css) so
     the Vue Flow base CSS + chrome theming reaches consuming apps reliably. -->
