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

// A finger resting on the screen: Chromium turns these into touch pointer
// events, which Playwright's tap cannot hold.
async function hold(page: import("@playwright/test").Page, target: import("@playwright/test").Locator, ms = 700) {
  await target.scrollIntoViewIfNeeded()
  const box = (await target.boundingBox())!
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] })
  await page.waitForTimeout(ms)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await cdp.detach()
}

test.describe("touch hold", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "touches are sent through Chromium's DevTools protocol")

  test("a press-and-hold shows a tooltip without pressing the button, and the next touch hides it", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    const button = page.getByRole("button", { name: "Has tooltip" })
    // reka's visible tip carries no role (a hidden copy does), so it is found by its panel.
    const tip = page.locator("[data-reka-popper-content-wrapper]", { hasText: "Tooltip text" })
    await hold(page, button)
    await expect(tip).toBeVisible()
    // Still there after the finger has gone, and the press did not press the button.
    await page.waitForTimeout(400)
    await expect(tip).toBeVisible()
    await expect(page.getByLabel("Tip clicks")).toHaveText("0")
    await page.touchscreen.tap(5, 5)
    await expect(tip).toHaveCount(0)
    await button.tap()
    await expect(page.getByLabel("Tip clicks")).toHaveText("1")
  })

  test("a press-and-hold still opens a hover card", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    await hold(page, page.getByRole("link", { name: "Hover card" }))
    await expect(page.getByText("Card body")).toBeVisible()
  })
})

test("a column filter shows its Only buttons on a touch screen, where there is no hover to reveal them", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=table&part=layouts")
  await page.getByRole("button", { name: "Filter Site" }).click()
  const only = page.getByRole("button", { name: "Only" }).first()
  await expect(only).toBeVisible()
  await expect.poll(() => only.evaluate((el) => getComputedStyle(el).opacity)).toBe("1")
})

test.describe("fingertip targets", () => {
  // What a thumb landing 19px from a control's centre (inside a 40px square)
  // actually presses.
  async function reach(control: import("@playwright/test").Locator) {
    return control.evaluate((el) => {
      el.scrollIntoView({ block: "center" })
      const box = el.getBoundingClientRect()
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      return [[0, -19], [0, 19], [-19, 0], [19, 0]].map(([dx, dy]) => {
        const hit = document.elementFromPoint(cx + dx, cy + dy)
        return !!hit && (el === hit || el.contains(hit)) ? true : `${dx},${dy}:${hit?.tagName}.${hit?.className}`.slice(0, 120)
      })
    })
  }

  test("small controls answer a thumb within 40px of their centre without growing", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    const targets = page.getByRole("region", { name: "Targets" })
    const controls = [
      targets.getByRole("checkbox", { name: "Tick" }),
      targets.getByRole("switch", { name: "Toggle" }),
      targets.getByRole("radio", { name: "Second" }),
      targets.getByRole("button", { name: "Tiny" }),
      page.getByRole("button", { name: "Remove alpha" }),
    ]
    for (const control of controls) {
      const size = async () => control.evaluate((el) => [el.offsetWidth, el.offsetHeight])
      const before = await size()
      expect(await reach(control), await control.evaluate((el) => el.outerHTML.slice(0, 80))).toEqual([true, true, true, true])
      expect(await size()).toEqual(before)
    }
    // A segment answers above and below; beside it is its neighbour.
    const segment = targets.getByRole("button", { name: "One" })
    expect((await reach(segment)).slice(0, 2)).toEqual([true, true])
  })

  test("menu rows are a thumb tall on a touch screen", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    await page.getByRole("button", { name: "Open menu" }).click()
    const row = page.getByRole("menuitem", { name: "Rename" })
    await expect(row).toBeVisible()
    expect(await row.evaluate((el) => (el as HTMLElement).offsetHeight)).toBeGreaterThanOrEqual(40)
  })
})

// Fingers moved in steps, as the screen reports them.
async function gesture(page: import("@playwright/test").Page, from: { x: number; y: number }[], to: { x: number; y: number }[], steps = 8) {
  const cdp = await page.context().newCDPSession(page)
  const at = (t: number) => from.map((p, i) => ({ x: p.x + (to[i].x - p.x) * t, y: p.y + (to[i].y - p.y) * t, id: i }))
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) })
  for (let s = 1; s <= steps; s++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(s / steps) })
    await page.waitForTimeout(16)
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await cdp.detach()
}

test.describe("touch gestures", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "touches are sent through Chromium's DevTools protocol")

  test("the lightbox zooms with two fingers and pages with a swipe", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    await page.getByRole("button", { name: "Open lightbox" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("1 / 2")).toBeVisible()
    await gesture(page, [{ x: 300, y: 420 }], [{ x: 80, y: 425 }])
    await expect(dialog.getByText("2 / 2")).toBeVisible()
    await gesture(page, [{ x: 80, y: 420 }], [{ x: 300, y: 425 }])
    await expect(dialog.getByText("1 / 2")).toBeVisible()
    await settled(dialog.getByRole("img").first())
    // Fingers parting sideways zoom in; they do not also turn the page.
    await gesture(page, [{ x: 175, y: 420 }, { x: 215, y: 420 }], [{ x: 95, y: 420 }, { x: 295, y: 420 }])
    await expect(dialog.getByText(/^\s*\d+%\s*$/)).toBeVisible()
    await expect(dialog.getByText("1 / 2")).toBeVisible()
  })
})

test.describe("touch gestures on the page", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "touches are sent through Chromium's DevTools protocol")

  test("the image editor zooms with two fingers instead of the page", async ({ page }) => {
    await page.goto("/tests/browser/?scenario=mobile")
    const canvas = page.getByRole("application")
    await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await settled(canvas)
    const box = (await canvas.boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await gesture(page, [{ x: cx - 20, y: cy }, { x: cx + 20, y: cy }], [{ x: cx - 90, y: cy }, { x: cx + 90, y: cy }])
    await expect(page.getByRole("region", { name: "Editor" }).getByRole("button", { name: "Reset" })).toBeVisible()
    // Zoomed, a finger dragging over the picture moves the picture, not the page.
    const picture = canvas.locator("img")
    const before = [await page.evaluate(() => scrollY), await picture.evaluate((el) => el.getAttribute("style"))]
    await gesture(page, [{ x: cx, y: cy + 40 }], [{ x: cx, y: cy - 40 }])
    const after = [await page.evaluate(() => scrollY), await picture.evaluate((el) => el.getAttribute("style"))]
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
  })
})
