import { expect, test } from "./fixtures"

const visit = "/tests/browser/?scenario=linked-view"

test("picking a row selects the node and filters the log to it", async ({ page }) => {
  await page.goto(visit)
  const log = page.locator("[data-test=log]")
  await expect(log.getByText("db slow query")).toBeVisible()
  await page.locator("[data-test=table]").getByRole("checkbox").nth(1).click()
  await expect(page.getByRole("status", { name: "Selected" })).toHaveText("api")
  await expect(log.getByText("db slow query")).toHaveCount(0)
  await expect(log.getByText("api failed")).toBeVisible()
  await expect(page.locator("[data-test=graph] .vue-flow__node[data-id=api]")).toBeVisible()
})

test("clicking a graph node picks the table row", async ({ page }) => {
  await page.goto(visit)
  await page.locator("[data-test=graph] .vue-flow__node[data-id=db]").click()
  await expect(page.getByRole("status", { name: "Selected" })).toHaveText("db")
  await expect(page.locator("[data-test=table]").getByRole("checkbox").nth(2)).toBeChecked()
})

test("a picked log line becomes an annotation on the chart", async ({ page }) => {
  await page.goto(visit)
  await page.locator("[data-test=log]").getByText("db slow query").click()
  await expect(page.locator("[data-test=chart]").getByText("db slow query")).toBeVisible()
})

test("a trace id in the log is followed by the search", async ({ page }) => {
  await page.goto(visit)
  await page.locator("[data-test=log]").getByRole("button", { name: /abc123/ }).click()
  await expect(page.getByRole("status", { name: "Trace" })).toHaveText("abc123")
  await expect(page.locator("[data-test=log]").getByText("db slow query")).toHaveCount(0)
})

test("the shared time range narrows the log", async ({ page }) => {
  await page.goto(visit)
  const log = page.locator("[data-test=log]")
  await page.getByRole("button", { name: "Narrow time" }).click()
  await expect(log.getByText("api started")).toHaveCount(0)
  await expect(log.getByText("db slow query")).toBeVisible()
  await page.getByRole("button", { name: "Clear" }).click()
  await expect(log.getByText("api started")).toBeVisible()
})

test("picking a deployment opens the failed step and leaves the server views alone", async ({ page }) => {
  await page.goto(visit)
  const pipeline = page.locator("[data-test=pipeline]")
  await expect(pipeline.getByRole("button", { name: /Deploy/ })).toHaveAttribute("aria-expanded", "false")
  await page.getByRole("button", { name: "Pick deployment" }).click()
  await expect(pipeline.getByRole("button", { name: /Deploy/ })).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator("[data-test=log]").getByText("db slow query")).toBeVisible()
})
