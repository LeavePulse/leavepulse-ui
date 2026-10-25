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
