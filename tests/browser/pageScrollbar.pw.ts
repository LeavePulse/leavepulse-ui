import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

/*
 * LpAppShell draws the document's scrollbar (LpPageScrollbar). Headless
 * Chromium hides scrollbars, which the bar reads, rightly, as bars that float
 * over the page, and then leaves the browser's alone (shellFeatures.pw.ts
 * checks that). Here the browser keeps a desktop's bars, which take width.
 */
test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, ignoreDefaultArgs: ["--hide-scrollbars"] } })

const open = (page: Page, query: string) => page.goto(`/tests/browser/?scenario=shell-features&${query}`)
test.describe("the page's own scrollbar", () => {
  const bar = (page: Page) => page.locator("[data-lp-page-scrollbar]")
  const thumbBox = (page: Page) => page.locator("[data-lp-page-scrollbar] [data-lp-thumb]").boundingBox()
  const toTop = (page: Page, top: number) => page.locator("html").evaluate((el, value) => el.scrollTo({ top: value, behavior: "instant" }), top)

  test("the browser's bar gives the page its width back, and the kit's waits out of sight", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "")
    await expect(page.locator("html")).toHaveClass(/\blp-scrollbar-none\b/)
    expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBe(0)
    await expect(bar(page)).not.toHaveAttribute("data-state", "visible")
  })

  test("it shows while the page scrolls, under the header, and leaves again", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "")
    await page.mouse.move(650, 400)
    await page.mouse.wheel(0, 600)
    await expect(bar(page)).toHaveAttribute("data-state", "visible")
    const box = await bar(page).boundingBox()
    expect(box!.y).toBe(64)
    expect(Math.round(box!.y + box!.height)).toBe(700)
    expect(Math.round(box!.x + box!.width)).toBe(1300)
    // The thumb stands where the page is.
    await expect.poll(async () => (await thumbBox(page))!.y).toBeGreaterThan(64)
    await expect(bar(page)).toHaveAttribute("data-state", "hidden", { timeout: 3000 })
  })

  test("it follows the header out when the header collapses", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "collapse")
    await toTop(page, 800)
    await expect.poll(async () => (await bar(page).boundingBox())!.y).toBe(0)
  })

  test("its thumb drags the page, and a press beside it pages", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "")
    await bar(page).hover()
    const thumb = (await thumbBox(page))!
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + 5)
    await page.mouse.down()
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + 205, { steps: 5 })
    await page.mouse.up()
    const dragged = await page.evaluate(() => scrollY)
    expect(dragged).toBeGreaterThan(600)
    const after = (await thumbBox(page))!
    await page.mouse.click(after.x + after.width / 2, after.y + after.height + 120)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(dragged + 500)
  })

  test("a dialog that locks the page locks the bar", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "")
    await toTop(page, 600)
    await page.getByRole("button", { name: "Open dialog" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await bar(page).evaluate((el) => {
      const box = el.getBoundingClientRect()
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: box.right - 4, clientY: box.bottom - 10 }))
    })
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => scrollY)).toBe(600)
  })

  test("a region shell keeps the browser's bar alone", async ({ page }) => {
    await open(page, "region")
    await expect(bar(page)).toHaveCount(0)
    await expect(page.locator("html")).not.toHaveClass(/\blp-scrollbar-none\b/)
  })
})

