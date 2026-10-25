import { expect, test } from "./fixtures"

test("number field and slider edit the same capacity", async ({ page }) => {
  await page.goto("/component/numbers-together")
  const frame = page.frameLocator("iframe").first()
  const number = frame.getByRole("spinbutton", { name: "Capacity", exact: true })
  await number.fill("42")
  await number.press("Enter")
  const slider = frame.getByRole("slider", { name: "Capacity slider", exact: true })
  await expect(slider).toHaveAttribute("aria-valuenow", "42")
  await slider.focus()
  await slider.press("ArrowRight")
  await expect(number).toHaveValue("43")
})

test("both menu entry points use the same actions", async ({ page }) => {
  await page.goto("/component/menus-together")
  const frame = page.frameLocator("iframe").first()
  await frame.getByRole("button", { name: "Service actions", exact: true }).click()
  await frame.getByRole("menuitem", { name: "Move to", exact: true }).hover()
  await frame.getByRole("menuitem", { name: "Staging", exact: true }).click()
  await expect(frame.getByRole("status")).toHaveText("Moved to Staging")
  await frame.getByText("· right-click this row", { exact: true }).click({ button: "right" })
  await frame.getByRole("menuitem", { name: "Open", exact: true }).click()
  await expect(frame.getByRole("status")).toHaveText("Opened api-gateway")
})

test("loading example reserves the content and action geometry", async ({ page }) => {
  await page.goto("/component/loading-together")
  const frame = page.frameLocator("iframe").first()
  const button = frame.getByRole("button", { name: "Refresh service", exact: true })
  const rect = () => button.evaluate(el => {
    const { x, y, width, height } = el.getBoundingClientRect()
    return { x, y, width, height }
  })
  await expect(button).toHaveAttribute("aria-busy", "true")
  const before = await rect()
  await frame.getByRole("switch", { name: "Loading", exact: true }).click()
  await expect(button).not.toHaveAttribute("aria-busy", "true")
  expect(await rect()).toEqual(before)
  await expect(frame.getByRole("heading", { name: "api-gateway", exact: true })).toBeVisible()
})

test("related examples link back to the component and survive navigation", async ({ page }) => {
  await page.goto("/component/numberfield")
  await page.getByRole("navigation", { name: "Compare and compose", exact: true }).getByRole("link", { name: /Numbers and ranges/ }).click()
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Numbers and ranges")
  await page.getByRole("navigation", { name: "When to use each component", exact: true }).getByRole("link", { name: /^NumberField/ }).click()
  await expect(page).toHaveURL(/\/component\/numberfield$/)
  await page.goBack()
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Numbers and ranges")
})
