import { reactive } from "vue"

/*
 * Layout tree model for LayoutCanvas.
 *
 * A layout is a tree of splits (row/col containers) and leaves (blocks).
 * Sizes are flex fractions among siblings, so the layout is resolution-
 * independent and serializes cleanly to JSON (persist to disk / config).
 */

export type Dir = "row" | "col"
export type Side = "left" | "right" | "top" | "bottom" | "center"

export interface Leaf {
  kind: "leaf"
  id: string
  /** Block id — the consumer maps this to content via the canvas slot. */
  block: string
  /** Flex fraction among siblings. */
  size: number
}
export interface Split {
  kind: "split"
  id: string
  dir: Dir
  size: number
  children: LayoutNode[]
}
export type LayoutNode = Leaf | Split

let uid = 0
const nid = () => `lp-n${uid++}`

/** Build a single-row layout from a flat list of block ids. */
export function makeLayout(blocks: string[]): Split {
  return reactive<Split>({
    kind: "split",
    id: nid(),
    dir: "row",
    size: 1,
    children: blocks.map<Leaf>((block) => ({
      kind: "leaf",
      id: nid(),
      block,
      size: 1,
    })),
  })
}

export function findParent(node: Split, childId: string): Split | null {
  for (const c of node.children) {
    if (c.id === childId) return node
    if (c.kind === "split") {
      const r = findParent(c, childId)
      if (r) return r
    }
  }
  return null
}

export function findLeaf(node: LayoutNode, id: string): Leaf | null {
  if (node.kind === "leaf") return node.id === id ? node : null
  for (const c of node.children) {
    const r = findLeaf(c, id)
    if (r) return r
  }
  return null
}

export function countLeaves(node: LayoutNode): number {
  if (node.kind === "leaf") return 1
  return node.children.reduce((s, c) => s + countLeaves(c), 0)
}

function detach(root: Split, id: string): void {
  const parent = findParent(root, id)
  if (!parent) return
  const idx = parent.children.findIndex((c) => c.id === id)
  parent.children.splice(idx, 1)
  collapse(root, parent)
}

/** A container left with a single child collapses into that child. */
function collapse(root: Split, parent: Split): void {
  if (parent === root || parent.children.length !== 1) return
  const grand = findParent(root, parent.id)
  if (!grand) return
  const only = parent.children[0]
  only.size = parent.size
  const pIdx = grand.children.findIndex((c) => c.id === parent.id)
  grand.children.splice(pIdx, 1, only)
}

export function removeLeaf(root: Split, id: string): void {
  if (countLeaves(root) <= 1) return // keep at least one block
  detach(root, id)
}

export function addLeaf(root: Split, block: string, side: Side = "right"): void {
  const targetId = root.children[root.children.length - 1]?.id
  if (!targetId) {
    root.children.push({ kind: "leaf", id: nid(), block, size: 1 })
    return
  }
  insertBeside(root, { kind: "leaf", id: nid(), block, size: 1 }, targetId, side)
}

function insertBeside(
  root: Split,
  moving: Leaf,
  targetId: string,
  side: Side,
): void {
  const parent = findParent(root, targetId)
  if (!parent) return
  const idx = parent.children.findIndex((c) => c.id === targetId)
  const target = parent.children[idx]

  const wantDir: Dir = side === "left" || side === "right" ? "row" : "col"
  const before = side === "left" || side === "top"

  if (parent.dir === wantDir) {
    moving.size = target.size / 2
    target.size = target.size / 2
    parent.children.splice(before ? idx : idx + 1, 0, moving)
  } else {
    const wrap: Split = {
      kind: "split",
      id: nid(),
      dir: wantDir,
      size: target.size,
      children: before
        ? [{ ...moving, size: 1 }, { ...target, size: 1 }]
        : [{ ...target, size: 1 }, { ...moving, size: 1 }],
    }
    parent.children.splice(idx, 1, wrap)
  }
}

/** Move an existing block beside a target on the given edge. */
export function moveLeaf(
  root: Split,
  movingId: string,
  targetId: string,
  side: Side,
): void {
  if (movingId === targetId || side === "center") return
  const moving = findLeaf(root, movingId)
  if (!moving) return
  detach(root, movingId)
  moving.size = 1
  insertBeside(root, moving, targetId, side)
}

/** Splitter drag: redistribute size between two adjacent siblings. */
export function resizeAt(parent: Split, index: number, deltaFraction: number): void {
  const a = parent.children[index]
  const b = parent.children[index + 1]
  if (!a || !b) return
  const total = a.size + b.size
  const min = total * 0.12
  const na = Math.max(min, Math.min(total - min, a.size + deltaFraction * total))
  a.size = na
  b.size = total - na
}

// ── serialization ────────────────────────────────────────────
interface SerializedLeaf {
  kind: "leaf"
  block: string
  size: number
}
interface SerializedSplit {
  kind: "split"
  dir: Dir
  size: number
  children: SerializedNode[]
}
type SerializedNode = SerializedLeaf | SerializedSplit

export function serializeLayout(root: Split): SerializedNode {
  const strip = (n: LayoutNode): SerializedNode =>
    n.kind === "leaf"
      ? { kind: "leaf", block: n.block, size: n.size }
      : { kind: "split", dir: n.dir, size: n.size, children: n.children.map(strip) }
  return strip(root) as SerializedSplit
}

export function deserializeLayout(data: SerializedNode): Split {
  const hydrate = (n: SerializedNode): LayoutNode =>
    n.kind === "leaf"
      ? { kind: "leaf", id: nid(), block: n.block, size: n.size ?? 1 }
      : {
          kind: "split",
          id: nid(),
          dir: n.dir,
          size: n.size ?? 1,
          children: n.children.map(hydrate),
        }
  return reactive(hydrate(data) as Split)
}
