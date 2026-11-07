import { expect, test } from "bun:test"
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
  mergeEdges,
  nearestInDirection,
  neighborhood,
  topologyToSvg,
  type GraphEdge,
  type GraphNode,
} from "../src/components/topologyGraph"

const at = (id: string, x = 0, y = 0, extra: Partial<GraphNode> = {}): GraphNode => ({ id, position: { x, y }, ...extra })
const edge = (id: string, source: string, target: string): GraphEdge => ({ id, source, target })
const chain = [edge("ab", "a", "b"), edge("bc", "b", "c"), edge("cd", "c", "d")]

test("neighbours are the node, those one edge away, and those edges", () => {
  expect(neighborhood(chain, "b")).toEqual({ nodes: ["b", "a", "c"], edges: ["ab", "bc"] })
  expect(neighborhood(chain, "lonely")).toEqual({ nodes: ["lonely"], edges: [] })
  expect(neighborhood([], "a")).toEqual({ nodes: ["a"], edges: [] })
})

test("the shortest path is found, in order, with its edges", () => {
  const edges = [...chain, edge("ad", "a", "d")]
  expect(findPath(edges, "a", "d")).toEqual({ nodes: ["a", "d"], edges: ["ad"] })
  expect(findPath(chain, "a", "d")).toEqual({ nodes: ["a", "b", "c", "d"], edges: ["ab", "bc", "cd"] })
})

test("a path to itself is the node alone, and no path is null", () => {
  expect(findPath(chain, "a", "a")).toEqual({ nodes: ["a"], edges: [] })
  expect(findPath(chain, "a", "z")).toBeNull()
  expect(findPath([], "a", "b")).toBeNull()
})

test("a path can respect direction and skip edges", () => {
  expect(findPath(chain, "d", "a")?.nodes).toEqual(["d", "c", "b", "a"])
  expect(findPath(chain, "d", "a", { directed: true })).toBeNull()
  expect(findPath(chain, "a", "d", { allow: (e) => e.id !== "bc" })).toBeNull()
})

test("a cycle does not trap the search", () => {
  const edges = [edge("ab", "a", "b"), edge("ba", "b", "a"), edge("bc", "b", "c")]
  expect(findPath(edges, "a", "c")?.nodes).toEqual(["a", "b", "c"])
})

test("a diff names what was added, removed and changed", () => {
  const before = { nodes: [at("a", 0, 0, { data: { name: "A" } }), at("b")], edges: [edge("ab", "a", "b")] }
  const after = {
    nodes: [at("a", 500, 500, { data: { name: "A2" } }), at("c")],
    edges: [{ ...edge("ab", "a", "c") }, edge("ac", "a", "c")],
  }
  expect(diffTopology(before, after)).toEqual({
    addedNodes: ["c"], removedNodes: ["b"], changedNodes: ["a"],
    addedEdges: ["ac"], removedEdges: [], changedEdges: ["ab"],
  })
})

test("moving or dimming a node is no change, and neither is key order", () => {
  const before = { nodes: [at("a", 0, 0, { data: { name: "A", role: "x" } })], edges: [] }
  const after = { nodes: [at("a", 9, 9, { data: { role: "x", dimmed: true, name: "A" } })], edges: [] }
  const diff = diffTopology(before, after)
  expect(diff.changedNodes).toEqual([])
  expect(diffTopology({ nodes: [], edges: [] }, { nodes: [], edges: [] }).addedNodes).toEqual([])
})

test("layers follow the edges", () => {
  const nodes = ["a", "b", "c"].map((id) => at(id))
  const layout = layeredLayout(nodes, [edge("ab", "a", "b"), edge("bc", "b", "c"), edge("ac", "a", "c")])
  expect(layout.get("a")!.x).toBeLessThan(layout.get("b")!.x)
  expect(layout.get("b")!.x).toBeLessThan(layout.get("c")!.x)
})

test("the vertical direction runs the layers down", () => {
  const layout = layeredLayout([at("a"), at("b")], [edge("ab", "a", "b")], { direction: "TB" })
  expect(layout.get("a")!.y).toBeLessThan(layout.get("b")!.y)
  expect(layout.get("a")!.x).toBe(layout.get("b")!.x)
})

test("a cycle still lays out, and no two nodes share a place", () => {
  const nodes = ["a", "b", "c"].map((id) => at(id))
  const layout = layeredLayout(nodes, [edge("ab", "a", "b"), edge("bc", "b", "c"), edge("ca", "c", "a")])
  expect(layout.size).toBe(3)
  expect(new Set([...layout.values()].map((p) => `${p.x},${p.y}`)).size).toBe(3)
})

test("an empty graph, and edges to unknown nodes or to themselves, are harmless", () => {
  expect(layeredLayout([], []).size).toBe(0)
  expect(layeredLayout([at("a")], [edge("x", "a", "ghost"), edge("self", "a", "a")]).get("a")).toEqual({ x: 0, y: 0 })
})

test("a long chain does not exhaust the stack", () => {
  const ids = Array.from({ length: 20000 }, (_, i) => `n${i}`)
  const edges = ids.slice(1).map((id, i) => edge(id, ids[i]!, id))
  expect(layeredLayout(ids.map((id) => at(id)), edges).size).toBe(ids.length)
})

test("a child keeps its place and its edges count for the parent", () => {
  const nodes = [at("host"), at("svc", 5, 5, { parent: "host" }), at("other")]
  const layout = layeredLayout(nodes, [edge("e", "svc", "other")])
  expect(layout.has("svc")).toBe(false)
  expect(layout.get("host")!.x).toBeLessThan(layout.get("other")!.x)
})

test("groups get separate bands that do not overlap", () => {
  const nodes = [at("a", 0, 0, { data: { region: "eu" } }), at("b", 0, 0, { data: { region: "us" } })]
  const layout = layeredLayout(nodes, [], { groupOf: (n) => (n.data as { region: string }).region })
  expect(layout.get("b")!.y).toBeGreaterThanOrEqual(layout.get("a")!.y + 96)
})

test("a group box wraps its top-level nodes and skips the rest", () => {
  const nodes = [at("a", 0, 0), at("b", 100, 50), at("kid", 1, 1, { parent: "a" }), at("free", 900, 900)]
  const boxes = groupBoxes(nodes, (n) => (n.id === "free" ? undefined : "g"), { nodeWidth: 10, nodeHeight: 10, padding: 5, header: 0 })
  expect(boxes).toEqual([{ key: "g", box: { x: -5, y: -5, width: 120, height: 70 } }])
  expect(groupBoxes([], () => "g")).toEqual([])
})

test("a frame fits its children and respects its minimum", () => {
  expect(frameSize([at("a", 100, 40, { width: 50, height: 20 })], { padding: 10 })).toEqual({ width: 160, height: 70 })
  expect(frameSize([], { minWidth: 260, minHeight: 160 })).toEqual({ width: 260, height: 160 })
})

test("merged edges drop inner ones and fold parallels", () => {
  const edges = [edge("1", "a", "b"), edge("2", "a2", "b"), edge("3", "a", "a2"), edge("4", "a", "gone")]
  const merged = mergeEdges(edges, (id) => (id === "gone" ? undefined : id.slice(0, 1)))
  expect(merged.map((e) => [e.source, e.target, e.members])).toEqual([["a", "b", ["1", "2"]]])
})

test("clusters take their members, children included, and keep the rest", () => {
  const nodes = [at("a", 0, 0), at("b", 10, 20), at("kid", 1, 1, { parent: "a" }), at("free")]
  const key = (n: GraphNode) => (n.id === "a" || n.id === "b" ? "eu" : undefined)
  const graph = clusterGraph(nodes, [edge("1", "kid", "free"), edge("2", "a", "b")], key)
  expect(graph.nodes.map((n) => n.id)).toEqual(["free"])
  expect(graph.clusters).toEqual([{ id: "lp-cluster:eu", key: "eu", position: { x: 5, y: 10 }, members: ["a", "b", "kid"] }])
  expect(graph.edges.map((e) => [e.source, e.target])).toEqual([["lp-cluster:eu", "free"]])
})

test("collapsing children moves their edges up", () => {
  const nodes = [at("h"), at("s", 0, 0, { parent: "h" }), at("x")]
  const graph = collapseChildren(nodes, [edge("1", "s", "x")])
  expect(graph.nodes.map((n) => n.id)).toEqual(["h", "x"])
  expect(graph.edges.map((e) => e.source)).toEqual(["h"])
})

test("detail drops with zoom, and clusters need groups", () => {
  expect(detailAtZoom(1, true)).toBe("full")
  expect(detailAtZoom(0.5, true)).toBe("simple")
  expect(detailAtZoom(0.4, true)).toBe("overview")
  expect(detailAtZoom(0.4, false)).toBe("simple")
})

test("a child's place adds up through its parents, and a loop ends", () => {
  const nodes = [at("a", 10, 10), at("b", 1, 2, { parent: "a" }), at("c", 1, 1, { parent: "b" })]
  expect(absolutePositions(nodes).get("c")).toEqual({ x: 12, y: 13 })
  expect(absolutePositions([at("x", 1, 1, { parent: "y" }), at("y", 1, 1, { parent: "x" })]).size).toBe(2)
})

test("search ranks a name start first, then inside a name, then an id", () => {
  const nodes = [at("id-gate", 0, 0, { data: { name: "Other" } }), at("n1", 0, 0, { data: { name: "My gate" } }), at("n2", 0, 0, { data: { name: "Gateway" } })]
  expect(findNodes(nodes, "GATE").map((n) => n.id)).toEqual(["n2", "n1", "id-gate"])
  expect(findNodes(nodes, "  ")).toEqual([])
  expect(findNodes(nodes, "zzz")).toEqual([])
})

test("an arrow goes to the closest node that way, or nowhere", () => {
  const places = new Map([["o", { x: 0, y: 0 }], ["near", { x: 100, y: 10 }], ["far", { x: 300, y: 0 }], ["up", { x: 0, y: -100 }]])
  expect(nearestInDirection(places, "o", "right")).toBe("near")
  expect(nearestInDirection(places, "o", "up")).toBe("up")
  expect(nearestInDirection(places, "o", "left")).toBeNull()
  expect(nearestInDirection(places, "ghost", "up")).toBeNull()
})

test("an edge label carries what was measured", () => {
  expect(edgeLabelText({ kind: "wg", rtt: 12.4, loss: 0.5 })).toBe("wg · 12 ms · 0.5% loss")
  expect(edgeLabelText({ kind: "wg" })).toBe("wg")
  expect(edgeLabelText({ rtt: 0 })).toBe("0 ms")
  expect(edgeLabelText({})).toBeUndefined()
})

test("the SVG escapes names and draws frames behind wires and cards", () => {
  const theme = { background: "#000", surface: "#111", line: "#222", text: "#fff", edge: "#0ff" }
  const svg = topologyToSvg(
    [
      { id: "f", label: "Frame", frame: true, x: 0, y: 0, width: 300, height: 200 },
      { id: "a", label: "<A&B>", x: 10, y: 10, width: 50, height: 20 },
      { id: "b", label: "B", x: 100, y: 10, width: 50, height: 20 },
    ],
    [{ ...edge("e", "a", "b"), label: "12 ms" }, edge("ghost", "a", "nope")],
    theme,
  )
  expect(svg).toContain("&#60;A&#38;B&#62;")
  expect(svg).not.toContain("<A&B>")
  expect(svg).toContain("12 ms")
  expect(svg.match(/<line/g)).toHaveLength(1)
  expect(svg.indexOf(">Frame<")).toBeLessThan(svg.indexOf("<line"))
  expect(svg.indexOf("<line")).toBeLessThan(svg.indexOf("&#60;A"))
  expect(topologyToSvg([], [], theme)).toContain("<svg")
})
