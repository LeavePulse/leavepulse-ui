import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

type Canvas = {
  focusNode(id: string): Promise<boolean>
  autoLayout(): void
  exportSvg(): string | null
  exportPng(): Promise<Blob | null>
  selectNodes(ids: string[]): void
}

const open = async (page: Page, mode: string) => {
  await page.goto(`/tests/browser/?scenario=topology&mode=${mode}`)
  await expect(page.locator(".vue-flow__node").first()).toBeVisible()
}
const node = (page: Page, id: string) => page.locator(`.vue-flow__node[data-id="${id}"]`)
const edge = (page: Page, id: string) => page.locator(`.vue-flow__edge[data-id="${id}"] path`).first()
const log = (page: Page) => page.locator("[data-test-log]")

test("an edge prints what was measured on it", async ({ page }) => {
  await open(page, "plain")
  await expect(page.locator(".vue-flow__edge-text").filter({ hasText: "wg · 12 ms · 0.5% loss" })).toHaveCount(1)
})

test("picking a node fades what is not connected, and the pane restores it", async ({ page }) => {
  await open(page, "neighbors")
  await node(page, "a").click()
  await expect.poll(() => edge(page, "bc").evaluate((el) => (el as HTMLElement).style.opacity)).toBe("0.12")
  await expect.poll(() => edge(page, "ab").evaluate((el) => (el as HTMLElement).style.opacity)).toBe("1")
  await page.locator(".vue-flow__pane").click({ position: { x: 5, y: 600 } })
  await expect.poll(() => edge(page, "bc").evaluate((el) => (el as HTMLElement).style.opacity)).toBe("1")
})

test("a node dragged by the user keeps its place through a highlight", async ({ page }) => {
  await open(page, "neighbors")
  const target = await node(page, "d").boundingBox()
  await page.mouse.move(target!.x + 20, target!.y + 20)
  await page.mouse.down()
  await page.mouse.move(target!.x + 80, target!.y + 60, { steps: 5 })
  await page.mouse.up()
  const moved = await node(page, "d").boundingBox()
  await node(page, "a").click()
  await expect.poll(() => edge(page, "bc").evaluate((el) => (el as HTMLElement).style.opacity)).toBe("0.12")
  expect((await node(page, "d").boundingBox())!.x).toBeCloseTo(moved!.x, 0)
})

test("a path reports its route and stands out", async ({ page }) => {
  await open(page, "path")
  await expect(log(page)).toContainText('"nodes":["a","b","c"]')
  await expect.poll(() => edge(page, "bd").evaluate((el) => (el as HTMLElement).style.opacity)).toBe("0.12")
  await expect.poll(() => edge(page, "ab").evaluate((el) => (el as HTMLElement).style.strokeWidth)).toBe("3.5")
})

test("search counts matches and brings the match into view", async ({ page }) => {
  await open(page, "search")
  const box = page.getByRole("searchbox", { name: "Find a node" }).or(page.getByLabel("Find a node"))
  await box.first().fill("Host c")
  await expect(page.getByText("1 found")).toBeVisible()
  await box.first().press("Enter")
  await expect(log(page)).toContainText('"selected":"c"')
  await expect(box.first()).toBeFocused()
})

test("a filtered edge is gone", async ({ page }) => {
  await open(page, "filter")
  await expect(page.locator('.vue-flow__edge[data-id="ab"]')).toHaveCount(1)
  await expect(page.locator('.vue-flow__edge[data-id="bc"]')).toHaveCount(0)
})

test("a group of selected nodes gets its actions", async ({ page }) => {
  await open(page, "select")
  await page.evaluate(() => (window as unknown as { canvas: Canvas }).canvas.selectNodes(["a", "b"]))
  const restart = page.getByRole("button", { name: "Restart" })
  await expect(restart.locator("svg")).toHaveCount(1)
  await restart.click()
  await expect(log(page)).toContainText('{"action":"restart","ids":["a","b"]}')
})

test("a diff marks what is new", async ({ page }) => {
  await open(page, "diff")
  await expect.poll(() => node(page, "c").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid")
  expect(await node(page, "a").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none")
})

test("the timeline steps back to an earlier version", async ({ page }) => {
  await open(page, "timeline")
  await expect(node(page, "c")).toHaveCount(1)
  await expect(page.getByText("Tuesday")).toBeVisible()
  const thumb = page.getByRole("slider", { name: "Version" })
  await thumb.focus()
  await page.keyboard.press("ArrowLeft")
  await expect(page.getByText("Monday")).toBeVisible()
  await expect(node(page, "c")).toHaveCount(0)
})

test("arrow keys walk between nodes without moving them", async ({ page }) => {
  await open(page, "keys")
  await node(page, "a").focus()
  const before = await node(page, "a").getAttribute("style")
  await page.keyboard.press("ArrowRight")
  await expect(node(page, "b")).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(log(page)).toContainText('"activated":"b"')
  expect(await node(page, "a").getAttribute("style")).toBe(before)
})

test("auto layout places the graph and reports it", async ({ page }) => {
  await open(page, "plain")
  await page.evaluate(() => (window as unknown as { canvas: Canvas }).canvas.autoLayout())
  await expect(log(page)).toContainText('"laidOut":4')
  await expect.poll(async () => {
    const [a, b] = [await node(page, "a").boundingBox(), await node(page, "b").boundingBox()]
    return a!.x < b!.x
  }).toBe(true)
})

test("export gives an SVG and a PNG", async ({ page }) => {
  await open(page, "plain")
  const svg = await page.evaluate(() => (window as unknown as { canvas: Canvas }).canvas.exportSvg())
  expect(svg).toContain("Host a")
  expect(svg).toContain("12 ms")
  const png = await page.evaluate(async () => {
    const blob = await (window as unknown as { canvas: Canvas }).canvas.exportPng()
    return { type: blob?.type, size: blob?.size ?? 0 }
  })
  expect(png.type).toBe("image/png")
  expect(png.size).toBeGreaterThan(1000)
})

test("a frame grows to hold its service", async ({ page }) => {
  await open(page, "frame")
  await expect.poll(() => node(page, "host").evaluate((el) => Number.parseFloat((el as HTMLElement).style.width))).toBeGreaterThan(400)
})

test("simple detail leaves services out and moves their edges up", async ({ page }) => {
  await page.goto("/tests/browser/?scenario=topology&mode=simple")
  await expect(node(page, "a")).toBeVisible()
  await expect(page.locator('.vue-flow__edge')).toHaveCount(3)
})

test("overview folds each group into one node", async ({ page }) => {
  await open(page, "overview")
  await expect(page.locator(".vue-flow__node-infra")).toHaveCount(2)
  await expect(page.getByText("eu (2)")).toBeVisible()
})

test("group lanes wrap their nodes", async ({ page }) => {
  await open(page, "group")
  await expect(page.locator(".vue-flow__node-lane")).toHaveCount(2)
})

test("a node's status picks its light and frame; only a lost one is dashed and faded", async ({ page }) => {
  await open(page, "status")
  const card = (id: string) => page.locator(`.vue-flow__node[data-id="${id}"] > div`).first()
  const look = (id: string) =>
    card(id).evaluate((el) => {
      const s = getComputedStyle(el)
      return { dashed: s.borderTopStyle === "dashed", faded: Number(s.opacity) < 1, border: s.borderTopColor }
    })
  // Let the frame's colour transition settle before reading it.
  await page.waitForTimeout(600)
  const ok = await look("ok")
  const unmanaged = await look("unmanaged")
  const gone = await look("gone")
  const legacy = await look("legacy")
  expect(ok).toMatchObject({ dashed: false, faded: false })
  // Serving but not taking instruction is trouble, not death: its own tone, solid.
  expect(unmanaged).toMatchObject({ dashed: false, faded: false })
  expect(unmanaged.border).not.toBe(ok.border)
  expect(gone).toMatchObject({ dashed: true, faded: true })
  // The old up/down flag still reads as before.
  expect(legacy).toMatchObject({ dashed: true, faded: true })
})
