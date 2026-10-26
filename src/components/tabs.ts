/*
 * Which tab an uncontrolled LpTabs shows. Its own module so the rule can be
 * tested without mounting the component.
 */

/** The fields of a tab the choice depends on. */
export interface TabChoice {
  value: string
  disabled?: boolean
}

/**
 * The tab to show: `current` while it is still there and enabled, else the
 * first enabled one.
 *
 * Seeding once from `items[0]` left no tab active when the items arrived after
 * the first render (an empty list has no first item), and left the panel on a
 * tab that no longer existed when the current one was removed. While the list
 * is empty the current value is kept, so a `defaultValue` waits for the items
 * that contain it rather than being thrown away before they load.
 */
export function pickTab(items: readonly TabChoice[], current: string | undefined): string | undefined {
  if (!items.length) return current
  if (items.some((item) => item.value === current && !item.disabled)) return current
  return items.find((item) => !item.disabled)?.value ?? current
}

/*
 * A phone's bottom bar, shared by LpTabs (`variant="bottom"`, sections of a
 * page) and LpBottomNav (pages of an app), so the two never drift apart.
 */
export const BOTTOM_BAR =
  "grid w-full auto-cols-fr grid-flow-col border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
export const BOTTOM_ITEM = "min-h-14 min-w-0 flex-col gap-0.5 px-1 py-1.5 text-[11px] font-medium focus-visible:ring-inset"
export const BOTTOM_MARKER = "absolute inset-x-[22%] top-0 z-0 h-0.5 rounded-b-full"
