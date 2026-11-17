import { expect, test } from "./fixtures"

test("a look redraws icons and defaults without the app changing, and an explicit prop still wins", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=look")
  const plain = page.locator('[data-test="plain"]')
  const pixel = page.locator('[data-test="pixel"]')
  const svg = (scope: typeof plain, name: string) => scope.locator(`[data-test="${name}"]`).evaluate((el) => el.innerHTML)

  // lucide:x has a pixel pair, so the two scopes draw it differently.
  expect(await svg(plain, "mapped")).not.toBe(await svg(pixel, "mapped"))
  // A name without a pair stays lucide in both.
  expect(await svg(plain, "unmapped")).toBe(await svg(pixel, "unmapped"))

  // The loader and the progress take the look's variants when none is given.
  await expect(pixel.locator(".lp-loader-cell")).toHaveCount(9)
  await expect(plain.locator(".lp-loader-cell")).toHaveCount(0)
  await expect(pixel.locator('[data-test="progress"]')).toContainText("█")
  // An explicit variant beats the look.
  await expect(pixel.locator('[data-test="explicit"] .lp-loader-dot')).toHaveCount(3)

  // Stepped motion swaps the easing for steps inside the scope only.
  const ease = (scope: typeof plain) => scope.evaluate((el) => getComputedStyle(el).getPropertyValue("--ease-emphasized").trim())
  expect(await ease(pixel)).toContain("steps")
  expect(await ease(plain)).not.toContain("steps")
})
