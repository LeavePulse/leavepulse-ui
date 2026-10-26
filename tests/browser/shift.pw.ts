import { expect, test } from "./fixtures"

test("the shell's header boxes stay out of positioning, so content can centre on the whole bar", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  await expect(header).toBeVisible()
  const positions = await header.evaluate((bar) =>
    [...bar.children].filter((child) => child.tagName === "DIV").map((child) => getComputedStyle(child).position),
  )
  expect(positions.length).toBeGreaterThan(0)
  expect(positions.every((position) => position === "static")).toBe(true)
})

test("a header action leaving fades where it stood", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  const action = header.getByRole("button", { name: /New rack/ })
  const was = await action.boundingBox()
  await page.getByRole("button", { name: "Stock", exact: true }).click()
  const ghost = header.locator("[data-lp-shift-ghost]").filter({ hasText: "New rack" })
  const at = await ghost.boundingBox()
  expect(Math.abs(at!.y - was!.y)).toBeLessThan(2)
  expect(Math.abs(at!.x - was!.x)).toBeLessThan(8)
  await expect(ghost).toHaveCount(0)
})

test("a tab marker inside the eased title block slides instead of fading in", async ({ page }) => {
  await page.goto("/page/appshell")
  const tabs = page.getByRole("tablist", { name: "Header section" })
  await expect(tabs).toBeVisible()
  await page.waitForTimeout(400)
  const marker = () => tabs.locator("[role=tab] .absolute.z-0").first()
  const start = (await marker().boundingBox())!.x
  await tabs.getByRole("tab", { name: "Devices" }).hover()
  const path: number[] = []
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))
    path.push((await marker().boundingBox())!.x)
  }
  const end = (await tabs.getByRole("tab", { name: "Devices" }).boundingBox())!.x
  expect(path.some((x) => x > start + 4 && x < end - 4)).toBe(true)
  expect(await marker().evaluate((el) => el.getAnimations().length)).toBe(0)
})

test("markup put back unchanged by a re-render does not flash", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  await expect(header).toBeVisible()
  await page.waitForTimeout(400)
  const flashed = await header.evaluate(async (bar) => {
    const box = bar.querySelector("button[aria-label=Search]")!.parentElement!
    const button = box.querySelector("button[aria-label=Search]")!
    const copy = button.cloneNode(true)
    button.replaceWith(copy)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    return { ghosts: bar.querySelectorAll("[data-lp-shift-ghost]").length, fading: (copy as Element).getAnimations().length }
  })
  expect(flashed).toEqual({ ghosts: 0, fading: 0 })
})
