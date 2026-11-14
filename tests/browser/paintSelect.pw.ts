import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const URL = "/tests/browser/?scenario=paint-select"

async function centre(page: Page, row: string) {
  const box = (await page.getByTestId(`tick-${row}`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function sweep(page: Page, from: string, ...through: string[]) {
  const a = await centre(page, from)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  for (const row of through) {
    const b = await centre(page, row)
    await page.mouse.move(b.x, b.y, { steps: 6 })
  }
  await page.mouse.up()
}

test("a mouse sweep ticks every row it passes, at once", async ({ page }) => {
  await page.goto(URL)
  await sweep(page, "r1", "r3")
  await expect(page.getByTestId("selected")).toHaveText("r1,r2,r3")
  await expect(page.getByTestId("painting")).toHaveText("false")
})

test("sweeping back un-paints what the stroke covered", async ({ page }) => {
  await page.goto(URL)
  await sweep(page, "r1", "r4", "r2")
  await expect(page.getByTestId("selected")).toHaveText("r1,r2")
})

test("starting on a ticked row clears the run", async ({ page }) => {
  await page.goto(URL)
  await sweep(page, "r1", "r4")
  await sweep(page, "r2", "r3")
  await expect(page.getByTestId("selected")).toHaveText("r1,r4")
})

test("the click a stroke ends with does not reach the row", async ({ page }) => {
  await page.goto(URL)
  await sweep(page, "r1", "r2")
  await expect(page.getByTestId("clicks")).toHaveText("0")
})

test("a finger holds before painting, and a quick swipe does not paint", async ({ page }) => {
  await page.goto(URL)
  const touch = async (hold: number) => {
    const a = await centre(page, "r1")
    const b = await centre(page, "r3")
    await page.evaluate(
      async ({ a, b, hold }) => {
        const el = document.querySelector("[data-testid='tick-r1']")!
        const init = { bubbles: true, pointerId: 9, pointerType: "touch", isPrimary: true, button: 0 }
        el.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: a.x, clientY: a.y }))
        await new Promise((r) => setTimeout(r, hold))
        for (let i = 1; i <= 5; i++) {
          window.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: a.x + ((b.x - a.x) * i) / 5, clientY: a.y + ((b.y - a.y) * i) / 5 }))
          await new Promise((r) => requestAnimationFrame(r))
        }
        window.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: b.x, clientY: b.y }))
      },
      { a, b, hold },
    )
  }
  await touch(30)
  await expect(page.getByTestId("selected")).toHaveText("none")
  await touch(450)
  await expect(page.getByTestId("selected")).toHaveText("r1,r2,r3")
})
