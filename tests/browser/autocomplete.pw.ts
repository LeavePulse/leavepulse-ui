import { expect, test } from "./fixtures"

test("a suggestion picked with the mouse lands even when the field resets its text on blur", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=autocomplete-blur")
  const field = page.getByRole("combobox", { name: "Person" })
  await field.click()
  await field.pressSequentially("ro")
  await page.getByRole("option", { name: "THEROER" }).click()
  await expect(page.getByTestId("picked")).toHaveText("THEROER")
  await expect(field).toHaveValue("THEROER")
  await expect(field).toBeFocused()
})
