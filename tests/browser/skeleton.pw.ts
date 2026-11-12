import { expect, test } from "./fixtures"

test("a skeleton item with no colour of its own is visible, and one with its own keeps it", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=skeleton")
  const colour = (selector: string) =>
    page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor)
  const plain = await colour('[data-test="plain"]')
  const own = await colour('[data-test="own"]')
  // Transparent was the bug: the pulse animates opacity, so an item without a
  // background pulsed nothing and the loading state was blank.
  expect(plain).not.toBe("rgba(0, 0, 0, 0)")
  expect(plain).not.toBe("transparent")
  // The default weighs nothing: the consumer's own background wins.
  expect(own).not.toBe(plain)
})
