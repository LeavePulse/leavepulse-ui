import { expect, test } from "./fixtures"

test("the rail folds to icons and back", async ({ page }) => {
  await page.goto("/page/appshell")
  const rail = page.getByRole("navigation", { name: "Sidebar" }).nth(1)
  await rail.getByRole("button", { name: "Collapse the sidebar", exact: true }).click()
  await expect.poll(() => rail.evaluate((n) => Math.round(n.getBoundingClientRect().width))).toBe(64)
  await rail.getByRole("button", { name: "Expand the sidebar", exact: true }).click()
  await expect.poll(() => rail.evaluate((n) => Math.round(n.getBoundingClientRect().width))).toBeGreaterThan(200)
})

test("pages under a row open beside their parent without following it", async ({ page }) => {
  await page.goto("/page/appshell")
  const rail = page.getByRole("navigation", { name: "Sidebar" }).nth(1)
  const toggle = rail.getByRole("button", { name: "Show the pages under it", exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(rail.getByRole("button", { name: "Racks", exact: true })).toBeVisible()
})

test("a pinned row leads the nav until it is unpinned", async ({ page }) => {
  await page.goto("/page/appshell")
  const rail = page.getByRole("navigation", { name: "Sidebar" }).nth(1)
  await rail.getByRole("button", { name: "Settings", exact: true }).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Pin to top", exact: true }).click()
  await expect(rail.getByText("Pinned", { exact: true })).toBeVisible()
  await rail.getByRole("button", { name: "Settings", exact: true }).first().click({ button: "right" })
  await page.getByRole("menuitem", { name: "Unpin", exact: true }).click()
  await expect(rail.getByText("Pinned", { exact: true })).toHaveCount(0)
})

test("arrows walk the rows, open the pages under one and type jumps to a row", async ({ page }) => {
  await page.goto("/page/appshell")
  const rail = page.getByRole("navigation", { name: "Sidebar" }).nth(1)
  await rail.getByRole("button", { name: "Dashboard", exact: true }).focus()
  await page.keyboard.press("ArrowDown")
  await expect(rail.getByRole("button", { name: /^Servers/ })).toBeFocused()
  await page.keyboard.press("ArrowRight")
  await expect(rail.getByRole("button", { name: "Show the pages under it", exact: true })).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("ArrowDown")
  await expect(rail.getByRole("button", { name: "Racks", exact: true })).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  await expect(rail.getByRole("button", { name: /^Servers/ })).toBeFocused()
  await page.keyboard.type("te")
  await expect(rail.getByRole("button", { name: /^Team/ })).toBeFocused()
})

test("a click on a folded group opens its pages, not only a rest of the pointer", async ({ page }) => {
  await page.goto("/page/appshell")
  const rail = page.getByRole("navigation", { name: "Sidebar" }).nth(1)
  await rail.getByRole("button", { name: "Collapse the sidebar", exact: true }).click()
  const group = rail.getByRole("button", { name: "Account", exact: true })
  await group.dispatchEvent("click")
  await expect(group).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("button", { name: /^Team/ }).last()).toBeVisible()
  await rail.getByRole("button", { name: "Expand the sidebar", exact: true }).click()
})
