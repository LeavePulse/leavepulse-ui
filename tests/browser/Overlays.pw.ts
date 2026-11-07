import { expect, test } from "./fixtures"

const scenario = (mode: string) => `/tests/browser/?scenario=overlays&mode=${mode}`
type Counted = { bitmapsClosed?: number }

test("modal autofocus in a frame stops at the first field", async ({ page }) => {
  await page.goto(scenario("modal-frame"))
  const frame = page.frameLocator("iframe").first()
  await frame.getByRole("button", { name: "Open", exact: true }).click()
  await expect(frame.getByLabel("First")).toBeFocused()
})

test("modal autofocus lands in a contenteditable editor", async ({ page }) => {
  await page.goto(scenario("modal-editor"))
  await page.getByRole("button", { name: "Open", exact: true }).click()
  await expect(page.getByLabel("Editor")).toBeFocused()
})

test("the autofocus ring does not outlive a field hidden while focused", async ({ page }) => {
  await page.goto(scenario("modal-ring"))
  await page.getByRole("button", { name: "Open", exact: true }).click()
  const field = page.getByLabel("Field")
  await expect(field).toHaveAttribute("data-lp-focus-ring", "")
  await field.evaluate((el) => ((el as HTMLElement).style.display = "none"))
  await expect.poll(() => field.evaluate((el) => el.ownerDocument.activeElement === el)).toBe(false)
  await expect(field).not.toHaveAttribute("data-lp-focus-ring", "")
})

test("the dropdown hands focus back to its trigger", async ({ page }) => {
  await page.goto(scenario("dropdown"))
  const trigger = page.getByRole("button", { name: "Actions", exact: true })
  await trigger.click()
  await expect(page.getByRole("menu", { name: "Row" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole("menuitem", { name: "Pick" }).click()
  await expect(page.getByLabel("Picked")).toHaveText("picked")
  await expect(trigger).toBeFocused()
})

test("lightbox shortcuts leave a field in the actions slot alone", async ({ page }) => {
  await page.goto(scenario("lightbox"))
  await page.getByRole("button", { name: "Open", exact: true }).click()
  await expect(page.getByText("1 / 2")).toBeVisible()
  const input = page.getByLabel("Search images")
  await input.fill("ab")
  await input.press("ArrowLeft")
  await input.press("r")
  expect(await input.evaluate((el: HTMLInputElement) => [el.value, el.selectionStart])).toEqual(["arb", 2])
  await input.press("End")
  await expect(page.getByText("1 / 2")).toBeVisible()
  await page.getByRole("dialog").focus()
  await page.keyboard.press("Control+ArrowRight")
  await expect(page.getByText("1 / 2")).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByText("2 / 2")).toBeVisible()
})

test("an image paged past cannot fail the one on stage", async ({ page }) => {
  let refuse = () => {}
  const refused = new Promise<void>((resolve) => (refuse = resolve))
  await page.route("**/overlays-slow.png", async (route) => {
    await refused
    await route.abort()
  })
  await page.goto(scenario("race"))
  await page.getByRole("button", { name: "Open", exact: true }).click()
  await page.getByRole("button", { name: "Next image", exact: true }).click()
  await expect(page.getByText("2 / 2")).toBeVisible()
  await expect(page.getByRole("img", { name: "Quick" })).toBeVisible()
  refuse()
  await page.waitForTimeout(200)
  await expect(page.getByText("This image couldn't be loaded.")).toHaveCount(0)
  await expect(page.getByRole("img", { name: "Quick" })).toBeVisible()
})

test("copying a non-PNG releases the bitmap and reports once", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.addInitScript(() => {
    const close = ImageBitmap.prototype.close
    ImageBitmap.prototype.close = function () {
      const counted = window as unknown as Counted
      counted.bitmapsClosed = (counted.bitmapsClosed ?? 0) + 1
      close.call(this)
    }
  })
  await page.goto(scenario("lightbox"))
  await page.getByRole("button", { name: "Open", exact: true }).click()
  await page.getByRole("button", { name: "Copy image" }).click()
  await expect(page.locator("output[aria-label=Copied]")).toHaveText("One:true")
  expect(await page.evaluate(() => (window as unknown as Counted).bitmapsClosed)).toBe(1)
})
