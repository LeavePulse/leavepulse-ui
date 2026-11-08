import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const dialog = (page: Page) => page.getByRole("dialog")
const seek = (page: Page) => dialog(page).getByRole("slider", { name: "Seek" })

async function openClip(page: Page) {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto("/tests/browser/?scenario=media-video")
  await page.getByRole("button", { name: /Evidence clip/ }).click()
  await expect(dialog(page).getByRole("region", { name: "Evidence clip" })).toBeVisible()
}

test("a video tile shows a play badge and its length, a picture tile does not", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=media-video")
  const clip = page.getByRole("button", { name: /Evidence clip/ })
  await expect(clip.locator("video")).toHaveCount(1)
  await expect(clip).toContainText("0:06")
  await expect(page.getByRole("button", { name: /From an API route/ })).toContainText("0:06")
  await expect(page.getByRole("button", { name: /Avatar/ }).locator("video")).toHaveCount(0)
})

test("a video opens in the player, plays on its own, and the picture tools are left out", async ({ page }) => {
  await openClip(page)
  await expect.poll(async () => Number(await seek(page).getAttribute("aria-valuenow")), { timeout: 5000 }).toBeGreaterThan(0)
  await expect(dialog(page).getByRole("button", { name: "Zoom in" })).toHaveCount(0)
})

test("dragging the seek bar seeks and never pages", async ({ page }) => {
  await openClip(page)
  const bar = (await seek(page).boundingBox())!
  await page.mouse.move(bar.x + bar.width * 0.8, bar.y + bar.height / 2)
  await page.mouse.down()
  await page.mouse.move(bar.x + bar.width * 0.1, bar.y + bar.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(dialog(page).getByRole("region", { name: "Evidence clip" })).toBeVisible()
  await expect.poll(async () => Number(await seek(page).getAttribute("aria-valuenow"))).toBeLessThan(2)
})

test("Space plays and pauses from the viewer; arrows page while the player is not focused, and paging stops it", async ({ page }) => {
  await openClip(page)
  const region = dialog(page).getByRole("region", { name: "Evidence clip" })
  await dialog(page).getByRole("button", { name: "Close" }).focus()
  await page.keyboard.press(" ")
  await expect(region.getByRole("button", { name: "Play", exact: true }).first()).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await expect(dialog(page).getByRole("region", { name: "From an API route" })).toBeVisible()
  await expect(dialog(page).locator("video:not([aria-hidden])")).toHaveCount(1)
})

test("with the player focused, the arrows seek instead of paging", async ({ page }) => {
  await openClip(page)
  const region = dialog(page).getByRole("region", { name: "Evidence clip" })
  await region.focus()
  await page.keyboard.press("k")
  await page.keyboard.press("Home")
  await page.keyboard.press("ArrowRight")
  await expect(region).toBeVisible()
  await expect.poll(async () => Number(await seek(page).getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(1)
})
