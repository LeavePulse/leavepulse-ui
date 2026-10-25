import { expect, test } from "./fixtures"

test("chart data table stays accessible without painting over its title", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=chart")
  const table = page.getByRole("table", { name: "Thresholds and markers", exact: true })
  await expect(table).toBeAttached()
  await expect(table.getByRole("cell", { name: "60", exact: true })).toBeAttached()
  const clipping = await table.evaluate((el) => {
    const parent = el.parentElement!
    return { width: parent.clientWidth, height: parent.clientHeight, overflow: getComputedStyle(parent).overflow }
  })
  expect(clipping).toEqual({ width: 1, height: 1, overflow: "hidden" })
})

for (const reduced of [false, true]) {
  test(`repeater preserves focus and nested row identity with reduced motion ${reduced}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" })
    await page.goto("/tests/browser/?scenario=repeater&mode=nested")
    const second = page.getByRole("textbox", { name: "Row 2", exact: true })
    await second.evaluate((el) => el.setAttribute("data-identity", "second"))
    await page.getByRole("button", { name: "Remove item 1", exact: true }).click()
    const survivor = page.getByRole("textbox", { name: "Row 1", exact: true })
    await expect(survivor).toHaveValue("Second")
    await expect(survivor).toHaveAttribute("data-identity", "second")
    await expect(survivor).toBeFocused()
    await page.evaluate(() => {
      document.documentElement.dataset.rowMotion = ""
      document.addEventListener("transitionrun", (event) => {
        if ((event.target as Element).hasAttribute("data-lp-repeater-row")) document.documentElement.dataset.rowMotion = "running"
      })
    })
    await page.getByRole("button", { name: "Add item", exact: true }).click()
    await expect(page.getByRole("textbox", { name: "Row 2", exact: true })).toBeFocused()
    await expect(page.getByRole("textbox", { name: "Child", exact: true })).toHaveValue("Second child")
    if (!reduced) {
      await expect(page.locator("html")).toHaveAttribute("data-row-motion", "running")
    }
  })
}

for (const kind of ["context", "dropdown"]) {
  test(`${kind} submenu stays in its frame and accepts pointer selection`, async ({ page }) => {
    await page.goto("/tests/browser/?scenario=frame")
    const frame = page.frameLocator("iframe")
    if (kind === "context") await frame.getByRole("button", { name: "Context target", exact: true }).click({ button: "right" })
    else await frame.getByRole("button", { name: "Frame actions", exact: true }).click()
    await frame.getByRole("menuitem", { name: "Move to", exact: true }).hover()
    const production = frame.getByRole("menuitem", { name: "Production", exact: true })
    await expect(production).toBeVisible()
    await expect(page.getByRole("menuitem", { name: "Production", exact: true })).toHaveCount(0)
    await production.hover()
    await frame.getByRole("menuitem", { name: "Staging", exact: true }).hover()
    await production.click()
    await expect(frame.getByRole("status", { name: "Picked environment" })).toHaveText("Production")
    await expect(frame.getByRole("menu")).toHaveCount(0)
  })
}

for (const control of ["Frame actions", "Frame popover", "Frame select"]) {
  test(`${control} closes on the second pointer press inside a frame`, async ({ page }) => {
    await page.goto("/tests/browser/?scenario=frame")
    const frame = page.frameLocator("iframe")
    const trigger = frame.locator(`button[aria-label="${control}"]`).first()
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await trigger.click()
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
  })
}

test("reloading preview tabs keeps the controls and next row in place", async ({ page }) => {
  await page.goto("/component/tabs")
  const frame = page.frameLocator("iframe").first()
  const reload = frame.getByRole("button", { name: "Reload items", exact: true })
  await expect(reload).not.toHaveAttribute("aria-busy", "true")
  const nextRow = frame.getByRole("tab", { name: "Overview", exact: true }).first()
  const before = await nextRow.evaluate(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y }))
  const controlBefore = await reload.evaluate(el => el.getBoundingClientRect().x)
  await reload.click()
  await expect(reload).toHaveAttribute("aria-busy", "true")
  const during = await nextRow.evaluate(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y }))
  const controlDuring = await reload.evaluate(el => el.getBoundingClientRect().x)
  expect(during.y).toBeCloseTo(before.y, 0)
  expect(controlDuring).toBeCloseTo(controlBefore, 0)
  await expect(reload).not.toHaveAttribute("aria-busy", "true")
})
