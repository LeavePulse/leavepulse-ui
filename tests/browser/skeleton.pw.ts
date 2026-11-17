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

test("a skeleton waits before it shows, so a fast load never flashes it, and immediate skips the wait", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=skeleton")
  const shown = (selector: string) =>
    page.locator(selector).evaluate((el) => {
      const filter = getComputedStyle(el).filter
      const match = /opacity\(([\d.]+)\)/.exec(filter)
      return match ? Number(match[1]) : 1
    })
  const sampled = await page.evaluate(async () => {
    const read = (el: Element | null) => {
      const match = el ? /opacity\(([\d.]+)\)/.exec(getComputedStyle(el).filter) : null
      return match ? Number(match[1]) : 1
    }
    ;(document.querySelector('[data-test="load"]') as HTMLButtonElement).click()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return {
      delayed: read(document.querySelector('[data-test="delayed"]')),
      immediate: read(document.querySelector('[data-test="immediate"]')),
    }
  })
  expect(sampled.delayed).toBeLessThan(0.5)
  expect(sampled.immediate).toBe(1)
  // Held space: the block is laid out from the first frame.
  const box = await page.locator('[data-test="delayed"]').boundingBox()
  expect(box?.height ?? 0).toBeGreaterThan(0)
  await expect.poll(() => shown('[data-test="delayed"]'), { timeout: 2000 }).toBe(1)
})
