import { expect, settledBox, test } from "./fixtures"

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

const ENTRY = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden]), textarea, [contenteditable=true]"

async function smallEntries(scope: import("@playwright/test").Locator) {
  return scope.evaluate((root, selector) => [...root.querySelectorAll<HTMLElement>(selector)]
    .filter((el) => el.getClientRects().length && parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${el.getAttribute("aria-label") ?? el.closest("[aria-label]")?.getAttribute("aria-label") ?? el.tagName} ${getComputedStyle(el).fontSize}`), ENTRY)
}

test("text entries are at least 16px on a phone so iOS does not zoom on focus", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=mobile")
  const entries = page.getByRole("region", { name: "Entries" })
  await page.getByRole("button", { name: /Edit Name/ }).click()
  expect(await smallEntries(entries)).toEqual([])
  await page.getByRole("button", { name: "Searchable, Alpha" }).click()
  const listbox = page.getByRole("listbox")
  await expect(listbox).toBeVisible()
  expect(await smallEntries(page.locator("[data-reka-popper-content-wrapper]"))).toEqual([])
})

test("an editable code block keeps its highlighted text under the caret at 16px", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=mobile")
  const editor = page.locator("textarea.lp-entry").last()
  const sizes = await editor.evaluate((el) => [getComputedStyle(el).fontSize, getComputedStyle(el.nextElementSibling!).fontSize])
  expect(sizes).toEqual(["16px", "16px"])
})

// Opening animations and transitions finished: a panel sliding or rising into
// place passes through the right spot on its way, or has not left yet.
// Only what moves the target counts (its own and its ancestors' animations), not
// a toast's countdown bar inside it.
async function settled(target: import("@playwright/test").Locator) {
  await target.evaluate((el) => new Promise<void>((done) => {
    const moving = () => document.getAnimations().some((a) => {
      const node = (a.effect as KeyframeEffect | null)?.target
      return a.playState === "running" && !!node && node.contains(el)
    })
    const check = () => (moving() ? requestAnimationFrame(check) : done())
    check()
  }))
}

async function insideWindow(page: import("@playwright/test").Page, panel: import("@playwright/test").Locator) {
  await expect(panel).toBeVisible()
  await settled(panel)
  const box = await settledBox(panel)
  const size = page.viewportSize()!
  expect([box.x >= 0, box.y >= 0, box.x + box.width <= size.width + 0.5, box.y + box.height <= size.height + 0.5]).toEqual([true, true, true, true])
}

test.describe("narrow phone", () => {
  test.use({ viewport: { width: 360, height: 740 } })
  test("a wide popover and a long menu label stay inside the screen", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    await page.getByRole("button", { name: "Open popover" }).click()
    await insideWindow(page, page.getByRole("dialog", { name: "Wide popover" }))
    await page.mouse.click(5, 5)
    await page.getByRole("button", { name: "Open menu" }).click()
    await insideWindow(page, page.getByRole("menu"))
  })
})

test.describe("landscape phone", () => {
  test.use({ viewport: { width: 844, height: 390 } })
  test("a date picker and a colour picker that cannot fit scroll inside the screen instead of hanging off it", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    await page.getByRole("button", { name: "Date" }).first().click()
    const panel = page.getByRole("dialog")
    await insideWindow(page, panel)
    expect(await panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    await page.keyboard.press("Escape")
    await expect(panel).toHaveCount(0)
    await page.getByRole("button", { name: /Colour/ }).first().click()
    await insideWindow(page, page.getByRole("dialog"))
  })
})

test.describe("landscape phone list", () => {
  test.use({ viewport: { width: 844, height: 390 } })
  test("a long select list fits under its field and scrolls to the last option", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    const trigger = page.getByRole("button", { name: "Many, Option 1" })
    await trigger.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120))
    await trigger.click()
    const panel = page.locator("[data-reka-popper-content-wrapper] > *")
    await insideWindow(page, panel)
    const last = page.getByRole("option", { name: "Option 30" })
    await last.scrollIntoViewIfNeeded()
    const box = (await last.boundingBox())!
    const panelBox = (await panel.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 0.5)
  })
})

type Insets = { top: number; right: number; bottom: number; left: number }

async function notchedPage(page: import("@playwright/test").Page, insets: Insets) {
  await page.goto("/tests/browser/?scenario=mobile")
  // A page drawing under the notch says so with viewport-fit=cover; only then
  // does env(safe-area-inset-*) report anything.
  await page.evaluate(() => document.querySelector("meta[name=viewport]")!.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover"))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets } as never)
}

async function clearOfInsets(page: import("@playwright/test").Page, target: import("@playwright/test").Locator, insets: Insets) {
  await expect(target).toBeVisible()
  const size = page.viewportSize()!
  await settled(target)
  const box = await settledBox(target)
  expect([box.y >= insets.top, box.x >= insets.left, box.x + box.width <= size.width - insets.right + 0.5, box.y + box.height <= size.height - insets.bottom + 0.5]).toEqual([true, true, true, true])
}

test.describe("notched phone", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "safe-area insets are emulated through Chromium's DevTools protocol")
  const portrait = { top: 47, right: 0, bottom: 34, left: 0 }
  const landscape = { top: 0, right: 47, bottom: 21, left: 47 }

  test("drawer, modal, lightbox and toasts keep their controls clear of the notch and home indicator", async ({ page }) => {
    await notchedPage(page, portrait)
    await page.getByRole("button", { name: "Open drawer" }).click()
    await clearOfInsets(page, page.getByRole("dialog").getByRole("button", { name: "Close" }), portrait)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.getByRole("button", { name: "Open modal" }).click()
    await clearOfInsets(page, page.getByRole("dialog"), portrait)
    await page.getByRole("button", { name: "Done" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.getByRole("button", { name: "Open lightbox" }).click()
    for (const button of await page.getByRole("dialog").getByRole("button").all()) await clearOfInsets(page, button, portrait)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.getByRole("button", { name: "Toast" }).click()
    await clearOfInsets(page, page.locator("[data-lp-toasts] li").first(), portrait)
  })

  test.describe("landscape", () => {
    test.use({ viewport: { width: 844, height: 390 } })
    test("a bottom sheet and a lightbox stay clear of the side notch", async ({ page }) => {
      await notchedPage(page, landscape)
      await page.getByRole("button", { name: "Open sheet" }).click()
      await clearOfInsets(page, page.getByRole("dialog").getByRole("button", { name: "Close" }), landscape)
      await clearOfInsets(page, page.getByLabel("Sheet field"), landscape)
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page.getByRole("button", { name: "Open lightbox" }).click()
      for (const button of await page.getByRole("dialog").getByRole("button").all()) await clearOfInsets(page, button, landscape)
    })
  })
})
