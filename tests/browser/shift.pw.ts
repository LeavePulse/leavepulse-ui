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

test("the shell's header comes to rest after the page loads", async ({ page }) => {
  // As after Ctrl+F5: nothing from the cache, so fonts and styles land late.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  // A saved theme whose name is short puts the switcher's own eased label
  // inside the eased header actions, the pair that once chased each other.
  await page.addInitScript(() => localStorage.setItem("lp-theme-studio", JSON.stringify({ theme: "Rose", brand: null, corners: "default", size: "default", motion: "normal" })))
  await page.goto("/")
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1500)
  const changes = await page.locator("header").first().evaluate((header) => new Promise<number>((done) => {
    const boxes = [...header.querySelectorAll("*")]
    const last = new Map<Element, string>()
    let moved = 0
    let frames = 0
    const sample = () => {
      for (const node of boxes) {
        const r = node.getBoundingClientRect()
        const key = `${Math.round(r.x)},${Math.round(r.width)}`
        if (last.has(node) && last.get(node) !== key) moved++
        last.set(node, key)
      }
      if (++frames < 60) requestAnimationFrame(sample)
      else done(moved)
    }
    requestAnimationFrame(sample)
  }))
  expect(changes).toBe(0)
})
