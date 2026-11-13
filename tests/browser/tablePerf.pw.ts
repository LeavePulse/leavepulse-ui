import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"

const open = (via: "rows" | "filter") => `/tests/browser/?scenario=table-perf&via=${via}`
const rows = (page: Page) => page.locator("tbody tr")

/*
 * What the rows do in the frames right after a click: which of them carry an
 * enter, leave or move transition or a FLIP offset, how many times a row was
 * measured, and whether the body eased in as one.
 */
async function clickAndWatch(page: Page, name: string) {
  return page.evaluate(async (label) => {
    const measured = new Set<Element>()
    let calls = 0
    const original = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.tagName === "TR") {
        calls++
        measured.add(this)
      }
      return original.call(this)
    }
    const seen = { entering: 0, leaving: 0, moving: 0, offset: 0 }
    const look = () => {
      const all = Array.from(document.querySelectorAll<HTMLElement>("tbody tr"))
      seen.entering = Math.max(seen.entering, all.filter((tr) => tr.classList.contains("lp-row-enter-active")).length)
      seen.leaving = Math.max(seen.leaving, all.filter((tr) => tr.classList.contains("lp-row-leave-active")).length)
      seen.moving = Math.max(seen.moving, all.filter((tr) => tr.classList.contains("lp-row-move")).length)
      seen.offset = Math.max(seen.offset, all.filter((tr) => tr.style.transform !== "").length)
    }
    const button = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === label)!
    button.click()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    look()
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      look()
    }
    Element.prototype.getBoundingClientRect = original
    const body = document.querySelector<HTMLElement>("tbody")!
    return { ...seen, measured: measured.size, calls, settle: body.dataset.lpSettle ?? null, rows: document.querySelectorAll("tbody tr").length }
  }, name)
}

test("fifty rows coming back land at once and the body eases in, without a transition or a measure per row", async ({ page }) => {
  await page.goto(open("filter"))
  await expect(rows(page)).toHaveCount(60)
  await page.getByRole("button", { name: "Core only" }).click()
  await expect(rows(page)).toHaveCount(10)
  const back = await clickAndWatch(page, "Show all")
  expect(back.rows).toBe(60)
  expect(back).toMatchObject({ entering: 0, leaving: 0, moving: 0, offset: 0 })
  expect(back.settle).not.toBeNull()
  // TransitionGroup still notes where the ten old rows were before the render;
  // none of the fifty new ones, and no row a second time, is measured after it.
  expect(back.measured).toBeLessThanOrEqual(10)
  expect(back.calls).toBeLessThanOrEqual(10)
})

test("ten rows leaving through the table's own filter still fade out one by one", async ({ page }) => {
  await page.goto(open("filter"))
  await expect(rows(page)).toHaveCount(60)
  const small = await clickAndWatch(page, "Hide core")
  expect(small.leaving).toBe(10)
  expect(small.settle).toBeNull()
  await expect(rows(page)).toHaveCount(50)
})

test("a tooltip in a row is only its trigger until it is wanted, then shows and describes it", async ({ page }) => {
  await page.goto(open("rows"))
  await expect(rows(page)).toHaveCount(60)
  // A hundred and eighty tips in the rows, and none of reka's machinery stood up for them yet.
  await expect(page.locator("[data-grace-area-trigger]")).toHaveCount(180)
  await expect(page.locator("[data-reka-popper-content-wrapper]")).toHaveCount(0)
  // A mounted tip keeps a portal open into the body (two anchor nodes) even
  // while closed: a hundred and eighty of them were 360 nodes. The table's own
  // menus account for the few there are.
  const portalAnchors = () => page.evaluate(() => Array.from(document.body.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent === "").length)
  const before = await portalAnchors()
  expect(before).toBeLessThan(40)
  const trigger = page.getByText("+2", { exact: true }).first()
  await expect(trigger).toHaveAttribute("data-tooltip-state", "closed")
  // The trigger stays the very element it was, so a ref to it or its focus survives.
  await trigger.evaluate((el) => ((el as unknown as { __mark: boolean }).__mark = true))
  await trigger.hover()
  const tip = page.locator("[data-reka-popper-content-wrapper]", { hasText: "2 more hosts" })
  await expect(tip).toBeVisible()
  await expect(trigger).toHaveAccessibleDescription("2 more hosts")
  await expect(trigger).toHaveAttribute("data-tooltip-state", /open/)
  expect(await portalAnchors()).toBeGreaterThan(before)
  expect(await trigger.evaluate((el) => (el as unknown as { __mark?: boolean }).__mark)).toBe(true)
  await page.mouse.move(0, 0)
  await expect(tip).toHaveCount(0)
  await expect(trigger).not.toHaveAttribute("aria-describedby", /.+/)
})

test("a tooltip not yet mounted opens on keyboard focus and keeps its label before", async ({ page }) => {
  await page.goto(open("rows"))
  await expect(rows(page)).toHaveCount(60)
  // The label names the trigger from the start, not only once the tip is mounted.
  const icon = page.getByLabel("Autopilot on for service-01", { exact: true })
  await expect(icon).toHaveCount(1)
  const status = page.getByText("Status of service-03: stopped")
  await expect(status).toHaveCount(0)
  // Keyboard focus reaches a tip that was never hovered.
  await page.getByRole("link", { name: "service-03" }).focus()
  await page.keyboard.press("Tab")
  const described = page.locator("span[tabindex='0']", { hasText: "stopped" }).first()
  await expect(described).toBeFocused()
  await expect(described).toHaveAccessibleDescription("Status of service-03: stopped")
  await expect(page.locator("[data-reka-popper-content-wrapper]", { hasText: "Status of service-03: stopped" })).toBeVisible()
})

/*
 * What a sixty-row swap costs the main thread: the services list cut to ten
 * rows and back, timed by the browser's own long-task and long-animation-frame
 * entries. Timing depends on the machine, so this runs only on request:
 *
 *   LP_PERF=1 bunx playwright test tablePerf --workers 1
 *
 * LP_PERF_CPU=4 slows the CPU down that many times, closer to a laptop on
 * battery than to a development machine. LP_PERF_BUDGET=80 fails a run whose
 * median longest task is over that many ms.
 */
const ROUNDS = 5

interface Sample { longTask: number; frame: number; event: number }

async function swapBack(page: Page): Promise<Sample> {
  const toggle = page.getByTestId("toggle")
  await toggle.click()
  await expect(page.getByRole("status", { name: "Shown" })).toHaveText("core")
  await expect(page.locator("tbody tr")).toHaveCount(10)
  await page.waitForTimeout(800)
  await page.evaluate(() => {
    const w = window as unknown as { __perf: { longTask: number; frame: number; event: number }; __observers?: PerformanceObserver[] }
    w.__observers?.forEach((o) => o.disconnect())
    w.__perf = { longTask: 0, frame: 0, event: 0 }
    const watch = (type: string, read: (entry: PerformanceEntry) => number, key: "longTask" | "frame" | "event", extra: Record<string, unknown> = {}) => {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__perf[key] = Math.max(w.__perf[key], read(entry))
      })
      observer.observe({ type, ...extra } as PerformanceObserverInit)
      ;(w.__observers ??= []).push(observer)
    }
    watch("longtask", (e) => e.duration, "longTask")
    watch("long-animation-frame", (e) => e.duration, "frame")
    watch("event", (e) => (e.name === "click" ? e.duration : 0), "event", { durationThreshold: 16 })
  })
  await toggle.click()
  await expect(page.locator("tbody tr")).toHaveCount(60)
  await page.waitForTimeout(1200)
  return page.evaluate(() => (window as unknown as { __perf: Sample }).__perf)
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

for (const via of ["rows", "filter"] as const) {
  test(`perf: sixty rows swapped back in (${via})`, async ({ page }) => {
    test.skip(!process.env.LP_PERF, "timing run, LP_PERF=1 to enable")
    test.setTimeout(120_000)
    const cpu = Number(process.env.LP_PERF_CPU ?? 1)
    if (cpu > 1) {
      const session = await page.context().newCDPSession(page)
      await session.send("Emulation.setCPUThrottlingRate", { rate: cpu })
    }
    await page.goto(`/tests/browser/?scenario=table-perf&via=${via}`)
    await expect(page.locator("tbody tr")).toHaveCount(60, { timeout: 30_000 })
    const samples: Sample[] = []
    for (let i = 0; i < ROUNDS; i++) samples.push(await swapBack(page))
    const result = {
      cpu,
      longTask: median(samples.map((s) => s.longTask)),
      frame: median(samples.map((s) => s.frame)),
      event: median(samples.map((s) => s.event)),
      samples,
    }
    console.log(`[perf ${via} cpu×${cpu}]`, JSON.stringify(result))
    test.info().annotations.push({ type: "perf", description: JSON.stringify(result) })
    if (process.env.LP_PERF_BUDGET) expect(result.longTask).toBeLessThan(Number(process.env.LP_PERF_BUDGET))
  })
}
