import { expect, test } from "./fixtures"

for (const layout of ["auto", "horizontal", "stacked"]) {
  test(`narrow ${layout} data list wraps values beside its copy button`, async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(`/tests/browser/?scenario=data-list&mode=${layout}`)
    const row = page.locator("dl > div").filter({ has: page.getByText("Address", { exact: true }) })
    const value = row.locator(".lp-roll__item")
    await expect(value).toHaveText("play.leavepulse.net:25565")
    const copy = row.getByRole("button", { name: "Copy", exact: true })
    const textBounds = await value.boundingBox()
    const copyBounds = await copy.boundingBox()
    expect(textBounds!.x + textBounds!.width).toBeLessThanOrEqual(copyBounds!.x)
    for (const detail of await page.locator("dd").all()) {
      expect(await detail.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    }
    await row.hover()
    await copy.click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("play.leavepulse.net:25565")
  })
}

for (const input of [false, true]) {
  for (const mode of ["own", "inherited"]) {
    test(`secret ${input ? 'input' : 'display'} respects ${mode} disabled and revealable`, async ({ page }) => {
      await page.goto(`/tests/browser/?scenario=secret&input=${input}&mode=${mode}`)
      for (const name of ["Copy", "Regenerate", "Show"]) {
        await expect(page.getByRole("button", { name, exact: true })).toBeDisabled()
      }
      if (input) await expect(page.locator("input")).toBeDisabled()
      await expect(page.getByRole("status", { name: "Rotations" })).toHaveText("0")
      await page.getByRole("button", { name: "Toggle lock" }).click()
      await page.getByRole("button", { name: "Regenerate", exact: true }).click()
      await expect(page.getByRole("status", { name: "Rotations" })).toHaveText("1")
      await page.getByRole("button", { name: "Show", exact: true }).click()
      if (input) await expect(page.locator("input")).toHaveAttribute("type", "text")
      else await expect(page.getByText("private-value", { exact: true }).first()).toBeVisible()
      await page.getByRole("button", { name: "Toggle reveal" }).click()
      await expect(page.getByRole("button", { name: /^(Show|Hide)$/ })).toHaveCount(0)
      if (input) await expect(page.locator("input")).toHaveAttribute("type", "password")
      else await expect(page.getByText("private-value", { exact: true })).toHaveCount(0)
    })
  }
}

test("password toggle inherits field disabled", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=password")
  await expect(page.getByRole("button", { name: "Show password" })).toBeDisabled()
  await expect(page.locator("input")).toBeDisabled()
  await page.getByRole("button", { name: "Toggle lock" }).click()
  await page.getByRole("button", { name: "Show password" }).click()
  await expect(page.locator("input")).toHaveAttribute("type", "text")
  await page.getByRole("button", { name: "Toggle lock" }).click()
  await expect(page.getByRole("button", { name: "Hide password" })).toBeDisabled()
})

for (const mode of ["disabled", "readonly"]) {
  test(`an open editable preserves its draft while ${mode}`, async ({ page }) => {
    await page.goto(`/tests/browser/?scenario=editable&mode=${mode}`)
    await page.getByRole("button", { name: "Edit Name: Old" }).click()
    const field = page.getByRole("textbox", { name: "Name", exact: true })
    await field.fill("New")
    await page.getByRole("button", { name: "Toggle lock" }).click()
    if (mode === "disabled") await expect(field).toBeDisabled()
    else {
      await expect(field).toHaveAttribute("readonly", "")
      await field.press("Enter")
    }
    await expect(page.getByRole("status", { name: "Saved names" })).toHaveText("[]")
    await page.getByRole("button", { name: "Toggle lock" }).click()
    await expect(field).toHaveValue("New")
    await field.press("Enter")
    await expect(page.getByRole("status", { name: "Saved names" })).toHaveText('["New"]')
  })
}

for (const mode of ["date", "range", "time"]) {
  test(`${mode} picker blurs only after leaving its portal and trigger`, async ({ page }) => {
    await page.goto(`/tests/browser/?scenario=picker&mode=${mode}`)
    const trigger = page.getByRole("button", { name: "Date", exact: true })
    const count = page.getByRole("status", { name: "Blur count" })
    await trigger.click()
    await page.getByRole("dialog").focus()
    await expect(count).toHaveText("0")
    await page.getByRole("button", { name: "Previous month", exact: true }).click()
    await page.getByRole("button", { name: "Next month", exact: true }).click()
    await expect(count).toHaveText("0")
    await expect(page.getByText(mode === "range" ? "Choose range" : "Choose date", { exact: true })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
    await expect(count).toHaveText("0")
    await page.keyboard.press("Tab")
    await expect(page.getByRole("button", { name: "After", exact: true })).toBeFocused()
    await expect(count).toHaveText("1")
    await expect(page.getByText(mode === "range" ? "Choose range" : "Choose date", { exact: true })).toBeVisible()
  })
}

for (const mode of ["date", "range", "time"]) {
  test(`${mode} picker keeps internal selection inside the field`, async ({ page }) => {
    await page.goto(`/tests/browser/?scenario=picker&mode=${mode}`)
    const trigger = page.getByRole("button", { name: "Date", exact: true })
    const count = page.getByRole("status", { name: "Blur count" })
    await trigger.click()
    await page.getByRole("button", { name: "Today", exact: true }).click()
    if (mode === "time") {
      const segment = page.getByRole("spinbutton").first()
      await segment.focus()
      await segment.press("ArrowUp")
      await expect(count).toHaveText("0")
      await page.getByRole("button", { name: "Done", exact: true }).click()
    }
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(count).toHaveText("0")
    await trigger.click()
    await page.getByRole("button", { name: "After", exact: true }).click()
    await expect(count).toHaveText("1")
  })
}

test("select search, option and clear stay inside its blur boundary", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=select")
  const trigger = page.getByRole("button", { name: /Protocol/ }).first()
  const count = page.getByRole("status", { name: "Blur count" })
  await trigger.click()
  await page.getByRole("combobox").fill("UDP")
  await expect(count).toHaveText("0")
  await page.getByRole("option", { name: "UDP", exact: true }).click()
  await expect(count).toHaveText("0")
  await page.getByRole("button", { name: "Clear", exact: true }).focus()
  await expect(count).toHaveText("0")
  await page.getByRole("button", { name: "After", exact: true }).focus()
  await expect(count).toHaveText("1")
})

test("mobile drawer validates, edits lists, guards closing and saves", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/tests/browser/?scenario=form")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText("Enter a name", { exact: true })).toBeVisible()
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Service")
  await page.getByRole("button", { name: /Protocol/ }).first().click()
  await page.getByRole("option", { name: "UDP", exact: true }).click()
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  await page.getByRole("textbox", { name: "Port", exact: true }).fill("8080")
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Keep editing", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Port", exact: true })).toHaveValue("8080")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  // Outputs behind a modal are intentionally aria-hidden.
  await expect(page.locator('output[aria-label="Saved service"]')).toHaveText('[{"name":"Service","proto":"udp","ports":[{"port":"8080"}]}]')
  await expect(page.locator('output[aria-label="Dirty"]')).toHaveText("false")
  const dialog = page.getByRole("dialog", { name: "Edit service" })
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.getByRole("button", { name: "Close", exact: true }).click()
  await expect(dialog).toHaveCount(0)
})
