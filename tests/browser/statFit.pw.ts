import { expect, test } from "./fixtures"

const figure = (tile: import("@playwright/test").Locator) => tile.locator(".font-mono").first()

test("a stat's figure shrinks to its tile instead of running past the edge, and is cut only past the floor", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=stat-fit")
  const short = page.getByTestId("short")
  const long = page.getByTestId("long")
  const huge = page.getByTestId("huge")
  await expect(figure(huge)).toBeVisible()
  await page.waitForTimeout(200)
  const sizes = await Promise.all([short, long, huge].map((tile) =>
    figure(tile).evaluate((el) => ({
      font: Number.parseFloat(getComputedStyle(el).fontSize),
      line: el.getBoundingClientRect().height,
      fits: el.getBoundingClientRect().right <= el.closest("[data-testid]")!.getBoundingClientRect().right,
    })),
  ))
  const [plain, shrunk, cut] = sizes
  expect(shrunk.font).toBeLessThan(plain.font)
  expect(sizes.every((size) => size.fits)).toBe(true)
  expect(Math.abs(shrunk.line - plain.line)).toBeLessThan(1)
  await expect(figure(huge)).toHaveAttribute("title", "Nothing received from any source")
  expect(cut.font).toBeGreaterThanOrEqual(plain.font * 0.6 - 0.5)
})
