import { expect, test } from "./fixtures"

test("the rail header switches between the app's contexts", async ({ page }) => {
  await page.goto("/page/appshell")
  const trigger = page.getByRole("button", { name: "Datacentre DC1, switch" })
  await expect(trigger).toBeVisible()
  await trigger.click()
  await page.getByRole("menuitem", { name: "Datacentre DC2" }).click()
  await expect(page.getByRole("button", { name: "Datacentre DC2, switch" })).toBeVisible()
  await expect(page.locator("header h1").filter({ hasText: "Datacentre DC2" })).toBeVisible()
})
