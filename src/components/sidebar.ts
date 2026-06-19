/*
 * Shared sidebar types. Lives in its own module so LpSidebar and its internal
 * LpSidebarNav body can both import them without a component-to-component cycle.
 * Re-exported from LpSidebar.vue for back-compat with existing import sites.
 */

import type { ContextMenuItemDef } from "./LpContextMenu.vue"

export interface SidebarItem {
  id: string
  label: string
  icon?: string
  /** Render as a link instead of a button. */
  href?: string
  /** Count chip on the right (number or short string). */
  badge?: number | string
  disabled?: boolean
  /** Right-click menu for this item (e.g. "Open in new tab", "Pin"). */
  menu?: ContextMenuItemDef[]
}

export interface SidebarSection {
  /** Optional heading above the group. */
  title?: string
  items: SidebarItem[]
}
