import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const frame = (page: Page) => page.frameLocator("iframe")
const fired = (page: Page) => page.getByRole("status", { name: "Fired" })

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/?scenario=hotkey-frame")
  await expect(frame(page).locator("[data-test-plain]")).toBeVisible()
})

test("a page hotkey fires while the focus is in the frame", async ({ page }) => {
  await frame(page).locator("[data-test-plain]").focus()
  await page.keyboard.press("p")
  await expect(fired(page)).toHaveText("page-letter")
})

test("a sequence goes through the frame key by key", async ({ page }) => {
  await frame(page).locator("[data-test-plain]").focus()
  await page.keyboard.press("g")
  await page.keyboard.press("i")
  await expect(fired(page)).toHaveText("page-sequence")
})

test("a hotkey registered inside the frame fires", async ({ page }) => {
  await frame(page).locator("[data-test-plain]").focus()
  await page.keyboard.press("k")
  await expect(fired(page)).toHaveText("frame-letter")
})

test("a scoped hotkey answers only with the focus in its box, across realms", async ({ page }) => {
  await frame(page).locator("[data-test-plain]").focus()
  await page.keyboard.press("s")
  await expect(fired(page)).toHaveText("")
  await frame(page).locator("[data-test-scoped]").focus()
  await page.keyboard.press("s")
  await expect(fired(page)).toHaveText("frame-scoped")
})

test("typing in a frame's field stays typing, and allowInInput still reaches the page", async ({ page }) => {
  const field = frame(page).locator("[data-test-field]")
  await field.focus()
  await page.keyboard.type("psk")
  await expect(field).toHaveValue("psk")
  await expect(fired(page)).toHaveText("")
  await page.keyboard.press("F2")
  await expect(fired(page)).toHaveText("page-allow-in-input")
})

test("the shortcuts reference opens by its key from the frame and closes on Escape", async ({ page }) => {
  await frame(page).locator("[data-test-plain]").focus()
  await page.keyboard.press("F1")
  const dialog = frame(page).getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText("Frame key")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
})

test("keys drawn in a frame show the chord", async ({ page }) => {
  await expect(frame(page).locator("kbd").first()).toBeVisible()
})
