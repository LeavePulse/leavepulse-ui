import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"

/*
 * The shell places a page the same way whichever scrolls it: the window (the
 * default) or its own region. An anchor lands its scroll margin below the
 * header in both, which in the document is sticky over the page.
 */
for (const scroll of ["document", "region"] as const) {
  test.describe(`scrolling the ${scroll}`, () => {
    const open = (page: Page, rest: string) => page.goto(`/tests/browser/?scenario=shell-scroll&scroll=${scroll}&${rest}`)
    const scroller = (page: Page) =>
      scroll === "document" ? page.locator("html") : page.locator("main [data-reka-scroll-area-viewport]")
    const scrollTop = (page: Page) => scroller(page).evaluate((el) => Math.round(el.scrollTop))
    const anchorGap = (page: Page, id: string) =>
      page.evaluate((target) => {
        const el = document.getElementById(target)!
        const header = document.querySelector("header")!
        return Math.round(el.getBoundingClientRect().top - header.getBoundingClientRect().bottom)
      }, id)
    const go = (page: Page, to: string, hash = "") =>
      page.evaluate(([p, h]) => (window as unknown as { shellGo: (page: string, hash?: string) => void }).shellGo(p!, h), [to, hash])

    test("back returns a page to where it was left, a new page starts at the top", async ({ page }) => {
      await open(page, "page=a")
      await expect(page.getByText("Paragraph A1", { exact: true })).toBeVisible()
      await scroller(page).evaluate((el) => el.scrollTo({ top: 1500, behavior: "instant" }))
      await go(page, "b")
      await expect(page.getByText("Paragraph B1", { exact: true })).toBeVisible()
      await expect.poll(() => scrollTop(page)).toBe(0)
      await page.goBack()
      await expect(page.getByText("Paragraph A1", { exact: true })).toBeAttached()
      await expect.poll(() => scrollTop(page)).toBe(1500)
    })

    test("a hash lands on its anchor even when the anchor renders late, keeping its scroll margin", async ({ page }) => {
      await open(page, "page=a")
      await expect(page.getByText("Paragraph A1", { exact: true })).toBeVisible()
      await go(page, "b", "#b-late")
      await expect(page.locator("#b-late")).toBeAttached()
      await expect.poll(() => anchorGap(page, "b-late")).toBe(24)
    })

    test("an address opened with a hash lands on it", async ({ page }) => {
      await open(page, "page=a#a-deep")
      await expect(page.locator("#a-deep")).toBeAttached()
      await expect.poll(() => anchorGap(page, "a-deep")).toBe(24)
    })

    test("a new hash on the same page glides there", async ({ page }) => {
      await open(page, "page=a")
      await expect(page.getByText("Paragraph A1", { exact: true })).toBeVisible()
      await scroller(page).evaluate((el) => {
        const seen: number[] = []
        const until = performance.now() + 1500
        const sample = () => {
          seen.push(el.scrollTop)
          if (performance.now() < until) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
        Object.assign(window, { glidePath: seen })
      })
      await go(page, "a", "#a-deep")
      await expect.poll(() => anchorGap(page, "a-deep")).toBe(24)
      const path = await page.evaluate(() => (window as unknown as { glidePath: number[] }).glidePath)
      const end = path.at(-1)!
      expect(path.some((top) => top > 0 && top < end - 10)).toBe(true)
    })
  })
}
