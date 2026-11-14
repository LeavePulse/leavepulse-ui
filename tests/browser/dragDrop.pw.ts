import type { Locator, Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const URL = "/tests/browser/?scenario=drag-drop"

const item = (page: Page, key: string) => page.locator(`[data-drag-key="${key}"]`)

async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function drag(page: Page, from: Locator, to: Locator, finish: () => Promise<void> = () => page.mouse.up()) {
  const a = await centre(from)
  const b = await centre(to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(a.x + 12, a.y, { steps: 3 })
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await finish()
}


test("an item dragged with the mouse lands in another zone", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "u1"), page.getByTestId("zone-b"))
  await expect(page.getByTestId("log")).toHaveText("u1:a>b")
  await expect(page.getByTestId("zone-b").locator("[data-drag-key='u1']")).toBeVisible()
  await expect(page.locator("[data-drag-source], [data-drop-over]")).toHaveCount(0)
  await expect(page.locator("[aria-hidden='true'][style*='fixed']")).toHaveCount(0, { timeout: 2000 })
})

test("a zone under the pointer is marked while dragging", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "u1"), page.getByTestId("zone-b"), async () => {
    await expect(page.getByTestId("zone-b")).toHaveAttribute("data-drop-over", "")
    await expect(item(page, "u1")).toHaveAttribute("data-drag-source", "")
    await expect(page.getByTestId("state")).toHaveText("u1|b")
    await page.mouse.up()
  })
})

test("a click without moving stays a click", async ({ page }) => {
  await page.goto(URL)
  await item(page, "u2").click()
  await expect(page.getByTestId("clicks")).toHaveText("1")
  await expect(page.getByTestId("log")).toHaveText("none")
})

test("a drag swallows the click it ends with", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "u1"), page.getByTestId("zone-pool"))
  await expect(page.getByTestId("log")).toHaveText("u1:a>pool")
  await expect(page.getByTestId("clicks")).toHaveText("0")
})

test("no drop on the zone it came from, on a refused zone or after Escape", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "u1"), item(page, "u2"))
  await drag(page, item(page, "u1"), page.getByTestId("zone-locked"), async () => {
    await expect(page.getByTestId("zone-locked")).not.toHaveAttribute("data-drop-over", "")
    await page.mouse.up()
  })
  await drag(page, item(page, "u1"), page.getByTestId("zone-b"), async () => {
    await page.keyboard.press("Escape")
    await page.mouse.up()
  })
  await expect(page.getByTestId("log")).toHaveText("none")
  await expect(page.getByTestId("zone-a").locator("[data-drag-key='u1']")).toBeVisible()
})

test("a control inside an item does not start a drag", async ({ page }) => {
  await page.goto(URL)
  await drag(page, page.getByRole("button", { name: "menu u1" }), page.getByTestId("zone-b"))
  await expect(page.getByTestId("log")).toHaveText("none")
})

test("a finger holds before dragging, and a quick swipe does not drag", async ({ page }) => {
  await page.goto(URL)
  const touch = async (key: string, hold: number) => {
    const a = await centre(page.getByText(key, { exact: true }))
    const b = await centre(page.getByTestId("zone-b"))
    await page.evaluate(
      async ({ key, a, b, hold }) => {
        const el = document.querySelector(`[data-drag-key="${key}"] span`)!
        const init = { bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true, button: 0 }
        el.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: a.x, clientY: a.y }))
        await new Promise((r) => setTimeout(r, hold))
        for (let i = 1; i <= 6; i++) {
          window.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: a.x + ((b.x - a.x) * i) / 6, clientY: a.y + ((b.y - a.y) * i) / 6 }))
          await new Promise((r) => requestAnimationFrame(r))
        }
        window.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: b.x, clientY: b.y }))
      },
      { key, a, b, hold },
    )
  }
  await touch("u1", 30)
  await expect(page.getByTestId("log")).toHaveText("none")
  await touch("u1", 450)
  await expect(page.getByTestId("log")).toHaveText("u1:a>b")
})

test("a board that renders after mounting (behind a loader) still drags", async ({ page }) => {
  await page.goto(URL)
  await expect(page.getByTestId("late")).toBeVisible()
  await drag(page, item(page, "l1"), page.getByTestId("late-y"))
  await expect(page.getByTestId("late-y").locator("[data-drag-key='l1']")).toBeVisible()
})

test("a dropped item eases into its new place instead of jumping", async ({ page }) => {
  await page.goto(URL)
  await drag(page, item(page, "u1"), page.getByTestId("zone-b"), async () => {
    await page.mouse.up()
    await expect.poll(() => item(page, "u1").evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0)
  })
  await expect.poll(() => item(page, "u1").evaluate((el) => el.getAnimations().length)).toBe(0)
})

test("under reduced motion the drop lands without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(URL)
  await drag(page, item(page, "u1"), page.getByTestId("zone-b"))
  expect(await item(page, "u1").evaluate((el) => el.getAnimations().length)).toBe(0)
})

test("zones mapped to objects still know the zone an item came from", async ({ page }) => {
  await page.goto(URL)
  await expect(page.getByTestId("late")).toBeVisible()
  await drag(page, item(page, "ob1"), page.getByTestId("obj-o1"))
  await expect(page.getByTestId("obj-log")).toHaveText("none")
  await drag(page, item(page, "ob1"), page.getByTestId("obj-o2"))
  await expect(page.getByTestId("obj-log")).toHaveText("ob1>o2")
})
