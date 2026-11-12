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

test("the page's toolbar, the row count and Export share one line above the table", async ({ page }) => {
  await page.goto(open("toolbar"))
  const search = page.getByRole("textbox", { name: "Page search" })
  const exportButton = page.getByRole("button", { name: "Export CSV" })
  await expect(search).toBeVisible()
  await expect(exportButton).toBeVisible()
  const a = (await search.boundingBox())!
  const b = (await exportButton.boundingBox())!
  // One row: their vertical centres agree, and Export sits to the right.
  expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThan(6)
  expect(b.x).toBeGreaterThan(a.x + a.width)
})

test("a table that loses rows to a filter eases its height instead of snapping", async ({ page }) => {
  await page.goto(open("shrink"))
  await expect(page.locator("tbody tr")).toHaveCount(3)
  // Every frame's height from the click until the motion is over: a snap is
  // two values (before, after); an eased box passes through the ones between.
  const heights = await page.evaluate(async () => {
    const box = document.querySelector("table")!.closest(".rounded-card")!.parentElement as HTMLElement
    const seen: number[] = []
    ;(document.querySelector("button") as HTMLButtonElement).click()
    const end = performance.now() + 900
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame)
      seen.push(Math.round(box.getBoundingClientRect().height))
    }
    return seen
  })
  await expect(page.locator("tbody tr")).toHaveCount(1)
  const first = heights[0]!
  const last = heights.at(-1)!
  expect(last).toBeLessThan(first)
  expect(heights.filter((h) => h < first && h > last).length).toBeGreaterThan(2)
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

test("cards draw the rows from the columns and keep sort, filter, menu, click and selection", async ({ page }) => {
  await page.goto(open("layouts"))
  const cards = page.locator(".lp-item")
  await expect(cards).toHaveCount(3)
  // The cell slot draws the field in a card too.
  await expect(cards.first()).toContainText("load 2")
  await expect(page.locator("table")).toHaveCount(0)
  // No header, so the sort is in the bar.
  await page.getByRole("button", { name: "Sort" }).click()
  await page.getByRole("menuitemradio", { name: "Load" }).click()
  await expect(cards.locator(".font-medium")).toHaveText(["gamma", "alpha", "beta"])
  await page.getByRole("button", { name: "Sort" }).click()
  await page.getByRole("menuitemradio", { name: "Sort descending" }).click()
  await expect(cards.first()).toContainText("alpha")
  // The column funnel too.
  await page.getByRole("button", { name: "Filter Site" }).click()
  await page.getByRole("checkbox", { name: /^a/ }).click()
  await page.keyboard.press("Escape")
  await expect(cards).toHaveCount(2)
  await page.getByRole("button", { name: "Clear the Site filter" }).click()
  await expect(cards).toHaveCount(3)
  await cards.filter({ hasText: "beta" }).click()
  await expect(page.getByRole("status", { name: "Clicked" })).toHaveText("click:beta")
  await cards.filter({ hasText: "alpha" }).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Open alpha" }).click()
  await expect(page.getByRole("status", { name: "Clicked" })).toHaveText("menu:alpha")
  await cards.filter({ hasText: "gamma" }).getByRole("checkbox").click()
  await expect(page.getByRole("status", { name: "Picked" })).toHaveText("3")
})

test("the layout switch changes the drawing and is remembered", async ({ page }) => {
  await page.goto(open("layouts"))
  await page.getByRole("button", { name: "List", exact: true }).click()
  await expect(page.getByRole("status", { name: "Layout" })).toHaveText("list")
  await expect(page.locator(".lp-item")).toHaveCount(3)
  await page.getByRole("button", { name: "Table", exact: true }).click()
  await expect(page.locator("tbody tr")).toHaveCount(3)
  await page.reload()
  await expect(page.getByRole("status", { name: "Layout" })).toHaveText("table")
  await expect(page.locator("tbody tr")).toHaveCount(3)
})

test("a table narrower than layoutBelow is drawn as a list", async ({ page }) => {
  await page.goto(open("narrow"))
  await expect(page.locator("table")).toHaveCount(0)
  await expect(page.locator(".lp-item")).toHaveCount(3)
  await expect(page.locator(".lp-item").first()).toContainText("alpha")
  // The switch would change nothing while the width forces a list.
  await expect(page.getByRole("group", { name: "View" })).toHaveCount(0)
})

test("every header reads in the same case, sortable or not", async ({ page }) => {
  await page.goto(open("sort"))
  const transform = await page.getByRole("button", { name: /^Name/ }).evaluate((el) => getComputedStyle(el).textTransform)
  expect(transform).toBe("uppercase")
})

test("a plain table has no frame of its own", async ({ page }) => {
  await page.goto(open("plain"))
  const border = await page.locator("[data-reka-scroll-area-viewport]").evaluate((el) => getComputedStyle(el.parentElement!).borderTopWidth)
  expect(border).toBe("0px")
})

test("a held list line starts selection and only then opens room for the ticks", async ({ page }) => {
  await page.goto(open("hold-list"))
  const title = page.locator(".lp-item .font-medium").first()
  const line = page.locator(".lp-item").first()
  const startX = (await title.boundingBox())!.x
  const lineX = (await line.boundingBox())!.x
  expect(startX - lineX).toBeLessThan(20)
  const box = (await line.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(600)
  await page.mouse.up()
  await expect(page.getByRole("status", { name: "Picked" })).toHaveText("1")
  await expect.poll(async () => (await title.boundingBox())!.x).toBeGreaterThan(startX + 16)
})

test("a card of one's own fills the frame edge to edge and keeps the table's click and menu", async ({ page }) => {
  await page.goto(open("own-card"))
  const own = page.locator(".own-card").first()
  await expect(own).toHaveText("alpha on b")
  const inner = (await own.boundingBox())!
  const frame = (await page.locator(".lp-item").first().boundingBox())!
  expect(inner.x - frame.x).toBeLessThan(2)
  await own.click()
  await expect(page.getByRole("status", { name: "Clicked" })).toHaveText("click:alpha")
  await own.click({ button: "right" })
  await page.getByRole("menuitem", { name: "Open alpha" }).click()
  await expect(page.getByRole("status", { name: "Clicked" })).toHaveText("menu:alpha")
})

test("a line of one's own replaces the built line of a narrow table and keeps its click and menu", async ({ page }) => {
  await page.goto(open("own-line"))
  const own = page.locator(".own-line")
  await expect(own).toHaveCount(3)
  await expect(own.first()).toHaveText("alpha on b")
  // The built line is gone, not drawn beside the own one.
  await expect(page.locator(".lp-item .font-medium")).toHaveCount(0)
  await own.first().click()
  await expect(page.getByRole("status", { name: "Clicked" })).toHaveText("click:alpha")
  await own.first().click({ button: "right" })
  await page.getByRole("menuitem", { name: "Open alpha" }).click()
  await expect(page.getByRole("status", { name: "Clicked" })).toHaveText("menu:alpha")
})

test("a list line names the figures it is told to, leaves out what it is told to, and dots only what is there", async ({ page }) => {
  await page.goto(open("line-columns"))
  const line = (name: string) => page.locator(".lp-item").filter({ hasText: name })
  const shown = (name: string) =>
    line(name)
      .locator(".lp-line-field")
      .evaluateAll((els) => els.filter((el) => getComputedStyle(el).display !== "none").map((el) => ((el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim()))
  // "label" prefixes the label; false leaves the column out of the line.
  expect(await shown("alpha")).toEqual(["top alpha bottom", "only alpha", "b", "Load 2"])
  await expect(line("alpha").getByRole("button", { name: "Act" })).toHaveCount(0)
  // A cell that drew nothing takes no place and no dot; a column can leave a
  // row out by itself (beta's site is "a").
  expect(await shown("beta")).toEqual(["top beta bottom", "Load 2"])
  // The dot before the first fact sits outside the clip box.
  const box = (await line("beta").locator(".lp-line").boundingBox())!
  const first = (await line("beta").locator(".lp-line-field").first().boundingBox())!
  expect(first.x).toBeLessThan(box.x)
  // A cell that draws blocks starts after its dot, inside the clip box, not
  // under it (the dot used to push block content to a line of its own).
  const block = (await line("beta").locator(".block-cell").boundingBox())!
  expect(block.x).toBeGreaterThanOrEqual(box.x)
})
