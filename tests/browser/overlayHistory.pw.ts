import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"

const URL = "/tests/browser/?scenario=overlay-history"

type Stats = { navigations: number; homeSetups: number }
const stats = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { overlayStats: Stats }).overlayStats }))
const length = (page: Page) => page.evaluate(() => history.length)
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name })

async function start(page: Page) {
  await page.goto(URL)
  await expect(page.getByText("Home page")).toBeVisible()
  await expect.poll(async () => (await stats(page)).navigations).toBe(1)
}

test("opening adds one entry and Back closes the overlay without a navigation", async ({ page }) => {
  await start(page)
  const before = await length(page)
  const routerState = await page.evaluate(() => history.state)
  await page.getByRole("button", { name: "Open outer" }).click()
  await expect(dialog(page, "Outer")).toBeVisible()
  await expect.poll(() => length(page)).toBe(before + 1)
  const pushed = await page.evaluate(() => history.state)
  for (const key of ["back", "current", "forward", "position", "replaced"]) expect(pushed[key]).toEqual(routerState[key])
  expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")

  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
  expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")
  const after = await stats(page)
  expect(after.navigations).toBe(1)
  expect(after.homeSetups).toBe(1)
})

test("closing through the UI removes the entry", async ({ page }) => {
  await start(page)
  const state = await page.evaluate(() => history.state)
  await page.getByRole("button", { name: "Open outer" }).click()
  await expect(dialog(page, "Outer")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog(page, "Outer")).toBeHidden()
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()
  expect((await page.evaluate(() => history.state)).position).toBe(state.position)

  await page.getByRole("button", { name: "Open outer" }).click()
  await dialog(page, "Outer").getByRole("button", { name: "Close outer" }).click()
  await expect(dialog(page, "Outer")).toBeHidden()
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()
  expect((await stats(page)).navigations).toBe(1)
})

test("nested overlays close one per Back, top first", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open outer" }).click()
  await dialog(page, "Outer").getByRole("button", { name: "Open inner" }).click()
  await expect(dialog(page, "Inner")).toBeVisible()
  await page.goBack()
  await expect(dialog(page, "Inner")).toBeHidden()
  await expect(dialog(page, "Outer")).toBeVisible()
  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
  expect((await stats(page)).navigations).toBe(1)
})

test("tabs inside an overlay step back before it closes; page tabs stay out", async ({ page }) => {
  await start(page)
  const before = await length(page)
  await page.getByRole("tablist", { name: "Page tabs" }).getByRole("tab", { name: "Two" }).click()
  await page.waitForTimeout(100)
  expect(await length(page)).toBe(before)

  await page.getByRole("button", { name: "Open outer" }).click()
  const outer = dialog(page, "Outer")
  await outer.getByRole("tab", { name: "Two" }).click()
  await expect(outer.getByText("Tab is two")).toBeVisible()
  await outer.getByRole("tab", { name: "Three" }).click()
  await expect(outer.getByText("Tab is three")).toBeVisible()
  await expect.poll(() => length(page)).toBe(before + 3)

  await page.goBack()
  await expect(outer.getByText("Tab is two")).toBeVisible()
  await page.goBack()
  await expect(outer.getByText("Tab is one")).toBeVisible()
  await page.goBack()
  await expect(outer).toBeHidden()
  expect((await stats(page)).navigations).toBe(1)
})

test("closing an overlay through the UI takes its tab steps with it", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open outer" }).click()
  const outer = dialog(page, "Outer")
  await outer.getByRole("tab", { name: "Two" }).click()
  await expect(outer.getByText("Tab is two")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(outer).toBeHidden()
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()
})

test("Forward does nothing for a plain overlay and reopens one that opts in", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open outer" }).click()
  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
  await page.goForward()
  await page.waitForTimeout(300)
  await expect(dialog(page, "Outer")).toBeHidden()
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()

  await page.getByRole("button", { name: "Open reopenable" }).click()
  await expect(dialog(page, "Reopenable")).toBeVisible()
  await page.goBack()
  await expect(dialog(page, "Reopenable")).toBeHidden()
  await page.goForward()
  await expect(dialog(page, "Reopenable")).toBeVisible()
  await page.goBack()
  await expect(dialog(page, "Reopenable")).toBeHidden()
  // Forward arrives from an entry the router listens on, so it sees a visit to the same page; nothing remounts.
  expect((await stats(page)).homeSetups).toBe(1)
  expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")
})

test("an overlay that opts out leaves history alone", async ({ page }) => {
  await start(page)
  const before = await length(page)
  await page.getByRole("button", { name: "Open routed" }).click()
  await expect(dialog(page, "Routed")).toBeVisible()
  await page.waitForTimeout(100)
  expect(await length(page)).toBe(before)
})

test("a drawer closes on Back as well", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open drawer" }).click()
  await expect(dialog(page, "Drawer")).toBeVisible()
  await page.goBack()
  await expect(dialog(page, "Drawer")).toBeHidden()
  expect((await stats(page)).navigations).toBe(1)
})

test("a route change closes overlays, and Back afterwards returns to the page in one press", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open outer" }).click()
  const outer = dialog(page, "Outer")
  await outer.getByRole("tab", { name: "Two" }).click()
  await expect(outer.getByText("Tab is two")).toBeVisible()
  await outer.getByRole("link", { name: "Go to other page" }).click()
  await expect(page.getByText("Other page")).toBeVisible()
  await expect(outer).toBeHidden()

  await page.goBack()
  await expect(page.getByText("Home page")).toBeVisible()
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()
  await expect(outer).toBeHidden()
  await page.goForward()
  await expect(page.getByText("Other page")).toBeVisible()
})

test("router.push from script closes overlays too", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open outer" }).click()
  await expect(dialog(page, "Outer")).toBeVisible()
  await page.evaluate(() => (window as unknown as { overlayRouter: { push(to: string): Promise<unknown> } }).overlayRouter.push("/other"))
  await expect(page.getByText("Other page")).toBeVisible()
  await page.goBack()
  await expect(page.getByText("Home page")).toBeVisible()
  await expect(dialog(page, "Outer")).toBeHidden()
  await page.getByRole("button", { name: "Open outer" }).click()
  await expect(dialog(page, "Outer")).toBeVisible()
  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
  await expect(page.getByText("Home page")).toBeVisible()
})

test("a guard that keeps the overlay open on Back keeps its entry", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open guarded" }).click()
  await expect(dialog(page, "Guarded")).toBeVisible()
  await page.goBack()
  const ask = page.getByRole("alertdialog", { name: "Discard changes?" })
  await expect(ask).toBeVisible()
  await ask.getByRole("button", { name: "Keep editing" }).click()
  await expect(ask).toBeHidden()
  await expect(dialog(page, "Guarded")).toBeVisible()
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay?.depth ?? null)).toBe(1)

  await page.goBack()
  await expect(ask).toBeVisible()
  await ask.getByRole("button", { name: "Discard" }).click()
  await expect(dialog(page, "Guarded")).toBeHidden()
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()
  expect((await stats(page)).homeSetups).toBe(1)
})

test("a jump of several entries from an overlay still navigates", async ({ page }) => {
  await start(page)
  type Router = { push(to: string): Promise<unknown> }
  await page.evaluate(() => (window as unknown as { overlayRouter: Router }).overlayRouter.push("/other"))
  await expect(page.getByText("Other page")).toBeVisible()
  await page.evaluate(() => (window as unknown as { overlayRouter: Router }).overlayRouter.push("/"))
  await expect(page.getByText("Home page")).toBeVisible()
  await page.getByRole("button", { name: "Open outer" }).click()
  await expect(dialog(page, "Outer")).toBeVisible()
  await page.evaluate(() => history.go(-2))
  await expect(page.getByText("Other page")).toBeVisible()
  await expect(dialog(page, "Outer")).toBeHidden()
  await page.goForward()
  await expect(page.getByText("Home page")).toBeVisible()
})

test("an overlay the app keeps in the query through replace stays closed when closed", async ({ page }) => {
  await start(page)
  await page.getByRole("button", { name: "Open in query" }).click()
  await expect(dialog(page, "Item 7")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog(page, "Item 7")).toBeHidden()
  await page.waitForTimeout(300)
  await expect(dialog(page, "Item 7")).toBeHidden()
  expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")
  await expect.poll(() => page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()
  expect((await page.evaluate(() => history.state)).current).toBe("/?scenario=overlay-history")

  await page.goto(URL + "&item=7")
  await expect(dialog(page, "Item 7")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  await expect(dialog(page, "Item 7")).toBeHidden()
  expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")

  await page.getByRole("button", { name: "Open in query" }).click()
  await expect(dialog(page, "Item 7")).toBeVisible()
  await page.goBack()
  await page.waitForTimeout(300)
  await expect(dialog(page, "Item 7")).toBeHidden()
  expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")
  expect((await stats(page)).homeSetups).toBe(1)
})

type Engine = { silent: number; waiting: unknown[]; live: unknown[]; dead: Map<string, unknown>; closed: Map<string, unknown> }
const engine = (page: Page) =>
  page.evaluate(() => {
    const s = (globalThis as unknown as Record<symbol, Engine>)[Symbol.for("@leavepulse/ui:overlay-history")]!
    return { silent: s.silent, waiting: s.waiting.length, live: s.live.length, dead: s.dead.size, closed: s.closed.size }
  })
const push = (page: Page, path: string) => page.evaluate((to) => (window as unknown as { overlayRouter: { push(to: string): Promise<unknown> } }).overlayRouter.push(to), path)
const other = (page: Page) => page.getByText("Other page")
const home = (page: Page) => page.getByText("Home page")
const onKitEntry = (page: Page) => page.evaluate(() => history.state?.__lpOverlay ?? null)

async function open(page: Page, name = "Outer") {
  await page.getByRole("button", { name: `Open ${name.toLowerCase()}` }).click()
  await expect(dialog(page, name)).toBeVisible()
}

for (const installed of ["before", "after"]) {
  test(`another wrapper of pushState added ${installed} the engine's works alongside it`, async ({ page }) => {
    await start(page)
    const wrap = () =>
      page.evaluate(() => {
        const calls = { push: 0, replace: 0 }
        Object.assign(window, { wrapperCalls: calls })
        const { pushState, replaceState } = history
        history.pushState = function (...args: Parameters<History["pushState"]>) {
          calls.push++
          return pushState.apply(history, args)
        }
        history.replaceState = function (...args: Parameters<History["replaceState"]>) {
          calls.replace++
          return replaceState.apply(history, args)
        }
      })
    if (installed === "before") await wrap()
    await open(page)
    await page.goBack()
    await expect(dialog(page, "Outer")).toBeHidden()
    if (installed === "after") await wrap()

    await open(page)
    await push(page, "/other")
    await expect(other(page)).toBeVisible()
    await expect.poll(async () => (await engine(page)).live).toBe(0)
    await page.goBack()
    await expect(home(page)).toBeVisible()
    await expect.poll(() => onKitEntry(page)).toBeNull()
    expect(await page.evaluate(() => (window as unknown as { wrapperCalls: { push: number } }).wrapperCalls.push)).toBeGreaterThan(0)
  })
}

test("a step the browser never carries out does not stall the engine", async ({ page }) => {
  await start(page)
  await open(page)
  await page.evaluate(() => {
    const go = history.go
    history.go = function () {
      history.go = go
    }
  })
  await page.keyboard.press("Escape")
  await expect(dialog(page, "Outer")).toBeHidden()
  await expect.poll(async () => (await engine(page)).silent, { timeout: 5000 }).toBe(0)

  await open(page)
  await expect.poll(async () => (await engine(page)).live).toBe(1)
  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
  await push(page, "/other")
  await expect(other(page)).toBeVisible()
})

test("hundreds of opens and closes leave nothing behind", async ({ page }) => {
  await start(page)
  const position = (await page.evaluate(() => history.state)).position
  await page.evaluate(async () => {
    const { setOuter } = window as unknown as { setOuter(v: boolean): void }
    const until = async (done: () => boolean) => {
      while (!done()) await new Promise((next) => setTimeout(next, 2))
    }
    const marked = () => !!history.state?.__lpOverlay
    for (let i = 0; i < 250; i++) {
      setOuter(true)
      await until(marked)
      setOuter(false)
      await until(() => !marked())
    }
  })
  await expect.poll(() => engine(page)).toEqual({ silent: 0, waiting: 0, live: 0, dead: 0, closed: 0 })
  expect((await page.evaluate(() => history.state)).position).toBe(position)
  await open(page)
  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
})

test("past the limit of buried entries the recent ones are still skipped", async ({ page }) => {
  test.setTimeout(90_000)
  await start(page)
  await page.evaluate(async () => {
    const { setOuter, overlayRouter } = window as unknown as { setOuter(v: boolean): void; overlayRouter: { push(to: string): Promise<unknown> } }
    const until = async (done: () => boolean) => {
      while (!done()) await new Promise((next) => setTimeout(next, 2))
    }
    const marked = () => !!history.state?.__lpOverlay
    for (let i = 0; i < 205; i++) {
      setOuter(true)
      await until(marked)
      await overlayRouter.push("/other")
      history.back()
      await until(() => !location.pathname.endsWith("/other") && !marked())
      await until(() => !!document.querySelector("button"))
    }
  })
  await expect.poll(async () => (await engine(page)).dead).toBe(200)
  await open(page)
  await push(page, "/other")
  await expect(other(page)).toBeVisible()
  await page.goBack()
  await expect(home(page)).toBeVisible()
  await expect.poll(() => onKitEntry(page)).toBeNull()
})

test("Forward through an entry buried by a route change reaches that page", async ({ page }) => {
  await start(page)
  await open(page)
  await push(page, "/other")
  await expect(other(page)).toBeVisible()
  await page.goBack()
  await expect(home(page)).toBeVisible()
  await expect.poll(() => onKitEntry(page)).toBeNull()
  await page.goForward()
  await expect(other(page)).toBeVisible()
  expect((await engine(page)).live).toBe(0)
  await page.goBack()
  await expect(home(page)).toBeVisible()
})

test("an overlay Back closed does not come back past a route change", async ({ page }) => {
  await start(page)
  await open(page, "Reopenable")
  await page.goBack()
  await expect(dialog(page, "Reopenable")).toBeHidden()
  expect((await engine(page)).closed).toBe(1)
  await push(page, "/other")
  await expect(other(page)).toBeVisible()
  expect((await engine(page)).closed).toBe(0)
  await page.goBack()
  await expect(home(page)).toBeVisible()
  await expect(dialog(page, "Reopenable")).toBeHidden()
  await page.goForward()
  await expect(other(page)).toBeVisible()
})

test("a reload on an overlay's entry leaves the router listening for the next page", async ({ page }) => {
  await start(page)
  await open(page)
  await page.reload()
  await expect(home(page)).toBeVisible()
  await push(page, "/other")
  await expect(other(page)).toBeVisible()
  await page.goBack()
  await expect(home(page)).toBeVisible()
})

test("the router still navigates when the engine's listeners came first", async ({ page }) => {
  await page.goto(`${URL}&order=late`)
  await expect(home(page)).toBeVisible()
  await open(page)
  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
  expect((await stats(page)).homeSetups).toBe(1)
  await open(page)
  await push(page, "/other")
  await expect(other(page)).toBeVisible()
  await page.goBack()
  await expect(home(page)).toBeVisible()
})

test("Back pressed twice in a row closes nested overlays without a navigation", async ({ page }) => {
  await start(page)
  await open(page)
  await page.getByRole("button", { name: "Open inner" }).click()
  await expect(dialog(page, "Inner")).toBeVisible()
  await page.evaluate(() => {
    history.back()
    history.back()
  })
  await expect(dialog(page, "Outer")).toBeHidden()
  await expect(dialog(page, "Inner")).toBeHidden()
  await expect.poll(async () => (await engine(page)).live).toBe(0)
  expect((await stats(page)).navigations).toBe(1)
})

test("Back pressed while the engine's own step is on its way does not wedge it", async ({ page }) => {
  await start(page)
  await push(page, "/other")
  await push(page, "/")
  await expect(home(page)).toBeVisible()
  await open(page)
  await page.evaluate(() => {
    ;(window as unknown as { setOuter(v: boolean): void }).setOuter(false)
    setTimeout(() => history.back(), 0)
  })
  await expect(other(page)).toBeVisible()
  await expect.poll(async () => (await engine(page)).silent, { timeout: 5000 }).toBe(0)
  await page.goForward()
  await expect(home(page)).toBeVisible()
  await open(page)
  await page.goBack()
  await expect(dialog(page, "Outer")).toBeHidden()
  await expect(home(page)).toBeVisible()
})

for (const name of ["lightbox", "palette"]) {
  test(`Back closes the ${name} without leaving the page`, async ({ page }) => {
    await page.goto(URL)
    await page.getByRole("button", { name: `Open ${name}`, exact: true }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.goBack()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText("Home page")).toBeVisible()
    expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")
  })
}

type Pusher = { push(to: unknown): Promise<unknown> }
for (const how of ["close, then push", "push, then close", "a link inside that closes on click"]) {
  test(`closing an overlay and navigating in one tick lands on the new page: ${how}`, async ({ page }) => {
    await start(page)
    await page.getByRole("button", { name: "Open outer" }).click()
    const outer = dialog(page, "Outer")
    await expect(outer).toBeVisible()
    if (how === "a link inside that closes on click") await outer.getByRole("link", { name: "Close and go" }).click()
    else
      await page.evaluate((how) => {
        const w = window as unknown as { overlayRouter: Pusher; setOuter(v: boolean): void }
        const go = () => void w.overlayRouter.push({ path: "/other", query: { user: "1" } })
        if (how === "close, then push") { w.setOuter(false); go() }
        else { go(); w.setOuter(false) }
      }, how)
    await expect(page.getByText("Other page")).toBeVisible()
    await expect.poll(() => page.evaluate(() => location.pathname + location.search)).toBe("/tests/browser/other?user=1")
    expect(await page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()

    await page.goBack()
    await expect(page.getByText("Home page")).toBeVisible()
    await expect(outer).toBeHidden()
    expect(await page.evaluate(() => location.search)).toBe("?scenario=overlay-history")
    expect(await page.evaluate(() => history.state?.__lpOverlay ?? null)).toBeNull()
  })
}
