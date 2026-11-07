import { expect, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/?scenario=fields")
})

test("a consumer's aria-describedby survives on every kind of field", async ({ page }) => {
  await expect(page.getByLabel("Bare described")).toHaveAttribute("aria-describedby", "outer-help")
  await expect(page.getByLabel("Area described")).toHaveAttribute("aria-describedby", "outer-help")
  const hinted = await page.getByLabel("Hinted described").getAttribute("aria-describedby")
  expect(hinted?.split(" ")).toHaveLength(2)
  expect(hinted).toContain("outer-help")
  const box = await page.getByRole("switch", { name: "Switch described" }).getAttribute("aria-describedby")
  expect(box?.split(" ")).toHaveLength(2)
  expect(box).toContain("outer-help")
})

test("restrict and mask together keep out what a composition brought in", async ({ page }) => {
  const input = page.getByLabel("Masked", { exact: true })
  await input.focus()
  await input.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))
    el.value = "12ab34"
    el.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true, inputType: "insertCompositionText" }))
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "12ab34" }))
  })
  await expect(input).toHaveValue("1234")
  await expect(page.getByLabel("Masked model")).toHaveText("1234")
  await expect(page.getByLabel("Masked raw")).toHaveText("1234")
})

test("restrict and mask hold on a drop-like replacement, and the mask still lays out", async ({ page }) => {
  const input = page.getByLabel("Masked", { exact: true })
  await input.evaluate((el: HTMLInputElement) => {
    el.value = "1a2b3c4d5e"
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }))
  })
  await expect(input).toHaveValue("1234-5")
})

test("the clear button follows whether the input really is readonly", async ({ page }) => {
  const clears = page.getByRole("button", { name: "Clear" })
  await expect(page.getByLabel("Readonly field")).toHaveJSProperty("readOnly", true)
  await expect(page.getByLabel("Null readonly")).toHaveJSProperty("readOnly", false)
  await expect(clears).toHaveCount(1)
  await clears.click()
  await expect(page.getByLabel("Null readonly")).toHaveValue("")
})

test("what describes a checkbox reaches the box, and its label stays the hit area", async ({ page }) => {
  const box = page.getByRole("checkbox", { name: "Described box" })
  await expect(box).toHaveAttribute("aria-describedby", "outer-help")
  await expect(box).toHaveAttribute("data-box", "yes")
  await expect(page.getByRole("checkbox", { name: "Named box" })).toHaveCount(1)
  await box.focus()
  await expect(page.getByLabel("Focused")).toHaveText("1")
  await page.getByText("Described box", { exact: true }).click()
  await expect(box).toHaveAttribute("aria-checked", "true")
})

test("a failed save from the mixed state brings the mixed state back", async ({ page }) => {
  await expect(page.getByLabel("Mixed", { exact: true })).toHaveText("true")
  const box = page.getByRole("checkbox", { name: "Mixed box" })
  await box.click()
  await expect(box).toHaveAttribute("aria-checked", "mixed")
  await expect(page.getByLabel("Mixed", { exact: true })).toHaveText("true")
})

test("a pick by keyboard returns focus to the select", async ({ page }) => {
  const trigger = page.getByRole("button", { name: /^Single, / })
  await trigger.focus()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("option", { name: "Alpha" })).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("option", { name: "Beta" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("option")).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toContainText("Beta")
})

test("chips are measured again when their own width changes", async ({ page }) => {
  const row = page.locator("[data-lp-field-part]").filter({ hasText: "Alpha" }).filter({ hasText: "Gamma" }).first()
  await page.addStyleTag({ content: "[aria-hidden='true'] span { letter-spacing: 12px }" })
  await expect(row.getByText(/^\+\d/).first()).toBeVisible()
})

test("a hotkey clicks a single-root custom component, and is a no-op on a fragment", async ({ page }) => {
  await page.keyboard.press("Shift+K")
  await expect(page.getByLabel("Clicks")).toHaveText("1")
  await page.keyboard.press("Shift+L")
  await expect(page.getByLabel("Clicks")).toHaveText("1")
})

test("a popover is named by a heading inside it or by its label", async ({ page }) => {
  await page.getByRole("button", { name: "Open popover" }).click()
  await expect(page.getByRole("dialog", { name: "Popover title" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Open named" }).click()
  await expect(page.getByRole("dialog", { name: "Named panel" })).toBeVisible()
})
