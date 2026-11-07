import type { Locator, Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const windowNamed = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true })
const titleBar = (win: Locator, name: string) => win.getByLabel(`Move window: ${name}`)

async function drag(page: Page, from: Locator, x: number, y: number) {
  const box = (await from.boundingBox())!
  await page.mouse.move(box.x + Math.min(40, box.width / 2), box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 6 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto("/tests/browser/?scenario=workspace")
})

test("a window moves by its title bar and comes back there after a reload", async ({ page }) => {
  const win = windowNamed(page, "First")
  await drag(page, titleBar(win, "First"), 500, 300)
  const moved = (await win.boundingBox())!
  expect(moved.x).toBeGreaterThan(300)
  await page.reload()
  const again = (await windowNamed(page, "First").boundingBox())!
  expect(Math.round(again.x)).toBe(Math.round(moved.x))
  expect(Math.round(again.y)).toBe(Math.round(moved.y))
})

test("dropping on a screen edge docks, and dragging away undocks at the old size", async ({ page }) => {
  const win = windowNamed(page, "First")
  await drag(page, titleBar(win, "First"), 3, 400)
  await expect(win).toHaveAttribute("data-dock", "left")
  await expect.poll(async () => (await win.boundingBox())!.height).toBe(800)
  await drag(page, titleBar(win, "First"), 500, 300)
  await expect(win).not.toHaveAttribute("data-dock", /.+/)
  await expect.poll(async () => Math.round((await win.boundingBox())!.width)).toBe(300)
})

test("an edge resizes, within the minimum", async ({ page }) => {
  const win = windowNamed(page, "First")
  await win.click({ position: { x: 20, y: 20 } })
  await drag(page, win.locator('[data-lp-window-edge="e"]'), 700, 200)
  await expect.poll(async () => (await win.boundingBox())!.width).toBeGreaterThan(400)
  const box = (await win.boundingBox())!
  await drag(page, win.locator('[data-lp-window-edge="e"]'), box.x + 10, 200)
  await expect.poll(async () => Math.round((await win.boundingBox())!.width)).toBe(240)
})

test("the window that was pressed comes to the front", async ({ page }) => {
  const first = windowNamed(page, "First")
  const second = windowNamed(page, "Second")
  const z = (win: Locator) => win.evaluate((el) => Number(getComputedStyle(el).zIndex))
  expect(await z(second)).toBeGreaterThan(await z(first))
  await first.getByText("First body").click()
  expect(await z(first)).toBeGreaterThan(await z(second))
})

test("a smaller view fits the window and a larger one gives its place back", async ({ page }) => {
  const win = windowNamed(page, "First")
  await drag(page, titleBar(win, "First"), 880, 500)
  const wide = (await win.boundingBox())!
  await page.setViewportSize({ width: 500, height: 400 })
  await expect.poll(async () => {
    const box = (await win.boundingBox())!
    return box.x + box.width <= 500 && box.y + box.height <= 400
  }).toBe(true)
  await page.setViewportSize({ width: 1200, height: 800 })
  await expect.poll(async () => Math.round((await win.boundingBox())!.x)).toBe(Math.round(wide.x))
})

test("arrow keys on the title bar move it, Enter fills the view, Escape closes and returns focus", async ({ page }) => {
  await page.getByRole("button", { name: "Open first" }).focus()
  const win = windowNamed(page, "First")
  await win.getByRole("button", { name: "Close" }).click()
  await page.getByRole("button", { name: "Open first" }).click()
  await expect(win).toBeFocused()
  const bar = titleBar(win, "First")
  await bar.focus()
  const before = (await win.boundingBox())!
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await win.boundingBox())!.x).toBeGreaterThan(before.x)
  await page.keyboard.press("Enter")
  await expect(win).toHaveAttribute("data-dock", "full")
  await page.keyboard.press("Enter")
  await page.keyboard.press("Escape")
  await expect(win).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open first" })).toBeFocused()
})

test("a window does not take the page: what is behind it stays usable", async ({ page }) => {
  await page.getByRole("button", { name: "Select" }).click()
  await expect(page.getByRole("complementary").getByText("alpha").first()).toBeVisible()
})

test("a window in an LpFrame drags in the frame's own window", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=workspace&mode=frame")
  const frame = page.frameLocator("iframe").first()
  const win = frame.getByRole("dialog", { name: "Framed", exact: true })
  const before = (await win.boundingBox())!
  await page.mouse.move(before.x + 40, before.y + 15)
  await page.mouse.down()
  await page.mouse.move(before.x + 200, before.y + 100, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await win.boundingBox())!.x).toBeGreaterThan(before.x + 100)
})

test("the inspector shows its empty state, then the subject's facts", async ({ page }) => {
  const panel = page.getByRole("complementary")
  await expect(panel.getByText("Nothing selected")).toBeVisible()
  await page.getByRole("button", { name: "Select" }).click()
  await expect(panel.getByRole("heading", { name: "Overview" })).toBeVisible()
  await expect(panel.getByRole("term").filter({ hasText: "Name" })).toBeVisible()
  await page.getByRole("button", { name: "Clear" }).click()
  await expect(panel.getByText("Nothing selected")).toBeVisible()
})

test("the inspector resizes by keyboard and remembers it", async ({ page }) => {
  const panel = page.getByRole("complementary")
  const grip = panel.getByRole("separator", { name: "Resize panel" })
  const width = (await panel.boundingBox())!.width
  await grip.focus()
  await page.keyboard.press("ArrowLeft")
  await expect.poll(async () => (await panel.boundingBox())!.width).toBe(width + 16)
  await page.reload()
  await expect.poll(async () => (await page.getByRole("complementary").boundingBox())!.width).toBe(width + 16)
})

test("the inspector closes", async ({ page }) => {
  await page.getByRole("complementary").getByRole("button", { name: "Close" }).click()
  await expect(page.getByRole("complementary")).toHaveCount(0)
})

test("the switcher makes a workspace, and it survives a reload", async ({ page }) => {
  await windowNamed(page, "First").getByRole("button", { name: "Close" }).click()
  await windowNamed(page, "Second").getByRole("button", { name: "Close" }).click()
  await page.getByRole("button", { name: /^Workspaces: / }).click()
  await page.getByRole("menuitem", { name: "New workspace" }).click()
  const dialog = page.getByRole("dialog", { name: "New workspace" })
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(dialog.getByText("Enter a name")).toBeVisible()
  await dialog.getByRole("textbox").fill("Ops")
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(page.getByRole("button", { name: "Workspaces: Ops" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("button", { name: "Workspaces: Ops" })).toBeVisible()
})
