import type { SidebarItem } from "./sidebar"

/*
 * What LpAppShell decides from numbers: which navigation a width gets, whether
 * the header stays while a page scrolls, how tight the page sits. Kept out of
 * the component so each rule is tested without a browser.
 */

export type NavBreakpoint = "sm" | "md" | "lg" | "xl" | "2xl"

/** Tailwind's default widths, which the shell's own classes follow. */
export const NAV_BREAKPOINT_PX: Record<NavBreakpoint, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 }

/**
 * The one navigation the shell shows at a width. `rail` the full side rail,
 * `compact` its icons, `bottom` a phone's bottom bar, `drawer` a burger.
 */
export type NavMode = "rail" | "compact" | "bottom" | "drawer"

export interface AdaptiveNav {
  /** Below this width (and above `mobileBreakpoint`) the rail folds to icons. */
  compactBelow?: NavBreakpoint
  /**
   * Where the rail is gone, a row of the current page's `children` under the
   * header, so a sub-page stays one tap away. The `context-nav` slot redraws it.
   */
  contextNav?: boolean
}

/** Padding around the page: `auto` tightens it on small screens only. */
export type ShellDensity = "comfortable" | "compact" | "auto"

export const DENSITY_CLASS: Record<ShellDensity, string> = {
  comfortable: "px-4 py-6 md:px-6",
  compact: "px-2 py-3 md:px-3",
  auto: "px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6",
}

export function resolveNavMode(
  atLeast: (breakpoint: NavBreakpoint) => boolean,
  options: { mobileBreakpoint: NavBreakpoint; bottomNav: boolean; compactBelow?: NavBreakpoint },
): NavMode {
  if (!atLeast(options.mobileBreakpoint)) return options.bottomNav ? "bottom" : "drawer"
  return options.compactBelow && !atLeast(options.compactBelow) ? "compact" : "rail"
}

/** What the header height is, in px: where a page counts as being at its top. */
export const SHELL_HEADER_PX = 64
/* Below this a scroll is a tremble of the finger, not a direction. */
const SCROLL_SLOP_PX = 8

/**
 * The header leaves on the way down and returns on the way up. Near the end of
 * a page it stays as it is: the viewport changes height with the header, the
 * browser clamps the scroll, and that clamp would read as scrolling back up.
 */
export function headerCollapsedAfter(
  collapsed: boolean,
  from: number,
  to: number,
  maxTop: number,
  slop = SCROLL_SLOP_PX,
): boolean {
  if (to <= SHELL_HEADER_PX) return false
  if (to >= maxTop - SHELL_HEADER_PX) return collapsed
  if (to - from > slop) return true
  if (from - to > slop) return false
  return collapsed
}

/** The sub-pages of the page in view: its own, or its siblings' when it is one of them. */
export function contextNavItems(items: SidebarItem[], isActive: (item: SidebarItem) => boolean): SidebarItem[] {
  return items.find((item) => item.children?.length && (isActive(item) || item.children.some(isActive)))?.children ?? []
}
