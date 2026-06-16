import { computed, ref, shallowRef, type Ref } from "vue"
import {
  addLeaf,
  countLeaves,
  deserializeLayout,
  makeLayout,
  moveLeaf,
  removeLeaf,
  resizeAt,
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
  /** Block count, handy for "N blocks" labels and empty-guards. */
  count: Ref<number>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  add: (block: string, side?: Side) => void
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
  const count = computed(() => countLeaves(layout.value))

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
