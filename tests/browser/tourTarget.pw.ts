import { expect, test } from "./fixtures"

test("a tour step follows its target when the page replaces the element", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=tour-target")
  await page.getByRole("button", { name: "Start tour" }).click()
  const card = page.getByRole("dialog", { name: "Moving target" })
  await expect(card).toBeVisible()
  await page.evaluate(() => (window as unknown as { swapTarget: () => void }).swapTarget())
  const target = page.getByRole("button", { name: "After" })
  await expect(target).toBeVisible()
  await expect.poll(async () => {
    const [a, b] = [await card.boundingBox(), await target.boundingBox()]
    return !!a && !!b && Math.abs(a.y - (b.y + b.height)) < 60
  }).toBe(true)
})
