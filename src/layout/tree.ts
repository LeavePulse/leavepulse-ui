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
  /**
   * Block ids stacked as tabs in this cell. A plain cell is a single-element
   * stack; dropping onto a cell's center adds another tab. The consumer maps
   * each id to content via the canvas slot.
   */
  blocks: string[]
  /** Index into `blocks` of the visible tab. */
  active: number
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

function leaf(block: string): Leaf {
  return { kind: "leaf", id: nid(), blocks: [block], active: 0, size: 1 }
}

/** Build a single-row layout from a flat list of block ids (one cell each). */
export function makeLayout(blocks: string[]): Split {
  return reactive<Split>({
    kind: "split",
    id: nid(),
    dir: "row",
    size: 1,
    children: blocks.map<Leaf>(leaf),
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

/** Total blocks across all cells (a tabbed cell counts each of its tabs). */
export function countBlocks(node: LayoutNode): number {
  if (node.kind === "leaf") return node.blocks.length
  return node.children.reduce((s, c) => s + countBlocks(c), 0)
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

/** Remove an entire cell (with all its tabs). */
export function removeLeaf(root: Split, id: string): void {
  if (countLeaves(root) <= 1) return // keep at least one cell
  detach(root, id)
}

/**
 * Remove one tab from a cell. Removing the last tab removes the cell itself
 * (unless it's the only block left in the whole layout, which is kept).
 */
export function removeBlock(root: Split, leafId: string, index: number): void {
  const target = findLeaf(root, leafId)
  if (!target || index < 0 || index >= target.blocks.length) return
  if (target.blocks.length > 1) {
    target.blocks.splice(index, 1)
    if (target.active >= target.blocks.length) target.active = target.blocks.length - 1
    return
  }
  // Last tab in this cell → drop the cell, but never empty the whole layout.
  if (countBlocks(root) <= 1) return
  detach(root, leafId)
}

export function addLeaf(root: Split, block: string, side: Side = "right"): void {
  const targetId = root.children[root.children.length - 1]?.id
  if (!targetId) {
    root.children.push(leaf(block))
    return
  }
  if (side === "center") {
    addTab(root, targetId, block)
    return
  }
  insertBeside(root, leaf(block), targetId, side)
}

/** Append a block as a new tab in the target cell and focus it. */
export function addTab(root: Split, leafId: string, block: string): void {
  const target = findLeaf(root, leafId)
  if (!target) return
  target.blocks.push(block)
  target.active = target.blocks.length - 1
}

/** Switch the visible tab of a cell. */
export function setActiveTab(root: Split, leafId: string, index: number): void {
  const target = findLeaf(root, leafId)
  if (!target || index < 0 || index >= target.blocks.length) return
  target.active = index
}

/**
 * Reorder a tab within its cell, moving the block at `from` to `to`. The same
 * block stays visible afterwards (active follows the moved block by identity,
 * not by index). Always available — not gated by edit mode.
 */
export function reorderTab(root: Split, leafId: string, from: number, to: number): void {
  const target = findLeaf(root, leafId)
  if (!target) return
  const n = target.blocks.length
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return
  const activeBlock = target.blocks[target.active]
  const [moved] = target.blocks.splice(from, 1)
  target.blocks.splice(to, 0, moved)
  target.active = target.blocks.indexOf(activeBlock)
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

/**
 * Move an existing cell to a target. An edge side splits beside the target;
 * `center` merges the moving cell's tabs into the target cell (and focuses
 * the first moved tab).
 */
export function moveLeaf(
  root: Split,
  movingId: string,
  targetId: string,
  side: Side,
): void {
  if (movingId === targetId) return
  const moving = findLeaf(root, movingId)
  if (!moving) return

  if (side === "center") {
    const target = findLeaf(root, targetId)
    if (!target) return
    const merged = moving.blocks
    detach(root, movingId)
    target.active = target.blocks.length
    target.blocks.push(...merged)
    return
  }

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
  blocks: string[]
  active: number
  size: number
  /** Legacy single-block form (pre-tabs); hydrated into `blocks`. */
  block?: string
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
      ? { kind: "leaf", blocks: [...n.blocks], active: n.active, size: n.size }
      : { kind: "split", dir: n.dir, size: n.size, children: n.children.map(strip) }
  return strip(root) as SerializedSplit
}

export function deserializeLayout(data: SerializedNode): Split {
  const hydrate = (n: SerializedNode): LayoutNode => {
    if (n.kind === "leaf") {
      // Accept both the tabbed form and the legacy single-`block` form.
      const blocks = n.blocks ?? (n.block != null ? [n.block] : [])
      const active = Math.min(Math.max(n.active ?? 0, 0), Math.max(blocks.length - 1, 0))
      return { kind: "leaf", id: nid(), blocks, active, size: n.size ?? 1 }
    }
    return {
      kind: "split",
      id: nid(),
      dir: n.dir,
      size: n.size ?? 1,
      children: n.children.map(hydrate),
    }
  }
  return reactive(hydrate(data) as Split)
}
