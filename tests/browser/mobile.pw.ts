import { expect, test } from "./fixtures"

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const ENTRY = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]), textarea, [contenteditable=true]"

async function smallEntries(scope: import("@playwright/test").Locator) {
  return scope.evaluate((root, selector) => [...root.querySelectorAll<HTMLElement>(selector)]
    .filter((el) => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${el.getAttribute("aria-label") ?? el.closest("[aria-label]")?.getAttribute("aria-label") ?? el.tagName} ${getComputedStyle(el).fontSize}`), ENTRY)
}

test("text entries are at least 16px on a phone so iOS does not zoom on focus", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=mobile")
  const entries = page.getByRole("region", { name: "Entries" })
  await page.getByRole("button", { name: /Edit Name/ }).click()
  expect(await smallEntries(entries)).toEqual([])
  await page.getByRole("button", { name: "Searchable, Alpha" }).click()
  const listbox = page.getByRole("listbox")
  await expect(listbox).toBeVisible()
  expect(await smallEntries(page.locator("[data-reka-popper-content-wrapper]"))).toEqual([])
})

test("an editable code block keeps its highlighted text under the caret at 16px", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=mobile")
  const editor = page.locator("textarea.lp-entry").last()
  const sizes = await editor.evaluate((el) => [getComputedStyle(el).fontSize, getComputedStyle(el.nextElementSibling!).fontSize])
  expect(sizes).toEqual(["16px", "16px"])
})
