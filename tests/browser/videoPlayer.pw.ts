import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const player = (page: Page) => page.getByRole("region", { name: "Sample clip" })
const seek = (page: Page) => page.getByRole("slider", { name: "Seek" })
const now = async (page: Page) => Number(await seek(page).getAttribute("aria-valuenow"))

async function open(page: Page) {
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto("/tests/browser/?scenario=video-player")
  await expect(seek(page)).toHaveAttribute("aria-valuemax", "6")
}

test("nothing plays until asked; the big button starts it and the keys drive it", async ({ page }) => {
  await open(page)
  await page.waitForTimeout(500)
  await expect(page.locator("[data-test=events]")).toHaveText("")
  await page.getByRole("button", { name: "Play", exact: true }).first().click()
  await expect(page.locator("[data-test=events]")).toHaveText("play")
  await player(page).focus()
  await page.keyboard.press("k")
  await expect(page.locator("[data-test=events]")).toHaveText("play,pause")
  await page.keyboard.press("5")
  await expect.poll(() => now(page)).toBeCloseTo(3, 1)
  // A six-second clip skips two seconds and nudges one: ten would only ever land on an end.
  await page.keyboard.press("j")
  await expect.poll(() => now(page)).toBeCloseTo(1, 1)
  await page.keyboard.press("ArrowRight")
  await expect.poll(() => now(page)).toBeCloseTo(2, 1)
  await page.keyboard.press("m")
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible()
})

test("a press on the seek bar seeks there, and hovering it shows the time", async ({ page }) => {
  await open(page)
  const box = (await seek(page).boundingBox())!
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2)
  await expect(player(page).getByText("0:03.0", { exact: true })).toBeVisible()
  await page.mouse.down()
  await page.mouse.up()
  await expect.poll(() => now(page)).toBeCloseTo(3, 0)
})

test("speed comes from the menu and the keys", async ({ page }) => {
  await open(page)
  await page.getByRole("button", { name: "Speed" }).click()
  await page.getByRole("menuitem", { name: "1.5×" }).click()
  await expect(page.getByRole("button", { name: "Speed" })).toContainText("1.5×")
  await player(page).focus()
  await page.keyboard.press("Shift+Comma")
  await expect(page.getByRole("button", { name: "Speed" })).toContainText("1.25×")
})

test("controls step aside while it plays and come back on a move", async ({ page }) => {
  await open(page)
  await player(page).focus()
  await page.keyboard.press(" ")
  const controls = seek(page).locator("..")
  await page.mouse.move(5, 5)
  await expect(controls).toHaveClass(/opacity-0/, { timeout: 4000 })
  const box = (await player(page).boundingBox())!
  await page.mouse.move(box.x + 100, box.y + 100)
  await expect(controls).not.toHaveClass(/opacity-0/)
})

test("the right-click menu holds speed, copy time and copy frame", async ({ page }) => {
  await open(page)
  const box = (await player(page).boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 80, { button: "right" })
  const menu = page.getByRole("menu")
  await expect(menu).toContainText("At 0:00.0")
  for (const name of ["Play", "Mute", "Speed", "Copy time", "Copy frame"]) await expect(menu.getByRole("menuitem", { name: new RegExp(name) })).toBeVisible()
})

test("the clock keeps its width as the time runs", async ({ page }) => {
  await open(page)
  const clock = player(page).getByText("/ 0:06.0").locator("..")
  const widths = new Set<number>()
  for (const key of ["0", "3", "6", "9"]) {
    await player(page).focus()
    await page.keyboard.press(key)
    await page.waitForTimeout(100)
    widths.add(Math.round((await clock.boundingBox())!.width))
  }
  expect(widths.size).toBe(1)
})

test("it starts with sound, and the volume slider still moves after muting", async ({ page }) => {
  await open(page)
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Mute", exact: true }).click()
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible()
  const volume = page.getByRole("slider", { name: "Volume" })
  await page.getByRole("button", { name: "Unmute" }).hover()
  await volume.focus()
  await page.keyboard.press("ArrowRight")
  await expect(volume).not.toHaveAttribute("aria-valuenow", "0")
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeVisible()
})

test("the skip buttons move by a step that suits the length, within the video", async ({ page }) => {
  await open(page)
  await player(page).focus()
  await page.keyboard.press("5")
  await expect.poll(() => now(page)).toBeCloseTo(3, 1)
  await page.getByRole("button", { name: "Back 2 seconds" }).click()
  await expect.poll(() => now(page)).toBeCloseTo(1, 1)
  await page.getByRole("button", { name: "Forward 2 seconds" }).click()
  await page.getByRole("button", { name: "Forward 2 seconds" }).click()
  await page.getByRole("button", { name: "Forward 2 seconds" }).click()
  await expect.poll(() => now(page)).toBe(6)
})

test("a narrow player keeps one line of controls, the rest in its menu", async ({ page }) => {
  await open(page)
  await page.setViewportSize({ width: 340, height: 700 })
  const bar = seek(page).locator("xpath=following-sibling::div[1]")
  const frame = (await player(page).boundingBox())!
  await expect(page.getByRole("button", { name: "Back 2 seconds" })).toBeHidden()
  const box = (await bar.boundingBox())!
  expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width + 1)
  expect(box.height).toBeLessThan(40)
})

test("a start eases in and then plays at the chosen speed and volume", async ({ page }) => {
  await open(page)
  await page.getByRole("button", { name: "Play", exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => document.querySelector("video")!.playbackRate)).toBe(1)
  await expect(page.getByRole("button", { name: "Speed" })).toContainText("1×")
  await expect(page.getByRole("button", { name: "Mute", exact: true })).toBeVisible()
  const t = await now(page)
  await page.waitForTimeout(600)
  expect(await now(page)).toBeGreaterThan(t + 0.3)
})

test("an app's button in #actions sits over the picture and works", async ({ page }) => {
  await open(page)
  const remove = page.getByRole("button", { name: "Remove video" })
  const box = (await remove.boundingBox())!
  const frame = (await player(page).boundingBox())!
  expect(box.x + box.width).toBeGreaterThan(frame.x + frame.width - 60)
  expect(box.y).toBeLessThan(frame.y + 60)
  await remove.click()
  await expect(page.locator("[data-test=events]")).toHaveText("removed")
})

test("a fitted player in full screen fills the screen instead of going black", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto("/tests/browser/?scenario=video-player&fit")
  const fitted = page.getByRole("region", { name: "Fitted clip" })
  await fitted.hover()
  await fitted.getByRole("button", { name: "Full screen" }).click()
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)
  const box = await fitted.locator("video").first().boundingBox()
  expect(box?.width).toBe(1000)
  expect(box?.height).toBe(800)
})
