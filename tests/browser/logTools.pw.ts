import { expect, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/?scenario=log-tools")
  await expect(page.locator("[data-log-row]")).toHaveCount(4)
})

test("a regular expression filters, and a broken one says so without failing", async ({ page }) => {
  await page.getByRole("button", { name: "Regular expression" }).click()
  const search = page.getByRole("searchbox", { name: "Search logs" })
  await search.fill("job 4[12]")
  await expect(page.locator("[data-log-row]")).toHaveCount(2)
  await search.fill("(")
  await expect(page.getByText("Invalid pattern")).toBeVisible()
})

test("source chips, time range and repeats narrow the stream", async ({ page }) => {
  await page.getByRole("group", { name: "Sources" }).getByRole("button", { name: "db" }).click()
  await expect(page.locator("[data-log-row]")).toHaveCount(1)
  await page.getByRole("group", { name: "Sources" }).getByRole("button", { name: "db" }).click()
  await page.getByRole("button", { name: "Toggle range" }).click()
  await expect(page.locator("[data-log-row]")).toHaveCount(2)
  await page.getByRole("button", { name: "Toggle range" }).click()
  await page.getByRole("button", { name: "Group repeats" }).click()
  await expect(page.locator("[data-log-row]")).toHaveCount(3)
  await expect(page.getByText("×2")).toBeVisible()
})

test("selecting a line reports it, ranges with Shift and opens the inspector", async ({ page }) => {
  await page.locator('[data-log-row="3"]').click({ position: { x: 4, y: 4 } })
  await expect(page.getByRole("status", { name: "Picked" })).toContainText("trace_id")
  await expect(page.getByRole("region", { name: "Log entry" }).getByRole("listitem").filter({ hasText: "id:" }).first()).toBeVisible()
  await page.getByRole("region", { name: "Log entry" }).getByRole("searchbox").fill("trace")
  await expect(page.getByRole("region", { name: "Log entry" }).getByRole("listitem")).toHaveCount(1)
  await page.locator('[data-log-row="1"]').click({ position: { x: 4, y: 4 }, modifiers: ["Shift"] })
  await expect(page.getByRole("status", { name: "Selection" })).toHaveText("1-3")
})

test("an id in a message is a button, and does not select the line", async ({ page }) => {
  await page.getByRole("button", { name: "abc123" }).click()
  await expect(page.getByRole("status", { name: "Id" })).toHaveText("trace:abc123")
  await expect(page.getByRole("status", { name: "Picked" })).toHaveText("")
})

test("jumping by time selects the closest line, and a download carries what is shown", async ({ page }) => {
  await page.getByRole("button", { name: "Jump" }).click()
  await expect(page.getByRole("status", { name: "Selection" })).toHaveText("2-2")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download" }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe("logs.log")
})
