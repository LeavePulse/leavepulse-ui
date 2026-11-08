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

test("streamed batches show before the last, and the highlight stays put as rows arrive", async ({ page }) => {
  const input = await openPalette(page, "Streamed mode")
  await input.press("Enter")
  await expect(option(page, "Fast one")).toBeVisible()
  // Still going: the bar under the box says so.
  await expect(page.getByRole("status").filter({ hasText: "Searching…" })).toHaveCount(1)
  await input.press("ArrowDown")
  await expect(option(page, "Fast two")).toHaveAttribute("aria-selected", "true")
  await page.evaluate(() => window.releaseSlow?.())
  await expect(option(page, "Slow row")).toBeVisible()
  await expect(option(page, "Fast two")).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("status").filter({ hasText: "Searching…" })).toHaveCount(0)
})

test("a row under a still pointer keeps the highlight when a batch inserts rows above it", async ({ page }) => {
  const input = await openPalette(page, "Streamed mode")
  await input.press("Enter")
  const fastOne = option(page, "Fast one")
  await expect(fastOne).toBeVisible()
  const box = (await fastOne.boundingBox())!
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await expect(fastOne).toHaveAttribute("aria-selected", "true")
  await page.evaluate(() => window.releaseSlow?.())
  await expect(option(page, "Slow row")).toBeVisible()
  await expect(fastOne).toHaveAttribute("aria-selected", "true")
})

test("a failure after some batches keeps them, says the rest is missing, and leaving closes the stream", async ({ page }) => {
  const input = await openPalette(page, "Streamed mode")
  await input.press("Enter")
  await expect(option(page, "Fast one")).toBeVisible()
  await page.evaluate(() => window.releaseSlow?.(true))
  await expect(page.getByText("Some results could not be loaded.")).toBeVisible()
  await expect(option(page, "Fast one")).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await expect(option(page, "Fast one")).toBeVisible()
  await expect(page.getByText("Some results could not be loaded.")).toHaveCount(0)
  await input.press("Backspace")
  await expect(option(page, "Streamed mode")).toBeVisible()
  // The generator is parked in an await; it is closed at its next yield, and
  // that batch never reaches the list.
  await page.evaluate(() => window.releaseSlow?.())
  await expect.poll(() => page.evaluate(() => window.streamClosed)).toBe(true)
  await expect(option(page, "Slow row")).toHaveCount(0)
})
