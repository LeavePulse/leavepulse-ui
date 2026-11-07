import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const open = (page: Page, query: string) => page.goto(`/tests/browser/?scenario=shell-features&${query}`)
const scrollPage = (page: Page, top: number) =>
  page.locator("main [data-reka-scroll-area-viewport]").evaluate((el, value) => el.scrollTo({ top: value, behavior: "instant" }), top)
const scrollMain = scrollPage
const headerBottom = (page: Page) => page.locator("header").first().evaluate((el) => el.getBoundingClientRect().bottom)

test("the header leaves on the way down and returns on the way up", async ({ page }) => {
  await open(page, "collapse")
  await scrollMain(page, 800)
  await expect.poll(() => headerBottom(page)).toBeLessThanOrEqual(1)
  await scrollMain(page, 500)
  await expect.poll(() => headerBottom(page)).toBeGreaterThan(60)
})

test("tabbing into a hidden header brings it back", async ({ page }) => {
  await open(page, "collapse")
  await scrollMain(page, 800)
  await expect.poll(() => headerBottom(page)).toBeLessThanOrEqual(1)
  await page.getByRole("button", { name: "Save" }).focus()
  await expect.poll(() => headerBottom(page)).toBeGreaterThan(60)
})

test("the button back to the top appears past its distance and keeps focus in the page", async ({ page }) => {
  await open(page, "top")
  const button = page.getByRole("button", { name: "Back to top" })
  await expect(button).toHaveCount(0)
  await scrollMain(page, 400)
  await button.click()
  await expect(button).toHaveCount(0)
  await expect(page.getByRole("main")).toBeFocused()
})

test("density tightens the page and marks main", async ({ page }) => {
  await open(page, "density")
  await expect(page.getByRole("main")).toHaveAttribute("data-lp-density", "compact")
  const padding = await page.locator("[data-test-page]").evaluate((el) => getComputedStyle(el.parentElement!).paddingTop)
  expect(padding).toBe("12px")
})

test("a new path fades the page and the header on one clock", async ({ page }) => {
  await open(page, "fade")
  await page.evaluate(() => {
    ;(window as unknown as { shellFeatures: { path: { value: string } } }).shellFeatures.path.value = "/b"
  })
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => "opacity" in ((a.effect as KeyframeEffect).getKeyframes()[0] ?? {})).length)).toBeGreaterThanOrEqual(2)
})

test("under reduced motion a new path does not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await open(page, "fade")
  await page.evaluate(() => {
    ;(window as unknown as { shellFeatures: { path: { value: string } } }).shellFeatures.path.value = "/b"
  })
  await expect(page.getByText("Page /b")).toBeVisible()
  expect(await page.evaluate(() => document.getAnimations().filter((a) => "opacity" in ((a.effect as KeyframeEffect).getKeyframes()[0] ?? {})).length)).toBe(0)
})

test("the aside scrolls on its own and keeps the page in place", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 700 })
  await open(page, "aside")
  const side = page.locator("aside [data-reka-scroll-area-viewport]")
  await side.evaluate((el) => el.scrollTo({ top: 300, behavior: "instant" }))
  await expect.poll(() => page.locator("main [data-reka-scroll-area-viewport]").evaluate((el) => el.scrollTop)).toBe(0)
  expect(await side.evaluate((el) => el.scrollTop)).toBe(300)
  const [main, aside] = await Promise.all([page.getByRole("main").boundingBox(), page.getByRole("complementary").boundingBox()])
  expect(main!.x + main!.width).toBeLessThanOrEqual(aside!.x + 1)
  expect(aside!.y).toBe(main!.y)
})

test("the aside is gone below its breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 })
  await open(page, "aside")
  await expect(page.getByRole("complementary")).toBeHidden()
})

test("the navigation follows the width through one model", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 700 })
  await open(page, "adaptive")
  const modes = page.getByRole("status", { name: "Modes" })
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden()
  await page.setViewportSize({ width: 1100, height: 700 })
  await expect(modes).toHaveText("compact")
  await page.setViewportSize({ width: 600, height: 700 })
  await expect(modes).toHaveText("compact,drawer")
  await expect(page.getByRole("navigation", { name: "In this section" }).getByRole("button", { name: "Two" })).toBeVisible()
  await page.setViewportSize({ width: 1400, height: 700 })
  await expect(modes).toHaveText("compact,drawer,rail")
  await expect(page.getByRole("navigation", { name: "In this section" })).toHaveCount(0)
})

test("options unset leave the shell's markup as it was", async ({ page }) => {
  await open(page, "plain")
  await expect(page.locator("main")).not.toHaveAttribute("data-lp-density", /.*/)
  await expect(page.locator("main")).toHaveClass("flex min-h-0 flex-1 flex-col outline-none")
  await expect(page.locator("header").first()).toHaveClass("relative flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6")
  await expect(page.locator("aside")).toHaveCount(0)
})
