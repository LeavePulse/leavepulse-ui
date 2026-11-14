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

for (const [name, card] of [
  ["Card over a menu", "Card over the menu"],
  ["Menu over a card", "Card under the menu"],
  ["Card in a menu row", "Card in the row"],
] as const) {
  test(`a right click swaps an open hover card for the context menu: ${name.toLowerCase()}`, async ({ page }) => {
    await page.goto("/tests/browser/?scenario=trigger-nesting")
    const button = page.getByRole("button", { name, exact: true })
    await button.hover()
    await expect(page.getByText(card)).toBeVisible()
    await button.click({ button: "right" })
    await expect(page.getByRole("menuitem", { name: "Copy" })).toBeVisible()
    await expect(page.getByText(card)).toBeHidden()
  })
}

test("a context menu tells its caller when it opens and closes", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=trigger-nesting")
  const state = page.getByTestId("menu-state")
  await expect(state).toHaveText("closed")
  await page.getByRole("button", { name: "Reports its state", exact: true }).click({ button: "right" })
  await expect(page.getByRole("menuitem", { name: "Copy" })).toBeVisible()
  await expect(state).toHaveText("open")
  await page.keyboard.press("Escape")
  await expect(state).toHaveText("closed")
})

test("a switch inside a tooltip still says and shows its own state", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=trigger-nesting")
  const toggle = page.getByRole("switch", { name: "Autopilot" })
  await expect(toggle).toHaveAttribute("aria-checked", "true")
  await expect(toggle).toHaveAttribute("data-state", "checked")
  await toggle.hover()
  await expect(page.locator("[data-reka-popper-content-wrapper]", { hasText: "Deploys on a new image" })).toBeVisible()
  await expect(toggle).toHaveAttribute("data-tooltip-state", /open/)
  await expect(toggle).toHaveAttribute("data-state", "checked")
})
