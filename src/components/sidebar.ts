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
  /**
   * The heading folds the group away when clicked. Needs a `title` — there is
   * nothing to click otherwise.
   *
   * A long nav is read by scanning headings, not items: past a certain length
   * every item is equally far from the eye, and folding the groups that are
   * not today's work restores that. Which groups start folded is the app's
   * call (see `collapsedIds`), not this component's.
   */
  collapsible?: boolean
  /**
   * Stable key for remembering this group's folded state. Defaults to `title`;
   * set it when the title is translated, so the memory survives a language
   * change.
   */
  key?: string
  /** Icon for the heading — shown when the group is collapsible. */
  icon?: string
}
