import { expect, test } from "./fixtures"

const row = (page: import("@playwright/test").Page) => page.locator('[data-testid="strip"] [data-lp-strip-row]')
const left = (page: import("@playwright/test").Page) => row(page).evaluate((el) => el.scrollLeft)
const pageY = (page: import("@playwright/test").Page) => page.evaluate(() => window.scrollY)

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/tests/browser/?scenario=scroll-strip")
  await expect(row(page)).toBeVisible()
})

test("a vertical wheel scrolls the strip sideways and leaves the page where it was", async ({ page }) => {
  await row(page).hover()
  const before = await pageY(page)
  await page.mouse.wheel(0, 200)
  await expect.poll(() => left(page)).toBeGreaterThan(100)
  expect(await pageY(page)).toBe(before)
  await expect(row(page)).toHaveAttribute("data-lp-more-start", "")
})

test("at the end of the strip the wheel scrolls the page again", async ({ page }) => {
  await row(page).evaluate((el) => (el.scrollLeft = el.scrollWidth))
  await expect(row(page)).not.toHaveAttribute("data-lp-more-end", "")
  await row(page).hover()
  const before = await pageY(page)
  await page.mouse.wheel(0, 200)
  await expect.poll(() => pageY(page)).toBeGreaterThan(before)
})

test("at the start a wheel up is the page's", async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, 120))
  await row(page).hover()
  await page.mouse.wheel(0, -100)
  await expect.poll(() => pageY(page)).toBeLessThan(120)
  expect(await left(page)).toBe(0)
})

test("dragging with the mouse scrolls the strip and does not click what it started on", async ({ page }) => {
  const first = page.getByRole("button", { name: "Branch 2", exact: true })
  const box = (await first.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2 - i * 15, box.y + box.height / 2)
  await page.mouse.up()
  await expect.poll(() => left(page)).toBeGreaterThan(100)
  await page.waitForTimeout(50)
  await expect(page.getByTestId("clicked")).toHaveText("")
})

test("a click on an item still clicks it", async ({ page }) => {
  await page.getByRole("button", { name: "Branch 3", exact: true }).click()
  await expect(page.getByTestId("clicked")).toHaveText("Branch 3")
})

test("a press that wobbles a pixel or two is still a click", async ({ page }) => {
  const item = page.getByRole("button", { name: "Branch 1", exact: true })
  const box = (await item.boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + 12, box.y + 6)
  await page.mouse.up()
  await expect(page.getByTestId("clicked")).toHaveText("Branch 1")
})

test("the next button pages along and the keyboard brings the focused item into view", async ({ page }) => {
  await row(page).hover()
  const next = page.locator('[data-testid="strip"] [data-lp-strip-button="next"]')
  await next.click()
  await expect.poll(() => left(page)).toBeGreaterThan(150)
  await row(page).evaluate((el) => (el.scrollLeft = 0))
  await page.getByRole("button", { name: "Branch 1", exact: true }).focus()
  for (let i = 0; i < 15; i++) await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "Branch 16", exact: true })).toBeFocused()
  await expect.poll(() => left(page)).toBeGreaterThan(300)
  const inView = await page.getByRole("button", { name: "Branch 16", exact: true }).evaluate((el) => {
    const r = el.getBoundingClientRect()
    const s = el.closest("[data-lp-strip-row]")!.getBoundingClientRect()
    return r.left >= s.left && r.right <= s.right
  })
  expect(inView).toBe(true)
})

test("tabs: a drag across the row scrolls it without picking a tab, a click picks one", async ({ page }) => {
  const tabsRow = page.locator('[data-testid="tabs"] [data-lp-strip-row]')
  const third = page.getByRole("tab", { name: "Section 3" })
  const box = (await third.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2 - i * 15, box.y + box.height / 2)
  await page.mouse.up()
  await expect.poll(() => tabsRow.evaluate((el) => el.scrollLeft)).toBeGreaterThan(60)
  await page.waitForTimeout(50)
  await expect(page.getByTestId("tab")).toHaveText("t1")
  await page.getByRole("tab", { name: "Section 4" }).click()
  await expect(page.getByTestId("tab")).toHaveText("t4")
})

async function inView(page: import("@playwright/test").Page, name: string) {
  const frame = (await page.locator('[data-testid="tabs"] [data-lp-strip-row]').boundingBox())!
  const tab = (await page.getByRole("tab", { name }).boundingBox())!
  return tab.x >= frame.x - 1 && tab.x + tab.width <= frame.x + frame.width + 1
}

test("tabs: a tab picked before the first paint starts in view", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=scroll-strip&tab=t10")
  await expect.poll(() => inView(page, "Section 10")).toBe(true)
})

test("tabs: a tab picked from outside is brought into view", async ({ page }) => {
  await page.getByTestId("pick-last").click()
  await expect.poll(() => inView(page, "Section 12")).toBe(true)
})
