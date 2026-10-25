import type { ContextMenuItemDef } from "./LpContextMenu.vue"

/**
 * A row's right-click menu with a heading: the row's name above its actions,
 * so in a list of similar rows the user sees which one the right-click hit.
 */
export interface TableRowMenu {
  title?: string
  /** A muted second line under `title`, e.g. an id or a path. */
  subtitle?: string
  /** A picture beside the title (an avatar, a logo). */
  image?: string
  /** An icon beside the title, when there is no picture. */
  icon?: string
  items: ContextMenuItemDef[]
}

/** What `rowMenu` may return: the bare items, or the items with a heading. */
export type TableRowMenuResult = ContextMenuItemDef[] | TableRowMenu

/**
 * Both shapes `rowMenu` accepts, as one. A bare array is the original form and
 * stays valid; it simply has no heading. Nothing at all (no `rowMenu`, no row
 * under the pointer) is an empty menu.
 */
export function resolveRowMenu(result: TableRowMenuResult | null | undefined): TableRowMenu {
  if (!result) return { items: [] }
  if (Array.isArray(result)) return { items: result }
  return { ...result, items: result.items ?? [] }
}
