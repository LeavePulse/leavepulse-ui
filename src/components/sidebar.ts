/*
 * Shared sidebar types. Lives in its own module so LpSidebar and its internal
 * LpSidebarNav body can both import them without a component-to-component cycle.
 * Re-exported from LpSidebar.vue for back-compat with existing import sites.
 */

import type { Component } from "vue"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"

/** One of an app's contexts in the rail header switcher (LpContextSwitcher). */
export interface AppContext {
  id: string
  label: string
  icon?: string
}

export interface SidebarItem {
  id: string
  label: string
  icon?: string
  /**
   * Render as a link instead of a button. An app-relative path goes through
   * the link component from provideLpConfig (NuxtLink under the Nuxt module),
   * so it navigates client-side; other URLs render a plain anchor.
   */
  href?: string
  /** Router destination (rendered through the configured link component). */
  to?: string | Record<string, unknown>
  /** Count chip on the right (number or short string). */
  badge?: number | string
  disabled?: boolean
  /** Right-click menu for this item (e.g. "Open in new tab", "Pin"). */
  menu?: ContextMenuItemDef[]
  /**
   * Heading of that menu. Defaults to `label` (with `icon` beside it), so the
   * menu says which item it acts on; an empty string drops the heading.
   */
  menuTitle?: string
  /**
   * Extra terms the sidebar's filter should match, beyond the label. For the
   * item people look for under a name it does not carry — "Billing" found by
   * "invoice", a page found by the feature it used to be called.
   */
  keywords?: string[]
  /**
   * Pages under this one, one level deep: folded under the row and opened
   * while one of them is the current page, so a section's tabs are a click
   * away without opening the section first. In a compact sidebar they open in
   * a card beside the icon.
   */
  children?: SidebarItem[]
  /** A dot instead of a count: something new here that has no number to it. */
  dot?: boolean
  /**
   * The keys that open this page ("G D"), shown at the row's end on hover and
   * in the compact card. Display only: the app binds the keys.
   */
  hotkey?: string
  /**
   * What the page holds, shown in a card beside the row once the pointer has
   * rested on it (`previewDelay`): a glance before going there.
   */
  preview?: Component
  /**
   * The hint-system page (or pages) this row opens. With the sidebar's
   * `hints`, the row carries a dot while that page has news nobody has read,
   * and loses it once the news is read there.
   */
  hintPage?: string | string[]
  /**
   * Work started on this page is still running (a publish, a deploy): a thin
   * bar along the row's foot, sweeping while `true`, filled to a fraction
   * while a number from 0 to 1. Leaving the page no longer hides that it is
   * not done.
   */
  busy?: boolean | number
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

/**
 * Something on this page or a page under it is waiting: a count, news, a dot.
 * A row or a group whose pages are out of sight shows it for them.
 */
export function waiting(item: SidebarItem): boolean {
  return item.badge != null || !!item.dot || !!item.children?.some(waiting)
}
