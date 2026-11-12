import { expect, test } from "./fixtures"

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

test("on a phone the palette fills the screen, drops key hints and closes with a button", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=context-palette")
  await page.getByRole("button", { name: "Open contextual palette", exact: true }).click()
  const dialog = page.locator(".lp-cmd-dialog")
  await expect(dialog).toBeVisible()
  // Edge to edge of the layout viewport, measured once the opening animation
  // has settled.
  const layout = await page.evaluate(() => document.documentElement.clientWidth)
  await expect.poll(async () => {
    const box = await dialog.boundingBox()
    return box && [Math.round(box.x), Math.round(box.y), Math.round(box.width)]
  }).toEqual([0, 0, layout])
  // No key hints on a touch screen: neither the box's esc nor the footer's.
  for (const hint of await dialog.locator("kbd", { hasText: "esc" }).all()) await expect(hint).toBeHidden()
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
