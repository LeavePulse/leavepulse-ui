import { expect, test } from "./fixtures"

test("the shell's header boxes stay out of positioning, so content can centre on the whole bar", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  await expect(header).toBeVisible()
  const positions = await header.evaluate((bar) =>
    [...bar.children].filter((child) => child.tagName === "DIV").map((child) => getComputedStyle(child).position),
  )
  expect(positions.length).toBeGreaterThan(0)
  expect(positions.every((position) => position === "static")).toBe(true)
})

test("a header action leaving fades where it stood", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  const action = header.getByRole("button", { name: /New rack/ })
  const was = (await action.boundingBox())!
  // The ghost lives for one fade; on a slow runner a round trip from the test
  // can miss it, so the page itself records where it first appeared.
  await header.evaluate((bar) => {
    const seen = new Promise<{ x: number; y: number }>((resolve) => {
      new MutationObserver((_, observer) => {
        const ghost = [...bar.querySelectorAll("[data-lp-shift-ghost]")].find((el) => el.textContent?.includes("New rack"))
        if (!ghost) return
        observer.disconnect()
        const box = ghost.getBoundingClientRect()
        resolve({ x: box.x, y: box.y })
      }).observe(bar, { childList: true, subtree: true })
    })
    Object.assign(window, { ghostSeen: seen })
  })
  await page.getByRole("button", { name: "Stock", exact: true }).click()
  const at = await page.evaluate(() => (window as unknown as { ghostSeen: Promise<{ x: number; y: number }> }).ghostSeen)
  expect(Math.abs(at.y - was.y)).toBeLessThan(2)
  expect(Math.abs(at.x - was.x)).toBeLessThan(8)
  await expect(header.locator("[data-lp-shift-ghost]").filter({ hasText: "New rack" })).toHaveCount(0)
})

test("a tab marker inside the eased title block slides instead of fading in", async ({ page }) => {
  await page.goto("/page/appshell")
  const tabs = page.getByRole("tablist", { name: "Header section" })
  await expect(tabs).toBeVisible()
  await page.waitForTimeout(400)
  const marker = () => tabs.locator("[role=tab] .absolute.z-0").first()
  const start = (await marker().boundingBox())!.x
  // Frames are sampled in the page, from before the hover until the slide is
  // over, so a slow runner's round trips cannot skip the middle of it.
  await tabs.evaluate((list) => {
    const path: number[] = []
    const until = performance.now() + 1000
    const sample = () => {
      const el = list.querySelector("[role=tab] .absolute.z-0")
      if (el) path.push(el.getBoundingClientRect().x)
      if (performance.now() < until) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    Object.assign(window, { markerPath: path })
  })
  await tabs.getByRole("tab", { name: "Devices" }).hover()
  await page.waitForTimeout(1100)
  const path = await page.evaluate(() => (window as unknown as { markerPath: number[] }).markerPath)
  const end = (await tabs.getByRole("tab", { name: "Devices" }).boundingBox())!.x
  expect(path.some((x) => x > start + 4 && x < end - 4)).toBe(true)
  expect(await marker().evaluate((el) => el.getAnimations().length)).toBe(0)
})

test("markup put back unchanged by a re-render does not flash", async ({ page }) => {
  await page.goto("/page/appshell")
  const header = page.locator("header").nth(1)
  await expect(header).toBeVisible()
  await page.waitForTimeout(400)
  const flashed = await header.evaluate(async (bar) => {
    const box = bar.querySelector("button[aria-label=Search]")!.parentElement!
    const button = box.querySelector("button[aria-label=Search]")!
    const copy = button.cloneNode(true)
    button.replaceWith(copy)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    return { ghosts: bar.querySelectorAll("[data-lp-shift-ghost]").length, fading: (copy as Element).getAnimations().length }
  })
  expect(flashed).toEqual({ ghosts: 0, fading: 0 })
})

test("going full bleed moves the same page instead of remounting it", async ({ page }) => {
  await page.goto("/page/appshell")
  const shell = page.locator("main").nth(1)
  const stat = shell.getByText("Header motion", { exact: true })
  await expect(stat).toBeVisible()
  await stat.evaluate((el) => el.setAttribute("data-kept", "yes"))
  await page.getByRole("switch", { name: "Full bleed" }).click()
  await expect(shell.locator("[id^=lp-shell-bleed-]").getByText("Header motion", { exact: true })).toHaveAttribute("data-kept", "yes")
  await page.getByRole("switch", { name: "Full bleed" }).click()
  await expect(shell.getByText("Header motion", { exact: true })).toHaveAttribute("data-kept", "yes")
  await expect(shell.locator("[id^=lp-shell-bleed-]")).toBeHidden()
})

test("a wrapping row inside a widening box stays on one line while it eases", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=shift-wrap")
  const row = page.getByTestId("row")
  await expect(row).toBeVisible()
  // A late webfont resizes the row once on its own; that tween is not the one under test.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const height = (await row.boundingBox())!.height
  await row.evaluate((el) => {
    const heights: number[] = []
    const frames: string[] = []
    const box = el.parentElement!
    const until = performance.now() + 600
    const sample = () => {
      heights.push(el.getBoundingClientRect().height)
      frames.push(`${Math.round(el.getBoundingClientRect().height)}/${Math.round(el.getBoundingClientRect().width)} box=${Math.round(box.getBoundingClientRect().width)} style=${box.style.width} var=${box.style.getPropertyValue("--lp-shift-to-w")} minw=${getComputedStyle(el).minWidth} cls=${box.className}`)
      if (performance.now() < until) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    Object.assign(window, { rowHeights: heights, rowFrames: frames })
  })
  await page.getByRole("button", { name: "Toggle" }).click()
  await page.waitForTimeout(700)
  const heights = await page.evaluate(() => (window as unknown as { rowHeights: number[] }).rowHeights)
  const settled = (await row.boundingBox())!.height
  expect(settled).toBeLessThanOrEqual(height + 1)
  const frames = await page.evaluate(() => (window as unknown as { rowFrames: string[] }).rowFrames)
  expect(Math.max(...heights), frames.join("\n")).toBeLessThanOrEqual(settled + 1)
})
