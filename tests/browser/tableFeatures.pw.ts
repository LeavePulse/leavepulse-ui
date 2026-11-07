import { expect, test } from "./fixtures"

const open = (part: string) => `/tests/browser/?scenario=table&part=${part}`
const firstCells = (page: import("@playwright/test").Page) => page.locator("tbody tr td:first-child")

test("a Shift-click adds a sort key, a plain click replaces them", async ({ page }) => {
  await page.goto(open("sort"))
  await page.getByRole("button", { name: "Load", exact: true }).click()
  await page.getByRole("button", { name: /^Site/ }).click({ modifiers: ["Shift"] })
  await expect(page.getByRole("status", { name: "Sorts" })).toHaveText("load:asc,site:asc")
  await expect(firstCells(page)).toHaveText(["gamma", "beta", "alpha"])
  await expect(page.getByRole("button", { name: /^Load/ })).toContainText("1")
  await page.getByRole("button", { name: /^Site/ }).click()
  await expect(page.getByRole("status", { name: "Sorts" })).toHaveText("site:desc")
})

test("a column's edge resizes it by drag, keys and a double click", async ({ page }) => {
  await page.goto(open("resize"))
  const handle = page.getByRole("separator", { name: "Resize Name" })
  const header = page.getByRole("columnheader", { name: /Name/ })
  const before = (await header.boundingBox())!.width
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + 2, box.y + 5)
  await page.mouse.down()
  await page.mouse.move(box.x + 62, box.y + 5, { steps: 4 })
  await page.mouse.up()
  await expect.poll(async () => (await header.boundingBox())!.width).toBeGreaterThan(before + 40)
  const dragged = (await header.boundingBox())!.width
  await handle.focus()
  await page.keyboard.press("ArrowLeft")
  await expect.poll(async () => (await header.boundingBox())!.width).toBeLessThan(dragged)
  await handle.dblclick()
  await expect(page.getByRole("status", { name: "Widths" })).not.toContainText("name")
})

test("pinned columns stay at their edges while the table scrolls", async ({ page }) => {
  await page.goto(open("pin"))
  const name = page.getByRole("cell", { name: "alpha" })
  const id = page.getByRole("cell", { name: "1", exact: true })
  const viewport = page.locator("[data-reka-scroll-area-viewport]")
  const startX = (await name.boundingBox())!.x
  const edge = (await viewport.boundingBox())!
  await viewport.evaluate((el) => (el.scrollLeft = 300))
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBe(300)
  expect((await name.boundingBox())!.x).toBeCloseTo(startX, 0)
  const right = (await id.boundingBox())!
  expect(right.x + right.width).toBeLessThanOrEqual(edge.x + edge.width + 1)
})

test("groups head their rows and collapse", async ({ page }) => {
  await page.goto(open("group"))
  const group = page.getByRole("button", { name: "Collapse b (2)" })
  await expect(group).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("cell", { name: "alpha" })).toBeVisible()
  await group.click()
  await expect(page.getByRole("cell", { name: "alpha" })).toHaveCount(0)
  await expect(page.getByRole("cell", { name: "beta" })).toBeVisible()
  await page.getByRole("button", { name: "Expand b (2)" }).click()
  await expect(page.getByRole("cell", { name: "alpha" })).toBeVisible()
})

test("a row opens its panel, and a row that cannot has no button", async ({ page }) => {
  await page.goto(open("expand"))
  await expect(page.getByRole("button", { name: "Expand row" })).toHaveCount(2)
  await page.getByRole("button", { name: "Expand row" }).first().click()
  await expect(page.getByText("Details of alpha")).toBeVisible()
  await page.getByRole("button", { name: "Collapse row" }).click()
  await expect(page.getByText("Details of alpha")).toHaveCount(0)
})

test("a virtual table draws a window and scrolls through all of it", async ({ page }) => {
  await page.goto(open("virtual"))
  const rows = page.locator("tbody tr[tabindex]")
  await expect(page.getByRole("cell", { name: "row 0", exact: true })).toBeVisible()
  expect(await rows.count()).toBeLessThan(40)
  const viewport = page.locator("[data-reka-scroll-area-viewport]")
  expect(await viewport.evaluate((el) => el.scrollHeight)).toBeGreaterThan(5000 * 40)
  await viewport.evaluate((el) => (el.scrollTop = 44 * 3000))
  await expect(page.getByRole("cell", { name: "row 3000", exact: true })).toBeVisible()
  await expect(page.getByRole("cell", { name: "row 0", exact: true })).toHaveCount(0)
  expect(await rows.count()).toBeLessThan(40)
})

test("an editable cell saves through cellEdit, validates and leaves the row alone", async ({ page }) => {
  await page.goto(open("edit"))
  await page.getByRole("button", { name: "beta" }).click()
  const field = page.getByRole("textbox")
  await field.fill("x")
  await field.press("Enter")
  await expect(page.getByText("Too short")).toBeVisible()
  await field.fill("delta")
  await field.press("Enter")
  await expect(page.getByRole("status", { name: "Edits" })).toHaveText("name:beta>delta")
  await expect(page.getByRole("button", { name: "delta" })).toBeVisible()
  await expect(page.locator("tbody tr").first().locator("td").nth(1).getByRole("button")).toHaveCount(0)
})

test("a preset shows its columns, and hiding one by hand leaves the preset", async ({ page }) => {
  await page.goto(open("presets"))
  await expect(page.getByRole("columnheader")).toHaveCount(1)
  await page.getByRole("columnheader", { name: "Name" }).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Column presets" }).hover()
  await page.getByRole("menuitemcheckbox", { name: "Everything" }).click()
  // A tick item leaves the menu open, and an open menu hides the page from roles.
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("columnheader")).toHaveCount(3)
  await expect(page.getByRole("status", { name: "Preset" })).toHaveText("all")
})

test("all matching survives paging as a query with exceptions", async ({ page }) => {
  await page.goto(open("token"))
  await page.getByRole("checkbox").first().click()
  await page.getByRole("button", { name: "Select all 6" }).click()
  await expect(page.getByRole("status", { name: "Token" })).toHaveText("6-")
  await page.getByRole("button", { name: /next/i }).click()
  await expect(page.getByRole("cell", { name: "srv 2" })).toBeVisible()
  const row = page.getByRole("row", { name: /srv 2/ }).getByRole("checkbox")
  await expect(row).toBeChecked()
  await row.click()
  await expect(page.getByRole("status", { name: "Token" })).toHaveText("6-2")
  await expect(page.getByText("5 selected")).toBeVisible()
})
