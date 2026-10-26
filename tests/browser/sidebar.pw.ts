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
