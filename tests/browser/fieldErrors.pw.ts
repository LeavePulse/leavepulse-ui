import { expect, test } from "./fixtures"

const NAMES = ["input", "textarea", "tags", "select", "autocomplete", "number", "otp", "phone", "address", "date", "range", "time", "color", "slider", "rangeSlider", "segmented", "radio", "checkbox", "switch", "repeater"]

test("every field control shows the error form.field() hands it", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=field-errors")
  for (const name of NAMES) {
    const box = page.locator(`[data-field="${name}"]`)
    await expect(box.getByText(`Broken ${name}`, { exact: true }), name).toHaveCount(1)
    // The message is tied to the control it is about.
    const id = await box.getByText(`Broken ${name}`, { exact: true }).getAttribute("id")
    await expect(box.locator(`[aria-describedby~="${id}"]`), name).not.toHaveCount(0)
  }
})

test("inside a form field that shows the error, a control shows it no second time", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=field-errors&inside")
  for (const name of NAMES) {
    await expect(page.locator(`[data-field="${name}"]`).getByText(`Broken ${name}`, { exact: true }), name).toHaveCount(1)
  }
})
