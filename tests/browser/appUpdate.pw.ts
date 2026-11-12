import { expect, test } from "./fixtures"

const url = "/tests/browser/?scenario=app-update"

test("a newer build waits while a dialog is open or a field is focused, then reloads keeping the scroll", async ({ page }) => {
  await page.goto(url)
  await page.getByRole("button", { name: "Dialog" }).click()
  await page.evaluate(() => {
    ;(window as unknown as { __latest: string }).__latest = "build-2"
    window.scrollTo(0, 900)
  })
  await page.getByRole("button", { name: "Check" }).click()
  await page.waitForTimeout(6000)
  await expect(page.getByTestId("state")).toHaveText("fresh")

  await page.getByRole("button", { name: "Dialog" }).click()
  await page.getByLabel("Field").focus()
  await page.waitForTimeout(6000)
  await expect(page.getByTestId("state")).toHaveText("fresh")

  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.scrollTo(0, 900)
  })
  await expect(page.getByTestId("state")).toHaveText("restored", { timeout: 10000 })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800)
})

test("the same build never reloads", async ({ page }) => {
  await page.goto(url)
  await page.getByRole("button", { name: "Check" }).click()
  await page.waitForTimeout(6000)
  await expect(page.getByTestId("state")).toHaveText("fresh")
})
