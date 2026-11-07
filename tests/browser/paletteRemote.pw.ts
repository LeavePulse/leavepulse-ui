import { expect, test } from "./fixtures"

const openPalette = async (page: import("@playwright/test").Page, query = "") => {
  await page.getByRole("button", { name: "Open palette", exact: true }).click()
  const input = page.getByRole("combobox")
  await expect(input).toBeFocused()
  if (query) await input.fill(query)
  return input
}
const option = (page: import("@playwright/test").Page, name: string) => page.getByRole("option", { name, exact: true })

test.beforeEach(async ({ page }) => { await page.goto("/tests/browser/palette-remote.html") })

test("a fetched root pick comes back through resolveRecent after a reload", async ({ page }) => {
  const input = await openPalette(page, "ada")
  await expect(option(page, "Ada Lovelace")).toBeVisible()
  await input.press("Enter")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.reload()
  await openPalette(page)
  await expect(option(page, "Resolved Ada Lovelace")).toBeVisible()
})

test("a fetched root result stays pinned across a reload and unpins", async ({ page }) => {
  const input = await openPalette(page, "ada")
  await expect(option(page, "Ada Lovelace")).toBeVisible()
  await input.press("Alt+p")
  await page.reload()
  const reopened = await openPalette(page)
  await expect(option(page, "Resolved Ada Lovelace")).toBeVisible()
  await reopened.press("Alt+p")
  await expect(option(page, "Resolved Ada Lovelace")).toHaveCount(0)
})

test("a provider answering one id twice lists it once", async ({ page }) => {
  await openPalette(page, "ada")
  await expect(option(page, "Ada Lovelace")).toBeVisible()
  await expect(option(page, "Ada again")).toHaveCount(0)
})

test("one id in two places stays two commands in history and pins", async ({ page }) => {
  const input = await openPalette(page, "Services")
  await input.press("Enter")
  await expect(option(page, "Restart service")).toBeVisible()
  await input.press("Enter")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const reopened = await openPalette(page)
  await expect(option(page, "Restart service")).toBeVisible()
  await expect(option(page, "Restart root")).toBeVisible()
  await reopened.press("Alt+p")
  await page.reload()
  await openPalette(page)
  await expect(option(page, "Restart service")).toHaveCount(1)
  await expect(option(page, "Restart root")).toHaveCount(1)
})

test("the box names itself and points at the list only while it shows", async ({ page }) => {
  const input = await openPalette(page)
  await expect(input).toHaveAccessibleName("Command palette")
  await expect(input).toHaveAttribute("aria-expanded", "true")
  await expect(input).toHaveAttribute("aria-activedescendant", /.+/)
  await input.fill("nothing like this")
  await expect(page.getByRole("option")).toHaveCount(0)
  await expect(input).toHaveAttribute("aria-expanded", "false")
  await expect(input).not.toHaveAttribute("aria-activedescendant", /.*/)
  await input.fill("Ask a name")
  await input.press("Enter")
  await expect(input).toHaveAccessibleName("Ask a name")
  await expect(input).toHaveAttribute("aria-expanded", "false")
  await expect(input).not.toHaveAttribute("aria-controls", /.*/)
  await expect(input).not.toHaveAttribute("aria-activedescendant", /.*/)
})

test("an open fetching mode asks the new fetcher when the commands change", async ({ page }) => {
  const input = await openPalette(page, "Live mode")
  await input.press("Enter")
  await expect(option(page, "Old row")).toBeVisible()
  await page.evaluate(() => window.swapFetcher?.())
  await expect(option(page, "New row")).toBeVisible()
  await expect(option(page, "Old row")).toHaveCount(0)
})

test("a javascript: href is neither a link nor followed", async ({ page }) => {
  const input = await openPalette(page, "Bad link")
  await expect(page.locator("[role=option]", { hasText: "Bad link" })).not.toHaveAttribute("href", /.*/)
  await input.press("Enter")
  expect(await page.evaluate(() => window.pwned)).toBeUndefined()
})
