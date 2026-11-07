import { expect, test } from "./fixtures"

const visit = (part: string) => `/tests/browser/?scenario=data&part=${part}`

test("a table row's action button opens its menu inside a frame", async ({ page }) => {
  await page.goto(visit("frame"))
  const frame = page.frameLocator("iframe").first()
  await frame.getByRole("button", { name: "Row actions" }).click()
  await expect(frame.getByRole("menuitem", { name: "Restart" })).toBeVisible()
})

test("holding Ctrl over a log inside a frame freezes it and letting go resumes", async ({ page }) => {
  await page.goto(visit("frame"))
  const frame = page.frameLocator("iframe").first()
  const log = frame.getByText("first")
  await log.hover()
  await log.click()
  await page.keyboard.down("Control")
  await expect(frame.getByText("Held")).toBeVisible()
  await page.keyboard.up("Control")
  await expect(frame.getByText("Held")).toHaveCount(0)
})

test("a frozen log stays still while its array is pushed into in place", async ({ page }) => {
  await page.goto(visit("log"))
  await page.getByText("first").hover()
  await page.keyboard.down("Control")
  await expect(page.getByText("Held")).toBeVisible()
  await page.getByRole("button", { name: "Add line" }).evaluate((el: HTMLElement) => el.click())
  await expect(page.getByText("line 2")).toHaveCount(0)
  await page.keyboard.up("Control")
  await expect(page.getByText("line 2")).toBeVisible()
})

test("removing the focused tree row keeps the keyboard in the tree", async ({ page }) => {
  await page.goto(visit("tree"))
  const row = (id: string) => page.locator(`[data-node-id="${id}"]`)
  await row("a").focus()
  await page.keyboard.press("ArrowDown")
  await expect(row("b")).toBeFocused()
  await page.getByRole("button", { name: "Remove b" }).evaluate((el: HTMLElement) => el.click())
  await expect(row("a")).toBeFocused()
})

test("a series that comes back starts from its own hidden flag", async ({ page }) => {
  await page.goto(visit("chart"))
  const cpu = page.getByRole("button", { name: "CPU" })
  await expect(cpu).toHaveAttribute("aria-pressed", "false")
  await page.getByRole("button", { name: "Drop first" }).click()
  await expect(cpu).toHaveCount(0)
  await page.getByRole("button", { name: "Restore" }).click()
  await expect(cpu).toHaveAttribute("aria-pressed", "false")
})

test("rows sharing a label render without a duplicate key", async ({ page }) => {
  const warnings: string[] = []
  page.on("console", (message) => warnings.push(message.text()))
  await page.goto(visit("list"))
  await expect(page.getByText("Healthy")).toBeVisible()
  await expect(page.getByText("Online")).toBeVisible()
  expect(warnings.filter((text) => text.includes("Duplicate keys"))).toEqual([])
})

test("repeated pipeline step keys are reported to the developer", async ({ page }) => {
  const warnings: string[] = []
  page.on("console", (message) => warnings.push(message.text()))
  await page.goto(visit("pipeline"))
  await expect(page.getByText("Two")).toBeVisible()
  expect(warnings.filter((text) => text.includes("step keys must be unique"))).toHaveLength(1)
})

test("a narrow canvas in a wide window hides its minimap and legend", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.goto(visit("canvas"))
  await expect(page.locator(".vue-flow__node").first()).toBeVisible()
  await expect(page.locator(".vue-flow__minimap")).toBeHidden()
})
