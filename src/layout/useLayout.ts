import { computed, ref, shallowRef, type Ref } from "vue"
import {
  addLeaf,
  addTab,
  countBlocks,
  deserializeLayout,
  makeLayout,
  moveLeaf,
  removeBlock,
  removeLeaf,
  reorderTab,
  resizeAt,
  setActiveTab,
  serializeLayout,
  type Side,
  type Split,
} from "./tree"

/*
 * useLayout — stateful controller around the layout tree.
 *
 * tree.ts is a pile of pure-ish mutators; this composable is the ergonomic
 * surface a consumer actually wires to UI: it owns the reactive tree, snapshots
 * every structural edit for undo/redo, and exposes save/load/reset against a
 * serialized form. The canvas calls the same mutators for drag/drop/resize, so
 * those go through `record()` too and land in history.
 *
 * History holds serialized snapshots (plain JSON), not live trees, so an undo
 * can't smuggle stale reactive nodes back in.
 */

export interface UseLayoutOptions {
  /** Initial block ids, left-to-right, when no saved layout is loaded. */
  initial: string[]
  /** Max undo depth. */
  historyLimit?: number
}

export interface UseLayout {
  /** The live reactive tree to hand to <LayoutCanvas v-model>. */
  layout: Ref<Split>
  /** Block count across all tabs, handy for "N blocks" labels and guards. */
  count: Ref<number>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  /** Add a block: a new cell on an edge, or a tab on the last cell (center). */
  add: (block: string, side?: Side) => void
  /** Add a block as a tab in a specific cell. */
  addTab: (leafId: string, block: string) => void
  /** Switch the visible tab of a cell. */
  setActive: (leafId: string, index: number) => void
  /** Reorder a tab within its cell (always available, not edit-gated). */
  reorderTab: (leafId: string, from: number, to: number) => void
  /** Remove one tab (drops the cell when it was the last tab). */
  removeBlock: (leafId: string, index: number) => void
  /** Remove an entire cell with all its tabs. */
  remove: (leafId: string) => void
  move: (movingId: string, targetId: string, side: Side) => void
  resize: (parent: Split, index: number, deltaFraction: number) => void
  undo: () => void
  redo: () => void
  /** Replace the whole layout from a flat block list. */
  reset: (blocks?: string[]) => void
  /** Serialize to JSON-safe data for persistence. */
  serialize: () => unknown
  /** Replace the layout from previously serialized data. */
  hydrate: (data: unknown) => void
}

export function useLayout(options: UseLayoutOptions): UseLayout {
  const limit = options.historyLimit ?? 50
  const layout = shallowRef<Split>(makeLayout(options.initial))
  const count = computed(() => countBlocks(layout.value))

  const past = ref<string[]>([])
  const future = ref<string[]>([])
  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  const snapshot = () => JSON.stringify(serializeLayout(layout.value))

  // Capture the pre-edit state, run the structural change, drop any redo branch.
  function record(mutate: () => void) {
    const before = snapshot()
    mutate()
    past.value.push(before)
    if (past.value.length > limit) past.value.shift()
    future.value = []
  }

  function restore(serialized: string) {
    layout.value = deserializeLayout(JSON.parse(serialized))
  }

  return {
    layout,
    count,
    canUndo,
    canRedo,
    add: (block, side) => record(() => addLeaf(layout.value, block, side)),
    addTab: (leafId, block) => record(() => addTab(layout.value, leafId, block)),
    setActive: (leafId, index) => setActiveTab(layout.value, leafId, index),
    reorderTab: (leafId, from, to) => record(() => reorderTab(layout.value, leafId, from, to)),
    removeBlock: (leafId, index) => record(() => removeBlock(layout.value, leafId, index)),
    remove: (leafId) => record(() => removeLeaf(layout.value, leafId)),
    move: (movingId, targetId, side) =>
      record(() => moveLeaf(layout.value, movingId, targetId, side)),
    // Resize fires continuously during a divider drag; recording every frame
    // would flood history, so it mutates without a snapshot. (A consumer that
    // wants resize in history can wrap a single record() around the gesture.)
    resize: (parent, index, delta) => resizeAt(parent, index, delta),
    undo: () => {
      const prev = past.value.pop()
      if (prev === undefined) return
      future.value.push(snapshot())
      restore(prev)
    },
    redo: () => {
      const next = future.value.pop()
      if (next === undefined) return
      past.value.push(snapshot())
      restore(next)
    },
    reset: (blocks) =>
      record(() => {
        layout.value = makeLayout(blocks ?? options.initial)
      }),
    serialize: () => serializeLayout(layout.value),
    hydrate: (data) =>
      record(() => {
        layout.value = deserializeLayout(data as Parameters<typeof deserializeLayout>[0])
      }),
  }
}
