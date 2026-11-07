import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

type Shell = {
  openBoth(): void
  dropFirstSection(): void
  addSheet(): void
  changeSheet(): void
  focusAt: { value: number | null }
  orientation: { value: string }
  bleed: { value: boolean }
  inner: { value: boolean }
  outer: { value: boolean }
}
const shell = (page: Page, run: (api: Shell) => void) =>
  page.evaluate(`(${run})(window.shell)`)
const inFrame = (page: Page) => page.frameLocator("iframe")
const bodyStyle = (page: Page) =>
  page.evaluate(() => ({ overflow: document.body.style.overflow, pointer: document.body.style.pointerEvents }))

test.describe("inside an LpFrame", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/browser/?scenario=shell-frame")
    await expect(inFrame(page).getByRole("toolbar")).toBeVisible()
  })

  test("the sidebar's arrow keys walk its rows", async ({ page }) => {
    await inFrame(page).getByRole("button", { name: "Alpha" }).focus()
    await page.keyboard.press("ArrowDown")
    await expect(inFrame(page).getByRole("button", { name: "Beta" })).toBeFocused()
  })

  test("the dock swells under the pointer", async ({ page }) => {
    await inFrame(page).getByRole("button", { name: "One" }).hover()
    await expect
      .poll(() => inFrame(page).getByRole("button", { name: "One" }).evaluate((el) => parseFloat(getComputedStyle(el).width)))
      .toBeGreaterThan(50)
  })

  test("releasing the scroll thumb ends the drag", async ({ page }) => {
    const area = inFrame(page).locator("[data-test-scroll]")
    await area.hover()
    const box = (await area.locator("[data-lp-thumb]").first().boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + 4)
    await page.mouse.down()
    await expect(area).toHaveClass(/select-none/)
    await page.mouse.up()
    await expect(area).not.toHaveClass(/select-none/)
  })

  test("the layout's splitter follows the pointer and lets go", async ({ page }) => {
    const splitter = inFrame(page).locator(".cursor-col-resize")
    const grip = (await splitter.boundingBox())!
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    await page.mouse.move(grip.x + grip.width / 2 + 60, grip.y + grip.height / 2, { steps: 4 })
    await page.mouse.up()
    await expect.poll(async () => (await splitter.boundingBox())!.x).toBeGreaterThan(grip.x + 40)
    const settled = (await splitter.boundingBox())!.x
    await page.mouse.move(grip.x + 200, grip.y + grip.height / 2)
    expect((await splitter.boundingBox())!.x).toBe(settled)
  })

  test("a tab closes from the keyboard, and no button sits inside a button", async ({ page }) => {
    const close = inFrame(page).getByRole("button", { name: "Close tabbed" })
    await expect(inFrame(page).locator("button button")).toHaveCount(0)
    await close.focus()
    await page.keyboard.press("Enter")
    await expect(close).toHaveCount(0)
    await expect(inFrame(page).getByRole("button", { name: "right", exact: true })).toBeVisible()
  })

  test("a stylesheet link changed in the page changes in the frame", async ({ page }) => {
    await shell(page, (api) => api.addSheet())
    const copy = inFrame(page).locator('link[id="mirrored"]')
    await expect(copy).toHaveAttribute("href", /first/)
    await shell(page, (api) => api.changeSheet())
    await expect(copy).toHaveAttribute("href", /second/)
    await expect(copy).toHaveAttribute("media", "print")
    await expect(copy).toHaveAttribute("disabled", "")
  })

  test("a modal in the frame leaves the page free", async ({ page }) => {
    await shell(page, (api) => (api.inner.value = true))
    await expect(inFrame(page).getByText("Frame body")).toBeVisible()
    await expect.poll(() => bodyStyle(page)).toEqual({ overflow: "", pointer: "" })
    await page.locator("[data-page-button]").click({ timeout: 2000 })
    await expect(inFrame(page).getByText("Frame body")).toBeVisible()
    await shell(page, (api) => (api.inner.value = false))
    await expect(inFrame(page).getByText("Frame body")).toHaveCount(0)
    await expect.poll(() => bodyStyle(page)).toEqual({ overflow: "", pointer: "" })
  })

  test("the page's own modal keeps its lock next to a modal in the frame, and neither leaves one behind", async ({ page }) => {
    await shell(page, (api) => api.openBoth())
    await expect(page.getByText("Page body")).toBeVisible()
    await expect(inFrame(page).getByText("Frame body")).toBeVisible()
    await expect.poll(async () => (await bodyStyle(page)).pointer).toBe("none")
    await shell(page, (api) => (api.outer.value = false))
    await expect(page.getByText("Page body")).toHaveCount(0)
    await expect.poll(() => bodyStyle(page)).toEqual({ overflow: "", pointer: "" })
    await shell(page, (api) => (api.inner.value = false))
    await expect(inFrame(page).getByText("Frame body")).toHaveCount(0)
    await expect.poll(() => bodyStyle(page)).toEqual({ overflow: "", pointer: "" })
  })
})

test.describe("the shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/browser/?scenario=shell-frame&mode=shell")
    await expect(page.getByText("Line 1", { exact: true })).toBeAttached()
  })

  test("a path with stray slashes still finds its page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Alpha" }).or(page.locator("header").getByText("Alpha"))).toBeVisible()
  })

  test("the skip link moves focus to the content", async ({ page }) => {
    await page.getByRole("link", { name: "Skip to content" }).focus()
    await page.keyboard.press("Enter")
    await expect(page.locator("main")).toBeFocused()
  })

  for (const scroll of ["document", "region"] as const) {
    test(`full bleed and back keeps the page and where it was, scrolling the ${scroll}`, async ({ page }) => {
      if (scroll === "region") {
        await page.goto("/tests/browser/?scenario=shell-frame&mode=shell&scroll=region")
        await expect(page.getByText("Line 1", { exact: true })).toBeAttached()
      }
      const view = scroll === "document" ? page.locator("html") : page.locator("main [data-reka-scroll-area-viewport]")
      await view.evaluate((el) => el.scrollTo({ top: 800, behavior: "instant" }))
      await shell(page, (api) => (api.bleed.value = true))
      await expect(page.getByText("Line 60", { exact: true })).toBeAttached()
      // Held to the viewport, the shell has nothing of its own to scroll.
      if (scroll === "document") await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
      await shell(page, (api) => (api.bleed.value = false))
      await expect(page.getByText("Line 60", { exact: true })).toBeAttached()
      await expect.poll(() => view.evaluate((el) => el.scrollTop)).toBe(800)
    })
  }
})

test.describe("alone on a page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/browser/?scenario=shell-frame&mode=plain")
    await expect(page.getByRole("toolbar")).toBeVisible()
  })

  test("a remembered width fits today's bounds and is kept for wider ones", async ({ page }) => {
    const rail = page.locator("aside, nav").first()
    await expect.poll(() => page.evaluate(() => localStorage.getItem("lp-sidebar:wide:width"))).toBe("400")
    await expect.poll(async () => page.locator('[style*="320px"]').count()).toBeGreaterThan(0)
    await expect(page.locator('[style*="400px"]')).toHaveCount(0)
    await expect(rail).toBeVisible()
  })

  test("a bound compact is not stored as well", async ({ page }) => {
    await page.keyboard.press("Control+b")
    await expect.poll(() => page.locator('[style*="width: 64px"]').count()).toBeGreaterThan(0)
    expect(await page.evaluate(() => localStorage.getItem("lp-sidebar:bound:compact"))).toBeNull()
  })

  test("a section keeps its element when the one before it goes", async ({ page }) => {
    const billing = page.getByRole("button", { name: "Billing" })
    await billing.evaluate((el) => el.setAttribute("data-marked", ""))
    await shell(page, (api) => api.dropFirstSection())
    await expect(page.getByRole("button", { name: "General" })).toHaveCount(0)
    await expect(billing).toHaveAttribute("data-marked", "")
  })

  test("the dock's arrows follow its orientation", async ({ page }) => {
    await page.getByRole("button", { name: "One" }).focus()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByRole("button", { name: "Two" })).toBeFocused()
    await shell(page, (api) => (api.orientation.value = "vertical"))
    await page.keyboard.press("ArrowUp")
    await expect(page.getByRole("button", { name: "One" })).toBeFocused()
  })

  test("focusAt stays on the bar when the bar moves", async ({ page }) => {
    const dock = page.getByRole("toolbar")
    await shell(page, (api) => (api.focusAt.value = 20))
    const grown = () => page.getByRole("button", { name: "One" }).evaluate((el) => parseFloat(getComputedStyle(el).width))
    await expect.poll(grown).toBeGreaterThan(50)
    await dock.evaluate((el) => (el.style.marginLeft = "200px"))
    await shell(page, (api) => (api.focusAt.value = 21))
    await page.waitForTimeout(400)
    expect(await grown()).toBeGreaterThan(50)
  })

  test("More says what it opens and that the page is behind it", async ({ page }) => {
    const more = page.getByRole("button", { name: "More" })
    await expect(more).toHaveAttribute("aria-expanded", "true")
    await expect(more).toHaveAttribute("aria-controls", "the-drawer")
    await expect(more).toHaveAttribute("aria-current", "true")
    await expect(more).toHaveAttribute("aria-haspopup", "dialog")
  })
})
