import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const out = (page: Page, name: string) => page.locator(`[data-test=${name}]`)
const start = (page: Page) => page.getByRole("slider", { name: "Start", exact: true })
const end = (page: Page) => page.getByRole("slider", { name: "End", exact: true })
const playhead = (page: Page) => page.getByRole("slider", { name: "Position", exact: true })

async function open(page: Page, query = "") {
  await page.setViewportSize({ width: 1000, height: 900 })
  await page.goto(`/tests/browser/?scenario=video-trim${query}`)
  // An unset range becomes the first maxClip once the duration is known.
  await expect(out(page, "range")).toHaveText("0–2")
}

test("an unset range is filled in, and the timeline gets stills", async ({ page }) => {
  await open(page)
  await expect(start(page)).toHaveAttribute("aria-valuetext", "0:00.0")
  await expect(end(page)).toHaveAttribute("aria-valuetext", "0:02.0")
  await expect(page.locator("[data-lp-still=ready]").first()).toBeVisible({ timeout: 10000 })
  // innerText: what shows, without the invisible twin that holds the width.
  await expect.poll(() => page.locator("[data-lp-left]").innerText()).toBe("0:00.0 left of 0:02.0")
})

test("a dragged handle stops at maxClip, and change fires once on release", async ({ page }) => {
  await open(page)
  const track = (await page.getByRole("group", { name: /^Timeline/ }).boundingBox())!
  const handle = (await end(page).boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(track.x + track.width * 0.9, handle.y + 10, { steps: 6 })
  await expect(out(page, "changes")).toHaveText("0")
  await page.mouse.up()
  await expect(out(page, "changes")).toHaveText("1")
  await expect(out(page, "range")).toHaveText("0–2")

  // The start moved right lets the end go further, up to two seconds after it.
  await start(page).focus()
  await page.keyboard.press("Shift+ArrowRight")
  await expect(out(page, "range")).toHaveText("1–2")
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  const moved = (await end(page).boundingBox())!
  await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2)
  await page.mouse.down()
  await page.mouse.move(track.x + track.width * 0.95, moved.y + 10, { steps: 6 })
  await page.mouse.up()
  await expect(out(page, "range")).toHaveText("1–3")
})

test("I and O set the ends at the playhead; Space plays and stops at the end", async ({ page }) => {
  await open(page)
  await playhead(page).focus()
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowRight")
  await expect(playhead(page)).toHaveAttribute("aria-valuetext", "0:03.0")
  await page.keyboard.press("i")
  await expect(out(page, "range")).toHaveText("3–3.5")
  await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("o")
  await expect(out(page, "range")).toHaveText("3–4")
  // Playing from the end replays the clip from its start and stops at its end.
  await page.keyboard.press(" ")
  await expect.poll(async () => Number(await playhead(page).getAttribute("aria-valuenow")), { timeout: 5000 }).toBeGreaterThanOrEqual(3.95)
  await page.waitForTimeout(400)
  expect(Number(await playhead(page).getAttribute("aria-valuenow"))).toBeCloseTo(4, 1)
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible()
})

test("a typed time sets an end and pulls the other along", async ({ page }) => {
  await open(page)
  const field = page.locator("[data-lp-time='0'] input, input[data-lp-time='0']").first()
  await field.fill("4,5")
  await field.press("Enter")
  await expect(out(page, "range")).toHaveText("4.5–5")
  await field.fill("abc")
  await field.press("Enter")
  await expect(out(page, "range")).toHaveText("4.5–5")
  await field.press("Escape")
  await expect(field).toHaveValue("0:04.5")
})

test("the wheel zooms the timeline and the overview brings the whole back", async ({ page }) => {
  await open(page)
  await page.getByRole("group", { name: /^Timeline/ }).hover()
  await page.mouse.wheel(0, -600)
  await expect(page.locator("[data-lp-overview]")).toBeVisible()
  await page.getByRole("button", { name: "Show whole video" }).click()
  await expect(page.locator("[data-lp-overview]")).toHaveCount(0)
})

test("a rectangle drawn on the picture becomes the region, and Delete removes it", async ({ page }) => {
  await open(page)
  const layer = (await page.locator("[data-lp-region-layer]").boundingBox())!
  await page.mouse.move(layer.x + layer.width * 0.2, layer.y + layer.height * 0.25)
  await page.mouse.down()
  await page.mouse.move(layer.x + layer.width * 0.6, layer.y + layer.height * 0.75, { steps: 5 })
  await page.mouse.up()
  await expect(out(page, "region")).toHaveText("0.20,0.25,0.40,0.50")
  await page.locator("[data-lp-region]").focus()
  await page.keyboard.press("ArrowRight")
  await expect(out(page, "region")).toHaveText("0.21,0.25,0.40,0.50")
  await page.keyboard.press("Delete")
  await expect(out(page, "region")).toHaveText("none")
})

test("a video that does not load says so", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=video-trim&src=/tests/browser/missing.webm")
  await expect(page.getByRole("alert")).toHaveText("This video couldn't be loaded.")
  await expect(out(page, "errors")).not.toHaveText("")
})

test("the editor keeps its size: a limit switched off, or a handle dragged, moves nothing around it", async ({ page }) => {
  await open(page)
  const root = page.locator("[data-lp-clock]").locator("xpath=ancestor::div[contains(@class,'flex-col')][1]")
  const size = async () => {
    const b = (await root.boundingBox())!
    return `${Math.round(b.width)}x${Math.round(b.height)}`
  }
  const first = await size()
  await page.locator("[data-test=limit]").click()
  await expect(page.locator("[data-lp-left]")).toHaveCount(0)
  expect((await root.boundingBox())!.width).toBe(Number(first.split("x")[0]))
  await page.locator("[data-test=limit]").click()
  const sizes = new Set([await size()])
  const handle = (await end(page).boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 20)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(handle.x + handle.width / 2 - i * 9, handle.y + 20)
    sizes.add(await size())
  }
  await page.mouse.up()
  expect([...sizes]).toEqual([first])
})

test("a right-click on the timeline offers that moment", async ({ page }) => {
  await open(page)
  const track = (await page.getByRole("group", { name: /^Timeline/ }).boundingBox())!
  await page.mouse.click(track.x + track.width * 0.5, track.y + track.height / 2, { button: "right" })
  const menu = page.getByRole("menu")
  await expect(menu).toContainText("At 0:03.0")
  await menu.getByRole("menuitem", { name: /Start here/ }).click()
  await expect(out(page, "range")).toHaveText("3–3.5")
})
