import { expect, test } from "bun:test"
import { coverScale, cropGeometry, exportType, imageTypeFromUrl, isSideways, uprightToSource } from "../src/components/imageCrop"

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6)

test("a quarter turn covers with the swapped dimensions", () => {
  close(coverScale(400, 200, 100, 100, 90), Math.max(100 / 200, 100 / 400))
  close(coverScale(400, 200, 200, 100, 0), Math.max(200 / 400, 100 / 200))
})

test("a free angle needs more cover than its bounding box", () => {
  const straight = coverScale(400, 300, 400, 300, 0)
  const tilted = coverScale(400, 300, 400, 300, 7)
  expect(tilted).toBeGreaterThan(straight)
})

test("upright points map back to the right source pixels", () => {
  // 180°: the upright left half is the source's right half.
  const left = uprightToSource({ x: -50, y: 0 }, 180, 200, 100)
  close(left.x, 150)
  close(left.y, 50)
  // 90° clockwise: the source's top edge ends up on the right.
  const right = uprightToSource({ x: 50, y: 0 }, 90, 200, 100)
  close(right.x, 100)
  close(right.y, 0)
  // 270°: the source's top edge ends up on the left.
  const leftEdge = uprightToSource({ x: -50, y: 0 }, 270, 200, 100)
  close(leftEdge.x, 100)
  close(leftEdge.y, 0)
  // A full turn and its negative are the identity.
  const same = uprightToSource({ x: 10, y: 20 }, -360, 200, 100)
  close(same.x, 110)
  close(same.y, 70)
})

test("panning moves the crop centre against the pan", () => {
  const crop = cropGeometry({
    sourceWidth: 400,
    sourceHeight: 200,
    frameWidth: 200,
    frameHeight: 100,
    rotation: 180,
    scale: 2,
    offset: { x: 25, y: 0 },
  })
  close(crop.cover, 0.5)
  close(crop.width, 200)
  close(crop.height, 100)
  close(crop.centre.x, -50)
  // Picture panned right shows its upright left part, which at 180° is the
  // source's right half.
  const source = uprightToSource(crop.centre, 180, 400, 200)
  close(source.x, 250)
})

test("only near-quarter turns count as sideways", () => {
  expect(isSideways(0)).toBe(false)
  expect(isSideways(7)).toBe(false)
  expect(isSideways(90)).toBe(true)
  expect(isSideways(-90)).toBe(true)
  expect(isSideways(97)).toBe(true)
  expect(isSideways(180)).toBe(false)
})

test("an address's type comes from its extension, ignoring the query", () => {
  expect(imageTypeFromUrl("https://x.test/a/photo.JPG?w=200#top")).toBe("image/jpeg")
  expect(imageTypeFromUrl("https://x.test/logo.svg")).toBe("image/svg+xml")
  expect(imageTypeFromUrl("https://x.test/render?id=4")).toBe("")
  expect(imageTypeFromUrl("data:image/webp;base64,AAAA")).toBe("image/webp")
})

test("a source export keeps an encodable type and falls back to PNG", () => {
  expect(exportType("image/jpeg", "image/png")).toBe("image/jpeg")
  expect(exportType("source", "image/webp")).toBe("image/webp")
  expect(exportType("source", "image/gif")).toBe("image/png")
  expect(exportType("source", "")).toBe("image/png")
})
