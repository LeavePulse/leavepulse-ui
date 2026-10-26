import { expect, test } from "./fixtures"

test("the shell's header boxes stay out of positioning, so content can centre on the whole bar", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  await expect(header).toBeVisible()
  const positions = await header.evaluate((bar) =>
    [...bar.children].filter((child) => child.tagName === "DIV").map((child) => getComputedStyle(child).position),
  )
  expect(positions.length).toBeGreaterThan(0)
  expect(positions.every((position) => position === "static")).toBe(true)
})

test("a header action leaving fades where it stood", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  const action = header.getByRole("button", { name: /New rack/ })
  const was = await action.boundingBox()
  await page.getByRole("button", { name: "Stock", exact: true }).click()
  const ghost = header.locator("[data-lp-shift-ghost]").filter({ hasText: "New rack" })
  const at = await ghost.boundingBox()
  expect(Math.abs(at!.y - was!.y)).toBeLessThan(2)
  expect(Math.abs(at!.x - was!.x)).toBeLessThan(8)
  await expect(ghost).toHaveCount(0)
})
