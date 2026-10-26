import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"

const view = (page: Page) => page.locator("main [data-reka-scroll-area-viewport]")
const scrollTop = (page: Page) => view(page).evaluate((el) => el.scrollTop)
const anchorGap = (page: Page, id: string) =>
  page.evaluate((target) => {
    const el = document.getElementById(target)!
    const box = document.querySelector("main [data-reka-scroll-area-viewport]")!
    return Math.round(el.getBoundingClientRect().top - box.getBoundingClientRect().top)
  }, id)
const go = (page: Page, to: string, hash = "") =>
  page.evaluate(([p, h]) => (window as unknown as { shellGo: (page: string, hash?: string) => void }).shellGo(p!, h), [to, hash])

test("back returns a page to where it was left, a new page starts at the top", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=shell-scroll&page=a")
  await expect(page.getByText("Paragraph A1", { exact: true })).toBeVisible()
  await view(page).evaluate((el) => el.scrollTo({ top: 1500 }))
  await go(page, "b")
  await expect(page.getByText("Paragraph B1", { exact: true })).toBeVisible()
  await expect.poll(() => scrollTop(page)).toBe(0)
  await page.goBack()
  await expect(page.getByText("Paragraph A1", { exact: true })).toBeAttached()
  await expect.poll(() => scrollTop(page)).toBe(1500)
})

test("a hash lands on its anchor even when the anchor renders late, keeping its scroll margin", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=shell-scroll&page=a")
  await expect(page.getByText("Paragraph A1", { exact: true })).toBeVisible()
  await go(page, "b", "#b-late")
  await expect(page.locator("#b-late")).toBeAttached()
  await expect.poll(() => anchorGap(page, "b-late")).toBe(24)
})

test("an address opened with a hash lands on it", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=shell-scroll&page=a#a-deep")
  await expect(page.locator("#a-deep")).toBeAttached()
  await expect.poll(() => anchorGap(page, "a-deep")).toBe(24)
})

test("a new hash on the same page glides there", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=shell-scroll&page=a")
  await expect(page.getByText("Paragraph A1", { exact: true })).toBeVisible()
  const path: number[] = []
  await view(page).evaluate((el) => {
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
  path.push(...(await page.evaluate(() => (window as unknown as { glidePath: number[] }).glidePath)))
  const end = path.at(-1)!
  expect(path.some((top) => top > 0 && top < end - 10)).toBe(true)
})
