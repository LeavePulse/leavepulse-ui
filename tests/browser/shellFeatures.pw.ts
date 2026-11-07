import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const open = (page: Page, query: string) => page.goto(`/tests/browser/?scenario=shell-features&${query}`)
const headerBottom = (page: Page) => page.locator("header").first().evaluate((el) => el.getBoundingClientRect().bottom)
const opacityAnimations = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter((a) => "opacity" in ((a.effect as KeyframeEffect).getKeyframes()[0] ?? {})).length)
const goTo = (page: Page, path: string) =>
  page.evaluate((next) => {
    ;(window as unknown as { shellFeatures: { path: { value: string } } }).shellFeatures.path.value = next
  }, path)

/* What scrolls the page: the window by default, the shell's own region with `region`. */
for (const scroll of ["document", "region"] as const) {
  test.describe(`scrolling the ${scroll}`, () => {
    const mode = scroll === "region" ? "&region" : ""
    const scroller = (page: Page) => (scroll === "document" ? page.locator("html") : page.locator("main [data-reka-scroll-area-viewport]"))
    const scrollMain = (page: Page, top: number) => scroller(page).evaluate((el, value) => el.scrollTo({ top: value, behavior: "instant" }), top)

    test("the header leaves on the way down and returns on the way up", async ({ page }) => {
      await open(page, `collapse${mode}`)
      await scrollMain(page, 800)
      await expect.poll(() => headerBottom(page)).toBeLessThanOrEqual(1)
      await scrollMain(page, 500)
      await expect.poll(() => headerBottom(page)).toBeGreaterThan(60)
    })

    test("tabbing into a hidden header brings it back", async ({ page }) => {
      await open(page, `collapse${mode}`)
      await scrollMain(page, 800)
      await expect.poll(() => headerBottom(page)).toBeLessThanOrEqual(1)
      await page.getByRole("button", { name: "Save" }).focus()
      await expect.poll(() => headerBottom(page)).toBeGreaterThan(60)
    })

    test("the button back to the top appears past its distance and keeps focus in the page", async ({ page }) => {
      await open(page, `top${mode}`)
      const button = page.getByRole("button", { name: "Back to top" })
      await expect(button).toHaveCount(0)
      await scrollMain(page, 400)
      await button.click()
      await expect(button).toHaveCount(0)
      await expect(page.getByRole("main")).toBeFocused()
      await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBe(0)
    })

    test("density tightens the page and marks main", async ({ page }) => {
      await open(page, `density${mode}`)
      await expect(page.getByRole("main")).toHaveAttribute("data-lp-density", "compact")
      const padding = await page.locator("[data-test-page]").evaluate((el) => getComputedStyle(el.parentElement!).paddingTop)
      expect(padding).toBe("12px")
    })

    test("a new path fades the page and the header on one clock", async ({ page }) => {
      await open(page, `fade${mode}`)
      await goTo(page, "/b")
      await expect.poll(() => opacityAnimations(page)).toBeGreaterThanOrEqual(2)
    })

    test("the aside scrolls on its own and keeps the page in place", async ({ page }) => {
      await page.setViewportSize({ width: 1300, height: 700 })
      await open(page, `aside${mode}`)
      const side = page.locator("aside [data-reka-scroll-area-viewport]")
      await side.evaluate((el) => el.scrollTo({ top: 300, behavior: "instant" }))
      await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBe(0)
      expect(await side.evaluate((el) => el.scrollTop)).toBe(300)
      const [main, aside] = await Promise.all([page.getByRole("main").boundingBox(), page.getByRole("complementary").boundingBox()])
      expect(main!.x + main!.width).toBeLessThanOrEqual(aside!.x + 1)
      expect(aside!.y).toBe(main!.y)
    })
  })
}

test.describe("scrolling the document", () => {
  test("the page is the document's, so a full-page capture gets all of it", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "")
    const sizes = await page.evaluate(() => ({ page: document.documentElement.scrollHeight, view: innerHeight }))
    expect(sizes.page).toBeGreaterThan(3000)
    expect(sizes.view).toBe(700)
  })

  test("the rail and the header stay in view while the page scrolls under them", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "")
    await page.locator("html").evaluate((el) => el.scrollTo({ top: 1500, behavior: "instant" }))
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(1500)
    const rail = await page.getByRole("navigation").first().boundingBox()
    expect(rail!.y).toBe(0)
    expect(rail!.height).toBe(700)
    expect(await page.locator("header").first().evaluate((el) => el.getBoundingClientRect().top)).toBe(0)
  })

  test("the aside stays beside the page, under the header", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "aside")
    await page.locator("html").evaluate((el) => el.scrollTo({ top: 1500, behavior: "instant" }))
    const aside = await page.getByRole("complementary").boundingBox()
    expect(aside!.y).toBe(64)
    expect(aside!.height).toBe(700 - 64)
  })

  test("the bottom bar stays at the foot of the screen", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 700 })
    await open(page, "bottom")
    await page.locator("html").evaluate((el) => el.scrollTo({ top: 1500, behavior: "instant" }))
    const bar = await page.locator("nav").filter({ has: page.getByRole("button", { name: "More" }) }).boundingBox()
    expect(Math.round(bar!.y + bar!.height)).toBe(700)
  })

  test("a dialog holds the page where it is and gives it back", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 })
    await open(page, "")
    await page.locator("html").evaluate((el) => el.scrollTo({ top: 1200, behavior: "instant" }))
    const width = await page.locator("main").evaluate((el) => el.getBoundingClientRect().width)
    await page.getByRole("button", { name: "Open dialog" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.mouse.move(650, 600)
    await page.mouse.wheel(0, 800)
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200)
    // The scrollbar the lock takes away must not widen the page under the dialog.
    // Under the dialog main is aria-hidden, so it is found by its tag.
    expect(await page.locator("main").evaluate((el) => el.getBoundingClientRect().width)).toBe(width)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.mouse.wheel(0, 300)
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(1500)
  })

  test("a control in the sticky header takes focus without moving the page", async ({ page }) => {
    await open(page, "")
    await page.locator("html").evaluate((el) => el.scrollTo({ top: 1200, behavior: "instant" }))
    await page.getByRole("button", { name: "Save" }).focus()
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => scrollY)).toBe(1200)
  })
})

test("under reduced motion a new path does not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await open(page, "fade")
  await goTo(page, "/b")
  await expect(page.getByText("Page /b")).toBeVisible()
  expect(await opacityAnimations(page)).toBe(0)
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

test("options unset leave the region shell's markup as it was", async ({ page }) => {
  await open(page, "plain&region")
  await expect(page.locator("main")).not.toHaveAttribute("data-lp-density", /.*/)
  await expect(page.locator("main")).toHaveClass("flex min-h-0 flex-1 flex-col outline-none")
  await expect(page.locator("header").first()).toHaveClass("relative flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6")
  await expect(page.locator("aside")).toHaveCount(0)
})

test("the document shell keeps main as it was and makes the header sticky", async ({ page }) => {
  await open(page, "plain")
  await expect(page.locator("main")).toHaveClass("flex min-h-0 flex-1 flex-col outline-none")
  await expect(page.locator("header").first()).toHaveClass(/\bsticky\b/)
  await expect(page.locator("header").first()).toHaveClass(/\btop-0\b/)
})

test("where the browser's bars float over the page, the shell draws none and keeps them", async ({ page }) => {
  // Headless Chromium's bars float (it hides them), as a phone's do.
  await open(page, "")
  await expect(page.locator("html")).not.toHaveClass(/\blp-scrollbar-none\b/)
  await expect(page.locator("[data-lp-page-scrollbar]")).toBeHidden()
})
