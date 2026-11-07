import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

// Everything here renders inside an LpFrame: another document and another realm.
const inFrame = (page: Page) => page.frameLocator("iframe")

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/?scenario=realm-sweep")
  await expect(inFrame(page).getByRole("tab", { name: "One" })).toBeVisible()
})

test("a table of contents finds its headings in the frame", async ({ page }) => {
  const frame = inFrame(page)
  const second = frame.getByRole("link", { name: "Second" })
  await second.click()
  await expect(frame.locator("nav").locator("[aria-current]").first()).toContainText("Second")
  await expect.poll(() => frame.locator("#sweep-second").evaluate((el) => el.parentElement!.scrollTop)).toBeGreaterThan(0)
})

test("tabs and segments work and let go of focus", async ({ page }) => {
  const frame = inFrame(page)
  await frame.getByRole("tab", { name: "Two" }).click()
  await expect(frame.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true")
  await frame.getByText("Seg B").click()
  await expect(frame.locator('[data-state="on"]', { hasText: "Seg B" })).toBeVisible()
})

test("a shift box leaves no ghost behind after a child comes and goes", async ({ page }) => {
  const frame = inFrame(page)
  const toggle = frame.locator("[data-sweep-toggle]")
  const box = frame.locator("[data-sweep-shift]")
  await toggle.click()
  await expect(box.getByText("Extra")).toBeVisible()
  await toggle.click()
  await expect(box.getByText("Extra")).toHaveCount(0)
})

test("clicking a form label reaches the control of the frame", async ({ page }) => {
  const frame = inFrame(page)
  await frame.getByText("Named field").click()
  await expect(frame.locator("[data-sweep-control]")).toBeFocused()
})

test("a masonry measures its own box and lays out its cards", async ({ page }) => {
  const cards = inFrame(page).locator("[data-sweep-card]")
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toBeVisible()
  const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()]
  expect(a!.x).not.toBe(b!.x)
})

test("Escape from inside the frame clears a pie selection", async ({ page }) => {
  const frame = inFrame(page)
  const picked = frame.locator("[data-sweep-picked]")
  await frame.getByRole("button", { name: /Alpha/ }).click()
  await expect(picked).toHaveText("1")
  await page.keyboard.press("Escape")
  await expect(picked).toHaveText("0")
})

test("a tour spotlights a target of the frame", async ({ page }) => {
  const frame = inFrame(page)
  await frame.locator("[data-sweep-target]").click()
  await expect(frame.getByText("Sweep step")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(frame.getByText("Sweep step")).toHaveCount(0)
})
