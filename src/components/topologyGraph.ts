/*
 * The graph logic behind LpTopologyCanvas: paths, neighbours, version diffs,
 * layout and clustering. Plain functions over plain data, with no Vue Flow and
 * no DOM, so each can be tested alone and an app can run them on its own data.
 */

export interface GraphPoint {
  x: number
  y: number
}

export interface GraphNode {
  id: string
  position: GraphPoint
  parent?: string
  width?: number
  height?: number
  type?: string
  label?: string
  data?: unknown
}

export interface GraphEdge {
  id: string
  source: string
  target: string
}

export interface GraphPath {
  nodes: string[]
  edges: string[]
}

export interface PathOptions {
  /** Follow edges only from source to target. Default false: a wire goes both ways. */
  directed?: boolean
  /** Leave out edges that may not be walked (a drifted link, a hidden kind). */
  allow?: (edge: GraphEdge) => boolean
}

/** What touches a node: itself, the nodes one edge away, and those edges. */
export function neighborhood(edges: readonly GraphEdge[], id: string): GraphPath {
  const nodes = new Set([id])
  const touching: string[] = []
  for (const edge of edges) {
    if (edge.source !== id && edge.target !== id) continue
    nodes.add(edge.source)
    nodes.add(edge.target)
    touching.push(edge.id)
  }
  return { nodes: [...nodes], edges: touching }
}

/** The shortest path by hop count, or null when the two are not connected. */
export function findPath(
  edges: readonly GraphEdge[],
  from: string,
  to: string,
  options: PathOptions = {},
): GraphPath | null {
  const links = new Map<string, { next: string; edge: string }[]>()
  const link = (a: string, b: string, edge: string) => {
    const list = links.get(a)
    if (list) list.push({ next: b, edge })
    else links.set(a, [{ next: b, edge }])
  }
  for (const edge of edges) {
    if (options.allow && !options.allow(edge)) continue
    link(edge.source, edge.target, edge.id)
    if (!options.directed) link(edge.target, edge.source, edge.id)
  }

  const cameBy = new Map<string, { from: string; edge: string } | null>([[from, null]])
  const queue = [from]
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!
    if (at === to) break
    for (const { next, edge } of links.get(at) ?? []) {
      if (cameBy.has(next)) continue
      cameBy.set(next, { from: at, edge })
      queue.push(next)
    }
  }
  if (!cameBy.has(to)) return null

  const path: GraphPath = { nodes: [to], edges: [] }
  for (let step = cameBy.get(to); step; step = cameBy.get(step.from)) {
    path.nodes.unshift(step.from)
    path.edges.unshift(step.edge)
  }
  return path
}

export interface TopologyDiff {
  addedNodes: string[]
  removedNodes: string[]
  changedNodes: string[]
  addedEdges: string[]
  removedEdges: string[]
  changedEdges: string[]
}

/*
 * Position is left out of a node's comparison: dragging a card changes nothing
 * about the infrastructure. `dimmed` is display state and goes the same way.
 */
function fingerprint(item: object): string {
  const { position: _position, dimmed: _dimmed, data, ...rest } = item as Record<string, unknown>
  const { dimmed: _dataDimmed, ...own } = (data ?? {}) as Record<string, unknown>
  return JSON.stringify([rest, own], (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  )
}

function compare<T extends { id: string }>(before: readonly T[], after: readonly T[]) {
  const old = new Map(before.map((item) => [item.id, item]))
  const fresh = new Set(after.map((item) => item.id))
  return {
    added: after.filter((item) => !old.has(item.id)).map((item) => item.id),
    removed: before.filter((item) => !fresh.has(item.id)).map((item) => item.id),
    changed: after
      .filter((item) => old.has(item.id) && fingerprint(old.get(item.id)!) !== fingerprint(item))
      .map((item) => item.id),
  }
}

/** What changed between two versions of a graph, by id. */
export function diffTopology(
  before: { nodes: readonly GraphNode[]; edges: readonly GraphEdge[] },
  after: { nodes: readonly GraphNode[]; edges: readonly GraphEdge[] },
): TopologyDiff {
  const nodes = compare(before.nodes, after.nodes)
  const edges = compare(before.edges, after.edges)
  return {
    addedNodes: nodes.added,
    removedNodes: nodes.removed,
    changedNodes: nodes.changed,
    addedEdges: edges.added,
    removedEdges: edges.removed,
    changedEdges: edges.changed,
  }
}

export interface LayoutOptions {
  /** Which way the layers run. Default "LR": columns, left to right. */
  direction?: "LR" | "TB"
  /** Space between layers. */
  layerGap?: number
  /** Space between nodes of one layer. */
  nodeGap?: number
  /** Size of a node that carries none. */
  nodeWidth?: number
  nodeHeight?: number
  /** Lay each group out on its own, one band after another. */
  groupOf?: (node: GraphNode) => string | undefined
  /** Space between group bands. */
  groupGap?: number
}

const DEFAULT_NODE_WIDTH = 220
const DEFAULT_NODE_HEIGHT = 96
const DEFAULT_LAYER_GAP = 96
const DEFAULT_NODE_GAP = 32
const DEFAULT_GROUP_GAP = 72
/* Down and up again twice settles a small graph's crossings; more buys little. */
const ORDER_SWEEPS = 4

/** The outermost node each node sits in: edges between children count for it. */
function topLevelOf(nodes: readonly GraphNode[]): Map<string, string> {
  const parents = new Map(nodes.map((node) => [node.id, node.parent]))
  const top = new Map<string, string>()
  for (const node of nodes) {
    let at = node.id
    const seen = new Set([at])
    for (let up = parents.get(at); up && parents.has(up) && !seen.has(up); up = parents.get(at)) {
      at = up
      seen.add(at)
    }
    top.set(node.id, at)
  }
  return top
}

/** Links between distinct top-level nodes, each pair once, with cycles broken. */
function acyclicLinks(ids: readonly string[], links: readonly [string, string][]): [string, string][] {
  const out = new Map(ids.map((id): [string, string[]] => [id, []]))
  for (const [a, b] of links) {
    const list = out.get(a)
    if (list && out.has(b) && a !== b && !list.includes(b)) list.push(b)
  }
  const state = new Map<string, "open" | "done">()
  const kept: [string, string][] = []
  // Walked with its own stack: a long chain must not exhaust the call stack.
  for (const root of ids) {
    if (state.has(root)) continue
    state.set(root, "open")
    const stack: { id: string; next: number }[] = [{ id: root, next: 0 }]
    while (stack.length) {
      const top = stack[stack.length - 1]!
      const target = out.get(top.id)![top.next++]
      if (target === undefined) {
        state.set(top.id, "done")
        stack.pop()
      } else if (state.get(target) !== "open") {
        kept.push([top.id, target])
        if (!state.has(target)) {
          state.set(target, "open")
          stack.push({ id: target, next: 0 })
        }
      }
    }
  }
  return kept
}

/** Each id's layer: one past the deepest node leading to it. */
function rankOf(ids: readonly string[], links: readonly [string, string][]): Map<string, number> {
  const rank = new Map(ids.map((id) => [id, 0]))
  const waiting = new Map(ids.map((id) => [id, 0]))
  const out = new Map(ids.map((id): [string, string[]] => [id, []]))
  for (const [a, b] of links) {
    out.get(a)!.push(b)
    waiting.set(b, waiting.get(b)! + 1)
  }
  const queue = ids.filter((id) => waiting.get(id) === 0)
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!
    for (const next of out.get(at)!) {
      rank.set(next, Math.max(rank.get(next)!, rank.get(at)! + 1))
      waiting.set(next, waiting.get(next)! - 1)
      if (waiting.get(next) === 0) queue.push(next)
    }
  }
  return rank
}

/** Orders each layer by the mean place of its neighbours, to cut crossings. */
function orderLayers(layers: string[][], links: readonly [string, string][]): void {
  const around = new Map<string, string[]>()
  const add = (a: string, b: string) => around.set(a, [...(around.get(a) ?? []), b])
  for (const [a, b] of links) {
    add(a, b)
    add(b, a)
  }
  for (let sweep = 0; sweep < ORDER_SWEEPS; sweep++) {
    const down = sweep % 2 === 0
    const place = new Map(layers.flatMap((layer) => layer.map((id, i): [string, number] => [id, i])))
    for (let i = 0; i < layers.length; i++) {
      const at = down ? i : layers.length - 1 - i
      const weight = (id: string, fallback: number) => {
        const known = (around.get(id) ?? []).map((other) => place.get(other)!).filter((n) => n !== undefined)
        return known.length ? known.reduce((sum, n) => sum + n, 0) / known.length : fallback
      }
      const ranked = layers[at]!.map((id, index) => ({ id, index, weight: weight(id, index) }))
      ranked.sort((a, b) => a.weight - b.weight || a.index - b.index)
      layers[at] = ranked.map((entry) => entry.id)
      layers[at]!.forEach((id, index) => place.set(id, index))
    }
  }
}

/*
 * A simple layered drawing: edges run one way across the layers, cycles broken
 * at their back edge. A node inside another keeps its place in it, so only
 * top-level nodes get a position; their children's edges count for them.
 */
export function layeredLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  options: LayoutOptions = {},
): Map<string, GraphPoint> {
  const vertical = options.direction === "TB"
  const layerGap = options.layerGap ?? DEFAULT_LAYER_GAP
  const nodeGap = options.nodeGap ?? DEFAULT_NODE_GAP
  const groupGap = options.groupGap ?? DEFAULT_GROUP_GAP
  const width = (node: GraphNode) => node.width ?? options.nodeWidth ?? DEFAULT_NODE_WIDTH
  const height = (node: GraphNode) => node.height ?? options.nodeHeight ?? DEFAULT_NODE_HEIGHT
  const along = (node: GraphNode) => (vertical ? height(node) : width(node))
  const across = (node: GraphNode) => (vertical ? width(node) : height(node))

  const top = topLevelOf(nodes)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const roots = nodes.filter((node) => top.get(node.id) === node.id)
  const links = edges.flatMap((edge): [string, string][] => {
    const a = top.get(edge.source)
    const b = top.get(edge.target)
    return a && b ? [[a, b]] : []
  })

  const bands = new Map<string, GraphNode[]>()
  for (const node of roots) {
    const key = options.groupOf?.(node) ?? ""
    const band = bands.get(key)
    if (band) band.push(node)
    else bands.set(key, [node])
  }

  const positions = new Map<string, GraphPoint>()
  let bandStart = 0
  for (const band of bands.values()) {
    const ids = band.map((node) => node.id)
    const acyclic = acyclicLinks(ids, links)
    const rank = rankOf(ids, acyclic)
    const layers: string[][] = []
    for (const id of ids) (layers[rank.get(id)!] ??= []).push(id)
    orderLayers(layers, acyclic)

    const extent = (layer: string[]) =>
      layer.reduce((sum, id) => sum + across(byId.get(id)!) + nodeGap, -nodeGap)
    const bandSize = Math.max(...layers.map(extent))
    let main = 0
    for (const layer of layers) {
      let cross = bandStart + (bandSize - extent(layer)) / 2
      for (const id of layer) {
        positions.set(id, vertical ? { x: cross, y: main } : { x: main, y: cross })
        cross += across(byId.get(id)!) + nodeGap
      }
      main += Math.max(...layer.map((id) => along(byId.get(id)!))) + layerGap
    }
    bandStart += bandSize + groupGap
  }
  return positions
}

export interface GraphBox extends GraphPoint {
  width: number
  height: number
}

export interface LaneOptions {
  padding?: number
  /** Room over the nodes for the lane's label. */
  header?: number
  nodeWidth?: number
  nodeHeight?: number
}

const LANE_PADDING = 24
const LANE_HEADER = 28

/** One box per group, around its top-level nodes where they stand now. */
export function groupBoxes(
  nodes: readonly GraphNode[],
  keyOf: (node: GraphNode) => string | undefined,
  options: LaneOptions = {},
): { key: string; box: GraphBox }[] {
  const padding = options.padding ?? LANE_PADDING
  const header = options.header ?? LANE_HEADER
  const edges = new Map<string, { left: number; top: number; right: number; bottom: number }>()
  for (const node of nodes) {
    const key = node.parent ? undefined : keyOf(node)
    if (key === undefined) continue
    const { x, y } = node.position
    const right = x + (node.width ?? options.nodeWidth ?? DEFAULT_NODE_WIDTH)
    const bottom = y + (node.height ?? options.nodeHeight ?? DEFAULT_NODE_HEIGHT)
    const seen = edges.get(key)
    edges.set(key, seen
      ? { left: Math.min(seen.left, x), top: Math.min(seen.top, y), right: Math.max(seen.right, right), bottom: Math.max(seen.bottom, bottom) }
      : { left: x, top: y, right, bottom })
  }
  return [...edges].map(([key, e]) => ({
    key,
    box: {
      x: e.left - padding,
      y: e.top - padding - header,
      width: e.right - e.left + padding * 2,
      height: e.bottom - e.top + padding * 2 + header,
    },
  }))
}

export interface FrameOptions {
  padding?: number
  minWidth?: number
  minHeight?: number
  childWidth?: number
  childHeight?: number
}

const CHILD_WIDTH = 170
const CHILD_HEIGHT = 56
const FRAME_PADDING = 16

/** The frame that holds these children, whose positions are relative to it. */
export function frameSize(children: readonly GraphNode[], options: FrameOptions = {}): { width: number; height: number } {
  const padding = options.padding ?? FRAME_PADDING
  let width = options.minWidth ?? 0
  let height = options.minHeight ?? 0
  for (const child of children) {
    width = Math.max(width, child.position.x + (child.width ?? options.childWidth ?? CHILD_WIDTH) + padding)
    height = Math.max(height, child.position.y + (child.height ?? options.childHeight ?? CHILD_HEIGHT) + padding)
  }
  return { width, height }
}

export interface MergedEdge extends GraphEdge {
  /** The original edges this one stands for. */
  members: string[]
}

/**
 * Edges redrawn between what their ends stand for now: inner ones go, and
 * parallel ones become one, keeping which they were.
 */
export function mergeEdges(edges: readonly GraphEdge[], mapId: (id: string) => string | undefined): MergedEdge[] {
  const merged = new Map<string, MergedEdge>()
  for (const edge of edges) {
    const source = mapId(edge.source)
    const target = mapId(edge.target)
    if (source === undefined || target === undefined || source === target) continue
    const id = `${source}\u0000${target}`
    const seen = merged.get(id)
    if (seen) seen.members.push(edge.id)
    else merged.set(id, { id, source, target, members: [edge.id] })
  }
  return [...merged.values()]
}

export interface GraphCluster {
  id: string
  key: string
  position: GraphPoint
  members: string[]
}

export interface ClusteredGraph<N extends GraphNode> {
  nodes: N[]
  clusters: GraphCluster[]
  edges: MergedEdge[]
}

const CLUSTER_PREFIX = "lp-cluster:"

/**
 * Collapses each group into one cluster at the middle of its top-level nodes.
 * A node with no group stays; a child goes with whatever holds it.
 */
export function clusterGraph<N extends GraphNode>(
  nodes: readonly N[],
  edges: readonly GraphEdge[],
  keyOf: (node: N) => string | undefined,
): ClusteredGraph<N> {
  const top = topLevelOf(nodes)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const groups = new Map<string, N[]>()
  const standsFor = new Map<string, string>()
  for (const node of nodes) {
    const root = byId.get(top.get(node.id)!)!
    const key = keyOf(root)
    if (key === undefined) {
      standsFor.set(node.id, node.id)
      continue
    }
    standsFor.set(node.id, CLUSTER_PREFIX + key)
    if (node !== root) continue
    const group = groups.get(key)
    if (group) group.push(node)
    else groups.set(key, [node])
  }
  const clusters = [...groups].map(([key, members]): GraphCluster => ({
    id: CLUSTER_PREFIX + key,
    key,
    position: {
      x: members.reduce((sum, node) => sum + node.position.x, 0) / members.length,
      y: members.reduce((sum, node) => sum + node.position.y, 0) / members.length,
    },
    members: nodes.filter((node) => standsFor.get(node.id) === CLUSTER_PREFIX + key).map((node) => node.id),
  }))
  return {
    nodes: nodes.filter((node) => standsFor.get(node.id) === node.id),
    clusters,
    edges: mergeEdges(edges, (id) => standsFor.get(id)),
  }
}

/** Drops children, with their edges moved up to whatever holds them. */
export function collapseChildren<N extends GraphNode>(
  nodes: readonly N[],
  edges: readonly GraphEdge[],
): { nodes: N[]; edges: MergedEdge[] } {
  const top = topLevelOf(nodes)
  return { nodes: nodes.filter((node) => top.get(node.id) === node.id), edges: mergeEdges(edges, (id) => top.get(id)) }
}

export type DetailLevel = "full" | "simple" | "overview"

export const SIMPLE_BELOW_ZOOM = 0.7
export const OVERVIEW_BELOW_ZOOM = 0.45

/** How much of the graph to draw at a zoom. Clusters need groups to exist. */
export function detailAtZoom(zoom: number, grouped: boolean): DetailLevel {
  if (zoom < OVERVIEW_BELOW_ZOOM && grouped) return "overview"
  return zoom < SIMPLE_BELOW_ZOOM ? "simple" : "full"
}

/** Where every node really is: a child's position is relative to its parent. */
export function absolutePositions(nodes: readonly GraphNode[]): Map<string, GraphPoint> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const resolved = new Map<string, GraphPoint>()
  const resolve = (node: GraphNode, seen: Set<string>): GraphPoint => {
    const known = resolved.get(node.id)
    if (known) return known
    const parent = node.parent ? byId.get(node.parent) : undefined
    const base = parent && !seen.has(parent.id) ? resolve(parent, seen.add(node.id)) : { x: 0, y: 0 }
    const point = { x: base.x + node.position.x, y: base.y + node.position.y }
    resolved.set(node.id, point)
    return point
  }
  for (const node of nodes) resolve(node, new Set())
  return resolved
}

export function nodeName(node: GraphNode): string {
  const name = (node.data as { name?: unknown } | undefined)?.name
  return node.label ?? (typeof name === "string" ? name : node.id)
}

/** Nodes matching a query, by name or id: names first, then earlier matches. */
export function findNodes<N extends GraphNode>(nodes: readonly N[], query: string): N[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const score = (node: N) => {
    const at = nodeName(node).toLowerCase().indexOf(needle)
    if (at === 0) return 0
    if (at > 0) return 1
    return node.id.toLowerCase().includes(needle) ? 2 : -1
  }
  return nodes
    .map((node) => ({ node, rank: score(node) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.node)
}

export type GraphDirection = "up" | "down" | "left" | "right"

/* A step sideways costs this much more than a step the way the arrow points. */
const OFF_AXIS_PENALTY = 2

/** The closest node the way an arrow key points, or null at the edge of the graph. */
export function nearestInDirection(
  positions: ReadonlyMap<string, GraphPoint>,
  from: string,
  direction: GraphDirection,
): string | null {
  const origin = positions.get(from)
  if (!origin) return null
  let best: string | null = null
  let bestCost = Infinity
  for (const [id, point] of positions) {
    if (id === from) continue
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const main = { up: -dy, down: dy, left: -dx, right: dx }[direction]
    if (main <= 0) continue
    const side = direction === "up" || direction === "down" ? dx : dy
    const cost = main + Math.abs(side) * OFF_AXIS_PENALTY
    if (cost < bestCost) {
      bestCost = cost
      best = id
    }
  }
  return best
}

export interface EdgeReading {
  kind?: string
  /** Round-trip time, in milliseconds. */
  rtt?: number
  /** Packet loss, in percent. */
  loss?: number
}

/** The edge's label: its kind, then whatever was measured on it. */
export function edgeLabelText(edge: EdgeReading): string | undefined {
  const parts = [
    edge.kind,
    edge.rtt === undefined ? undefined : `${Math.round(edge.rtt)} ms`,
    edge.loss === undefined ? undefined : `${edge.loss}% loss`,
  ].filter((part) => part !== undefined)
  return parts.length ? parts.join(" · ") : undefined
}

export interface SvgTheme {
  background: string
  surface: string
  line: string
  text: string
  edge: string
}

export interface SvgNode extends GraphBox {
  id: string
  label: string
  /** A frame holding other nodes: drawn behind them, label at the top. */
  frame?: boolean
}

export interface SvgEdge extends GraphEdge {
  label?: string
  color?: string
  dash?: string
}

const SVG_MARGIN = 24
const SVG_RADIUS = 10
const SVG_FONT_SIZE = 12
const SVG_FRAME_LABEL_Y = 18

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/*
 * A clean drawing of the graph rather than a capture of the screen: the cards
 * are HTML, which only goes into an SVG as foreignObject, and that taints the
 * canvas a PNG is drawn on. Boxes, curves and names survive; card detail does not.
 */
export function topologyToSvg(nodes: readonly SvgNode[], edges: readonly SvgEdge[], theme: SvgTheme): string {
  const left = Math.min(0, ...nodes.map((n) => n.x)) - SVG_MARGIN
  const top = Math.min(0, ...nodes.map((n) => n.y)) - SVG_MARGIN
  const width = Math.max(0, ...nodes.map((n) => n.x + n.width)) + SVG_MARGIN - left
  const height = Math.max(0, ...nodes.map((n) => n.y + n.height)) + SVG_MARGIN - top
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const middle = (n: SvgNode) => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 })

  const wires = edges.flatMap((edge) => {
    const from = byId.get(edge.source)
    const to = byId.get(edge.target)
    if (!from || !to) return []
    const a = middle(from)
    const b = middle(to)
    const dash = edge.dash && edge.dash !== "0" ? ` stroke-dasharray="${escapeXml(edge.dash)}"` : ""
    const line = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${escapeXml(edge.color ?? theme.edge)}" stroke-width="2"${dash}/>`
    const label = edge.label
      ? `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2}" text-anchor="middle" fill="${escapeXml(theme.text)}">${escapeXml(edge.label)}</text>`
      : ""
    return [line + label]
  })

  const box = (n: SvgNode) => {
    const textX = n.x + n.width / 2
    const textY = n.frame ? n.y + SVG_FRAME_LABEL_Y : n.y + n.height / 2
    return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${SVG_RADIUS}" fill="${escapeXml(theme.surface)}" stroke="${escapeXml(theme.line)}"/>`
      + `<text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle" fill="${escapeXml(theme.text)}">${escapeXml(n.label)}</text>`
  }
  // Frames go down first, or they would cover the wires and nodes inside them.
  const frames = nodes.filter((n) => n.frame).map(box)
  const cards = nodes.filter((n) => !n.frame).map(box)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${left} ${top} ${width} ${height}" font-family="sans-serif" font-size="${SVG_FONT_SIZE}">`
    + `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${escapeXml(theme.background)}"/>`
    + frames.join("") + wires.join("") + cards.join("") + "</svg>"
}
