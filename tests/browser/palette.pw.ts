import { expect, test } from "./fixtures"

async function open(page: import("@playwright/test").Page, query: string) {
  await page.getByRole("button", { name: "Open contextual palette", exact: true }).click()
  const input = page.getByRole("combobox").first()
  await input.fill(query)
  return input
}

test.beforeEach(async ({ page }) => { await page.goto("/tests/browser/?scenario=context-palette") })

for (const width of [1280, 390]) {
  test(`a discovered field edits the original model and owns its arrow keys at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const input = await open(page, "CPU")
    await input.press("Enter")
    const editor = page.getByRole("dialog").getByRole("spinbutton", { name: "CPU limit", exact: true })
    await expect(editor).toBeVisible()
    await expect(editor).toBeFocused()
    await editor.press("ArrowUp")
    await expect(editor).toHaveValue("5")
    await editor.press("Escape")
    await expect(input).toBeFocused()
    await input.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByRole("status", { name: "CPU value" })).toHaveText("5")
  })
}

test("discovery excludes secrets and removes unmounted page commands", async ({ page }) => {
  const input = await open(page, "API secret")
  await expect(page.getByRole("option")).toHaveCount(0)
  await input.fill("Inspect deployment")
  await expect(page.getByRole("option", { name: /Inspect deployment/ })).toBeVisible()
  await input.press("Escape")
  await page.getByRole("button", { name: "Toggle page tools", exact: true }).click()
  await open(page, "Inspect deployment")
  await expect(page.getByRole("option")).toHaveCount(0)
})

test("an input step validates before executing and keeps the query separate", async ({ page }) => {
  const input = await open(page, "Set allocation")
  await input.press("Enter")
  await expect(input).toHaveAttribute("placeholder", "CPU count, 1–128")
  await input.fill("0")
  await input.press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Enter a whole number from 1 to 128.")
  await input.fill("12")
  await input.press("Enter")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("status", { name: "CPU value" })).toHaveText("12")
})

test("a completed async action offers its declared undo", async ({ page }) => {
  const input = await open(page, "Create snapshot")
  await input.press("Enter")
  await input.press("Enter")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("status", { name: "Snapshot count" })).toHaveText("1")
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(page.getByRole("status", { name: "Snapshot count" })).toHaveText("0")
})

test("pins persist independently of recent history", async ({ page }) => {
  let input = await open(page, "Create snapshot")
  await input.press("Alt+p")
  await expect(page.getByRole("button", { name: "Unpin", exact: true })).toBeVisible()
  await input.press("Escape")
  await page.reload()
  input = await open(page, "")
  await expect(page.getByText("Pinned", { exact: true })).toBeVisible()
  await expect(page.getByRole("option", { name: /Create snapshot/ })).toHaveCount(1)
  await input.fill("Create snapshot")
  await page.getByRole("button", { name: "Unpin", exact: true }).click()
  await input.fill("")
  await expect(page.getByText("Pinned", { exact: true })).toHaveCount(0)
})

test("a pinned discovered field survives the page changing its commands", async ({ page }) => {
  let input = await open(page, "Region")
  await input.press("Alt+p")
  await expect(page.getByRole("button", { name: "Unpin", exact: true })).toBeVisible()
  await input.press("Escape")
  await page.getByRole("button", { name: "Toggle page tools", exact: true }).click()
  await page.reload()
  await page.getByRole("button", { name: "Toggle page tools", exact: true }).click()
  input = await open(page, "")
  await expect(page.getByText("Pinned", { exact: true })).toBeVisible()
  await expect(page.getByRole("option", { name: /^Region/ })).toHaveCount(1)
  await input.press("Enter")
  await expect(page.getByRole("dialog").getByRole("button", { name: "Region Europe", exact: true })).toBeVisible()
})

test("sigils expose providers and preview actions are clickable", async ({ page }) => {
  const input = await open(page, "@Ada")
  await expect(page.getByRole("option", { name: /Ada Lovelace/ })).toBeVisible()
  await page.getByRole("button", { name: "Copy user ID", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("status", { name: "Picked action" })).toHaveText("ada")
})

test("wrong-layout queries find page commands", async ({ page }) => {
  const input = await open(page, "dtnrb")
  await expect(page.getByRole("option", { name: /Ветки/ })).toBeVisible()
  await input.press("Enter")
  await expect(page.getByRole("status", { name: "Picked action" })).toHaveText("branches")
})

test("Theme edits a draft, supports revert and applies through the original studio", async ({ page }) => {
  const input = await open(page, "Theme")
  await input.press("Enter")
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Round", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Apply theme", exact: true })).toBeEnabled()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lp-context-palette-theme") ?? "{}").corners)).not.toBe("round")
  await dialog.getByRole("button", { name: "Revert draft", exact: true }).last().click()
  await expect(dialog.getByRole("button", { name: "Apply theme", exact: true })).toBeDisabled()
  await dialog.getByRole("button", { name: "Round", exact: true }).click()
  await dialog.getByRole("button", { name: "Apply theme", exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("lp-context-palette-theme") ?? "{}").corners)).toBe("round")
})

test("native page hints and lazy targets run after focus is released", async ({ page }) => {
  let input = await open(page, "Native page action")
  await input.press("Enter")
  await expect(page.getByRole("status", { name: "Picked action" })).toHaveText("native")
  input = await open(page, "Find deployment note")
  await input.press("Enter")
  await expect(page.getByRole("textbox", { name: "Deployment note", exact: true })).toBeFocused()
})

test("table rows reuse the original row actions", async ({ page }) => {
  const input = await open(page, "Services")
  await input.press("Enter")
  await input.fill("worker")
  await page.getByRole("button", { name: "Inspect worker", exact: true }).click()
  await expect(page.getByRole("status", { name: "Picked action" })).toHaveText("worker")
})

test("an editor's select popup keeps its keyboard interaction", async ({ page }) => {
  const input = await open(page, "Region")
  await input.press("Enter")
  const trigger = page.getByRole("dialog").getByRole("button", { name: "Region Europe", exact: true })
  await trigger.press("ArrowDown")
  await page.getByRole("option", { name: "America", exact: true }).click()
  await expect(page.getByRole("option", { name: "America", exact: true })).toHaveCount(0)
  await expect(page.getByRole("dialog").getByRole("button", { name: "Region America", exact: true })).toBeFocused()
  await page.keyboard.press("Escape")
  await input.press("Escape")
  await expect(page.getByRole("status", { name: "Region value" })).toHaveText("us")
})

test("a switch editor saves through its original action once", async ({ page }) => {
  const input = await open(page, "Service online")
  await input.press("Enter")
  const toggle = page.getByRole("dialog").getByRole("switch", { name: "Service online", exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-checked", "false")
  await expect(toggle).toBeEnabled()
  await toggle.press("Escape")
  await input.press("Escape")
  await expect(page.getByRole("status", { name: "Online saves" })).toHaveText("1")
})

test("manual commands override automatic capabilities by stable id", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=context-palette&mode=override")
  await open(page, "Custom processor")
  await expect(page.getByRole("option", { name: /Custom processor action/ })).toHaveCount(1)
  await expect(page.getByRole("option", { name: /CPU limit/ })).toHaveCount(0)
})

test("failed actions keep the palette open and report the error", async ({ page }) => {
  const input = await open(page, "Fail action")
  await input.press("Enter")
  await expect(page.getByRole("alert")).toHaveText("Service unavailable")
  await expect(input).toBeVisible()
})

test("an edited value invalidates an in-flight prompt validation", async ({ page }) => {
  const input = await open(page, "Set allocation")
  await input.press("Enter")
  await input.fill("8")
  await input.press("Enter")
  await input.fill("12")
  await expect(page.getByRole("button", { name: "Submit", exact: true })).not.toHaveAttribute("aria-busy", "true")
  await expect(input).toBeVisible()
  await expect(page.locator('output[aria-label="CPU value"]')).toHaveText("4")
  await input.press("Enter")
  await expect(page.getByRole("status", { name: "CPU value" })).toHaveText("12")
})

test("summary loading states retain their tile geometry", async ({ page }) => {
  const stats = page.locator(".lp-palette-stats")
  const before = await stats.boundingBox()
  await page.getByRole("switch", { name: "Loading summary", exact: true }).click()
  await expect(stats).not.toHaveAttribute("aria-busy", "true")
  const after = await stats.boundingBox()
  expect(after!.height).toBeCloseTo(before!.height, 0)
})

test("the site palette exposes Theme without hand-written theme commands", async ({ page }) => {
  await page.goto("/component/button")
  await page.getByRole("button", { name: "Search components, pages and themes", exact: true }).click()
  const input = page.getByRole("combobox").first()
  await input.fill("Theme")
  await page.getByRole("option", { name: /^Theme / }).first().click()
  await expect(page.getByRole("button", { name: "Apply theme", exact: true })).toBeVisible()
})

test("the palette shortcut works from a field inside the preview frame", async ({ page }) => {
  await page.goto("/component/context-palette")
  const frame = page.frameLocator("iframe").first()
  await frame.getByRole("textbox", { name: "Service name", exact: true }).press("Control+k")
  await expect(frame.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await frame.getByRole("combobox").first().press("Escape")
  await expect(frame.getByRole("dialog")).toHaveCount(0)
})

test("mouse-accessible actions also work on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, "@Ada")
  await page.getByRole("button", { name: "actions", exact: true }).click()
  await page.getByRole("option", { name: /Copy user ID/ }).click()
  await expect(page.getByRole("status", { name: "Picked action" })).toHaveText("ada")
})
