import type { Locator, Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const URL = "/tests/browser/?scenario=drag-sort"
const item = (page: Page, key: string) => page.locator(`[data-drag-key="${key}"]`)

async function drag(page: Page, from: Locator, to: Locator, where: "top" | "bottom", during?: () => Promise<void>) {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + 6)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + 10, { steps: 3 })
  await page.mouse.move(b.x + b.width / 2, where === "top" ? b.y + 3 : b.y + b.height - 3, { steps: 10 })
  await during?.()
  await page.mouse.up()
}

test("an item moves within its sorted zone", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "s4"), item(page, "s2"), "top")
  await expect(page.getByTestId("order")).toContainText("s1,s4,s2,s3 |")
  await expect(page.getByTestId("log")).toHaveText("s4:list>list@s2")
})

test("dropping into the same gap is no drop", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "s2"), item(page, "s3"), "top")
  await expect(page.getByTestId("log")).toHaveText("none")
})

test("a line shows where the item will land", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "s1"), item(page, "s4"), "bottom", async () => {
    const line = page.locator("body > div[aria-hidden='true']").filter({ hasNotText: /./ }).first()
    await expect.poll(() => line.evaluate((el) => (el as HTMLElement).style.opacity)).toBe("1")
  })
  await expect(page.getByTestId("order")).toContainText("s2,s3,s4,s1 |")
})

test("a channel moves into another category in front of a channel", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "ch1"), item(page, "ch3"), "top")
  await expect(page.getByTestId("order")).toContainText("c1:ch2,c2:ch1+ch3")
})

test("a category dragged over another category's channels lands in the category list", async ({ page }) => {
  await page.goto(URL)
  await drag(page, page.locator("[data-drag-key='c2'] > p"), item(page, "ch1"), "top", async () => {
    await expect(page.getByTestId("cat-c1")).not.toHaveAttribute("data-drop-over", "")
    await expect(page.getByTestId("cats")).toHaveAttribute("data-drop-over", "")
  })
  await expect(page.getByTestId("log")).toHaveText("c2:cats>cats@c1")
  await expect(page.getByTestId("order")).toContainText("| c2:ch3,c1:ch1+ch2")
})
