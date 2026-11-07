import { expect, settledBox, test } from "./fixtures"

const visit = "/tests/browser/?scenario=chart-toolkit"

test("a long series is thinned to the width and its spike stays on the plot", async ({ page }) => {
  await page.goto(visit)
  await expect(page.getByText("Spike", { exact: true })).toBeVisible()
  const d = await page.locator("[data-test=big] svg path[fill=none]").first().getAttribute("d")
  const points = (d ?? "").split(/[ML]/).length - 1
  expect(points).toBeGreaterThan(100)
  expect(points).toBeLessThan(1_000)
  const ticks = await page.locator("[data-test=big] svg text").allTextContents()
  expect(ticks.some((t) => t.includes("1k"))).toBe(true)
})

test("dragging across the plot zooms, and the button shows everything again", async ({ page }) => {
  await page.goto(visit)
  const svg = page.locator("[data-test=big] svg").first()
  const box = await settledBox(svg)
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + 100, y)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, y, { steps: 4 })
  await expect(page.locator("[data-lp-chart-selection]")).toBeVisible()
  await page.mouse.up()
  await expect(page.getByRole("status", { name: "Range" })).not.toHaveText("all")
  await expect(page.getByRole("status", { name: "Clicked" })).toHaveText("none")
  await page.getByRole("button", { name: "Show all" }).click()
  await expect(page.getByRole("status", { name: "Range" })).toHaveText("all")
})

test("the overview's edges are sliders that move the window from the keyboard", async ({ page }) => {
  await page.goto(visit)
  await page.getByRole("button", { name: "Set range" }).click()
  const start = page.getByRole("slider", { name: "Start of the range" })
  await expect(start).toHaveAttribute("aria-valuenow", "3000")
  await expect(start).toHaveAttribute("aria-valuetext", "t3000")
  await start.focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("status", { name: "Range" })).toHaveText("3001-3400")
})

test("dragging the overview's window pans it and keeps its width", async ({ page }) => {
  await page.goto(visit)
  await page.getByRole("button", { name: "Set range" }).click()
  const box = (await page.locator("[data-lp-chart-window]").boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 50, y, { steps: 3 })
  await page.mouse.up()
  const [start, end] = (await page.getByRole("status", { name: "Range" }).textContent())!.split("-").map(Number)
  expect(start).toBeLessThan(3000)
  expect(end - start).toBe(400)
})

test("a point click reports the index in the data, and the keys zoom", async ({ page }) => {
  await page.goto(visit)
  await page.getByRole("button", { name: "Set range" }).click()
  const svg = page.locator("[data-test=big] svg").first()
  const box = (await svg.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const index = Number(await page.getByRole("status", { name: "Clicked" }).textContent())
  expect(index).toBeGreaterThanOrEqual(3000)
  expect(index).toBeLessThanOrEqual(3400)
  await page.locator("[data-test=big] [role=group]").focus()
  await page.keyboard.press("0")
  await expect(page.getByRole("status", { name: "Range" })).toHaveText("all")
})

test("the window narrows the drawing and the export still holds all the data", async ({ page }) => {
  await page.goto(visit)
  await page.getByRole("button", { name: "Set range" }).click()
  await expect(page.getByText("Maintenance", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Export" }).click()
  await expect(page.getByRole("status", { name: "Csv lines" })).toHaveText("5001")
})

test("hovering one chart marks the same label in the other of its group", async ({ page }) => {
  await page.goto(visit)
  const second = page.locator("[data-test=second] svg").first()
  await expect(second.locator("circle")).toHaveCount(0)
  await page.locator("[data-test=first] svg").first().hover()
  await expect(second.locator("circle")).toHaveCount(1)
  await page.mouse.move(0, 0)
  await expect(second.locator("circle")).toHaveCount(0)
})
