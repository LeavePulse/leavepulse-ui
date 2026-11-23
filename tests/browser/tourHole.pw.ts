import { expect, test } from "./fixtures"
import type { Page } from "@playwright/test"

/*
 * The lit target must come through the scrim as it is: neither blurred nor
 * dimmed. Under an ancestor with a rounded clip Chromium once dropped the
 * scrim's hole from its backdrop-filter, so the target was blurred with the
 * rest; a DOM check saw the hole in the style and passed, so this reads the
 * pixels. The target is fine black-and-white stripes: any blur greys them out.
 */

type Stats = { edges: number; light: number }

// Edge strength (mean step between neighbouring pixels) and mean brightness
// of a PNG, decoded by the browser itself so the suite needs no image library.
async function stats(page: Page, png: Buffer): Promise<Stats> {
  return page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(img, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height)
    const grey = (x: number, y: number) => {
      const i = (y * width + x) * 4
      return (data[i] + data[i + 1] + data[i + 2]) / 3
    }
    let edges = 0
    let light = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        light += grey(x, y)
        if (x > 0) edges += Math.abs(grey(x, y) - grey(x - 1, y))
      }
    }
    return { edges: edges / (width * height), light: light / (width * height) }
  }, `data:image/png;base64,${png.toString("base64")}`)
}

for (const clip of ["path", "overflow"] as const) {
  test(`the tour's hole stays sharp and undimmed under a rounded ${clip} clip`, async ({ page }) => {
    await page.goto(`/tests/browser/?scenario=tour-hole&clip=${clip}`)
    const target = page.locator("#sharp")
    const plain = await stats(page, await target.screenshot({ animations: "disabled" }))

    await page.getByRole("button", { name: "Start tour" }).click()
    await expect(page.getByRole("dialog", { name: "Sharp target" })).toBeVisible()
    // The scrim fades in and its blur eases in; both settle well inside this.
    await expect.poll(async () => {
      const lit = await stats(page, await target.screenshot({ animations: "disabled" }))
      return lit.edges / plain.edges > 0.9 && lit.light / plain.light > 0.9
    }).toBe(true)

    // The page around the hole is dimmed, so the scrim is there at all.
    const around = await stats(page, await page.screenshot({ clip: { x: 400, y: 400, width: 100, height: 100 } }))
    expect(around.light).toBeLessThan(200)
  })
}

// The hole eases to the next target with the ring around it. .lp-scrim's own
// transition once outranked the glide's utility and the hole jumped ahead.
test("the tour's hole glides to the next target", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=tour-hole&clip=path")
  await page.getByRole("button", { name: "Start tour" }).click()
  await expect(page.getByRole("dialog", { name: "Sharp target" })).toBeVisible()
  await page.evaluate(() => {
    const seen: string[] = []
    Object.assign(window, { seen })
    document.querySelector(".lp-tour .lp-scrim")!.addEventListener("transitionrun", (event) => seen.push((event as TransitionEvent).propertyName))
  })
  await page.getByRole("button", { name: "Next" }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toContain("mask-size")
})
