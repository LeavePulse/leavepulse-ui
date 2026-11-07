import { expect, test } from "./fixtures"

/*
 * LpContextMenu, LpTooltip and LpHoverCard render a trigger and a portal, so
 * Vue could not pass attributes through them on its own: a popover trigger
 * around one lost its id, ARIA and click, and never opened. The fixture also
 * runs lpPropCheck, which read such a component as having no element at all.
 */
for (const [name, body] of [
  ["Through a menu", "Body of the menu one"],
  ["Through a tooltip", "Body of the tooltip one"],
  ["Through a hover card", "Body of the hover card one"],
] as const) {
  test(`a popover opens from a button wrapped in another trigger: ${name.toLowerCase()}`, async ({ page }) => {
    await page.goto("/tests/browser/?scenario=trigger-nesting")
    const button = page.getByRole("button", { name, exact: true })
    await expect(button).toHaveAttribute("aria-haspopup", "dialog")
    await expect(button).toHaveAttribute("aria-expanded", "false")
    await button.click()
    await expect(page.getByText(body)).toBeVisible()
    await expect(button).toHaveAttribute("aria-expanded", "true")
  })
}

test("a hover card and a context menu share one button", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=trigger-nesting")
  const button = page.getByRole("button", { name: "Card over a menu", exact: true })
  await button.hover()
  await expect(page.getByText("Card over the menu")).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page.getByText("Card over the menu")).toBeHidden()
  await button.click({ button: "right" })
  await expect(page.getByRole("menuitem", { name: "Copy" })).toBeVisible()
})
