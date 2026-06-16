import type { Component } from "vue"

/*
 * Block registry — the consumer's catalogue of what a layout cell can hold.
 *
 * The layout tree stores only block ids (plain strings, serializable). The
 * registry maps each id to how it should render and chrome: the component, a
 * human title for the tab/header, an optional icon, and whether the user may
 * close it. LayoutCanvas reads this so it can draw tab bars + headers itself —
 * the consumer supplies the catalogue, not per-cell wiring.
 */

export interface BlockDef {
  /**
   * Content component for this block. Optional: when the consumer renders block
   * content via the canvas's #block slot (keyed by id), the registry is used
   * only for tab chrome (title/icon) and no component is needed here.
   */
  component?: Component
  /** Human label shown on the tab / cell header. Defaults to the id. */
  title?: string
  /** Optional iconify name (e.g. "lucide:activity") for the tab. */
  icon?: string
  /** Whether the user may close this block. Defaults to true. */
  closable?: boolean
  /** Props passed to the component. */
  props?: Record<string, unknown>
}

export type BlockRegistry = Record<string, BlockDef>

/**
 * Identity helper that pins the key type so callers get autocomplete on block
 * ids elsewhere (e.g. when seeding a layout). Purely for inference — it returns
 * the object unchanged.
 */
export function defineBlocks<const T extends BlockRegistry>(blocks: T): T {
  return blocks
}

/** Resolve a block's display title, falling back to its id. */
export function blockTitle(registry: BlockRegistry, id: string): string {
  return registry[id]?.title ?? id
}
