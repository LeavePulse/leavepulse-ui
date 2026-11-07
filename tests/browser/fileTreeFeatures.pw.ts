import { expect, test } from "./fixtures"

const visit = (part: string) => `/tests/browser/?scenario=file-tree&part=${part}`
const row = (id: string) => `[data-node-id="${id}"]`

test("a tree with none of the options renders as it did", async ({ page }) => {
  await page.goto(visit("plain"))
  await expect(page.getByRole("treeitem").first()).toBeVisible()
  await expect(page.getByRole("searchbox")).toHaveCount(0)
  await expect(page.locator("[draggable]")).toHaveCount(0)
  await expect(page.locator("[aria-setsize]")).toHaveCount(0)
  await page.locator(row("src")).click()
  await expect(page.getByRole("group").first()).toBeVisible()
})

test("search narrows to the match, keeps the field when nothing matches, and clears", async ({ page }) => {
  await page.goto(visit("full"))
  const search = page.getByRole("searchbox")
  await search.fill("b.png")
  await expect(page.getByText("b.png")).toBeVisible()
  await expect(page.getByText("a.ts")).toHaveCount(0)
  await search.fill("nothing")
  await expect(page.getByText("No matching files")).toBeVisible()
  await expect(search).toBeVisible()
  await search.fill("")
  await expect(page.getByText("a.ts")).toBeVisible()
})

test("the breadcrumb follows the selection and steps back to a folder", async ({ page }) => {
  await page.goto(visit("full"))
  await page.getByText("guide.md").click()
  const path = page.getByRole("navigation", { name: "Path" })
  await expect(path.getByText("guide.md")).toBeVisible()
  await path.getByRole("button", { name: "docs" }).click()
  await expect(path.getByText("guide.md")).toHaveCount(0)
})

test("a loaded folder shows its children, and closing it first aborts the fetch", async ({ page }) => {
  await page.goto(visit("full"))
  await page.locator(row("lazy")).click()
  await expect(page.getByText("late.txt")).toBeVisible()

  await page.goto(visit("full"))
  await page.locator(row("lazy")).click()
  await page.locator(row("lazy")).click()
  await expect(page.getByRole("status", { name: "Report" })).toContainText("aborted lazy")
  await page.locator(row("lazy")).click()
  await expect(page.getByText("late.txt")).toBeVisible()
})

test("Ctrl and Shift pick rows, and the pick outlives its folder closing", async ({ page }) => {
  await page.goto(visit("full"))
  await page.getByText("a.ts").click()
  await page.getByText("b.png").click({ modifiers: ["Shift"] })
  await page.getByText("guide.md").click({ modifiers: ["Control"] })
  const report = page.getByRole("status", { name: "Report" })
  await expect(report).toContainText('"selection":["src/a.ts","src/b.png","docs/guide.md"]')
  await page.locator(`${row("src")} > span`).first().click()
  await expect(page.locator(row("src/a.ts"))).toBeHidden()
  await expect(report).toContainText('"selection":["src/a.ts","src/b.png","docs/guide.md"]')
})

test("Shift and the arrows extend the pick", async ({ page }) => {
  await page.goto(visit("full"))
  await page.getByText("a.ts").click()
  await page.keyboard.press("Shift+ArrowDown")
  await expect(page.getByRole("status", { name: "Report" })).toContainText('"selection":["src/a.ts","src/b.png"]')
})

test("F2 renames in place: Enter commits, Escape cancels, a taken name stays open", async ({ page }) => {
  await page.goto(visit("full"))
  await page.getByText("a.ts").click()
  await page.keyboard.press("F2")
  const field = page.getByRole("textbox", { name: "Rename" })
  await expect(field).toBeFocused()
  await expect(field).toHaveValue("a.ts")
  await page.keyboard.press("Escape")
  await expect(field).toHaveCount(0)
  await expect(page.locator('[data-node-id="src/a.ts"]')).toBeFocused()

  await page.keyboard.press("F2")
  await field.fill("b.png")
  await page.keyboard.press("Enter")
  await expect(field).toHaveAttribute("aria-invalid", "true")

  await field.fill("c.ts")
  await page.keyboard.press("Enter")
  await expect(field).toHaveCount(0)
  await expect(page.getByRole("status", { name: "Report" })).toContainText("rename src/a.ts to c.ts")
  await expect(page.locator('[data-node-id="src/a.ts"]')).toBeFocused()
})

test("a row dropped on a folder asks the app to move it", async ({ page }) => {
  await page.goto(visit("full"))
  await page.locator('[data-node-id="src/a.ts"]').dragTo(page.locator('[data-node-id="docs"]'))
  await expect(page.getByRole("status", { name: "Report" })).toContainText("move src/a.ts to docs")
})

test("a virtual tree mounts a window, states each row's place and keeps the tab stop", async ({ page }) => {
  await page.goto(visit("virtual"))
  await expect(page.getByText("file-0", { exact: true })).toBeVisible()
  expect(await page.getByRole("treeitem").count()).toBeLessThan(60)
  const first = page.locator('[role="treeitem"]:has([data-node-id="big/0"])')
  await expect(first).toHaveAttribute("aria-setsize", "5000")
  await expect(first).toHaveAttribute("aria-posinset", "1")
  await expect(first).toHaveAttribute("aria-level", "2")

  await page.locator('[data-node-id="big"]').focus()
  await page.keyboard.press("End")
  const last = page.locator('[data-node-id="big/4999"]')
  await expect(last).toBeFocused()
  await expect(last).toBeInViewport()

  await page.keyboard.press("Home")
  await expect(page.locator('[data-node-id="big"]')).toBeFocused()
  await page.locator(".lp-scroll-area__viewport, [data-reka-scroll-area-viewport]").first().evaluate((el) => (el.scrollTop = 40000))
  await expect(page.locator('[tabindex="0"][data-node-id="big"]')).toBeAttached()
})
