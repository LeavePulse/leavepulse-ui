import { describe, expect, test } from "bun:test"
import { shiftSpan, zoomSpan } from "../src/composables/span"
import {
  adjustRegion,
  containRect,
  dragEnd,
  normalizeRange,
  parseClipTime,
  regionBetween,
  revealTime,
  setEnd,
  shiftView,
  tickStep,
  ticks,
  zoomView,
} from "../src/components/videoTrim"
import { formatClipTime } from "../src/components/videoBackdrop"
import { stillSpan } from "../src/components/videoFrames"

const L = { duration: 100, minClip: 1, maxClip: 30 }

describe("parseClipTime", () => {
  test("reads what formatClipTime writes, and plain seconds", () => {
    for (const t of [0, 4.6, 65.5, 4500.3]) expect(parseClipTime(formatClipTime(t, true))).toBeCloseTo(Math.floor(t * 10) / 10, 5)
    expect(parseClipTime("75")).toBe(75)
    expect(parseClipTime("1:02:03.25")).toBeCloseTo(3723.25, 5)
    expect(parseClipTime(" 1:05,5 ")).toBeCloseTo(65.5, 5)
  })
  test("refuses what is not a time", () => {
    for (const bad of ["", "-1", "1:75", "a", "1::2", "1:2:3:4", "1.2.3"]) expect(parseClipTime(bad)).toBeNull()
  })
})

describe("range limits", () => {
  test("an unset range is the whole video, or the first maxClip", () => {
    expect(normalizeRange(null, L)).toEqual([0, 30])
    expect(normalizeRange(undefined, { ...L, maxClip: Infinity })).toEqual([0, 100])
  })
  test("a range out of bounds, reversed or too long is mended", () => {
    expect(normalizeRange([120, -5], L)).toEqual([0, 30])
    expect(normalizeRange([50, 50.2], L)).toEqual([50, 51])
    expect(normalizeRange([99.8, 100], L)).toEqual([99, 100])
  })
  test("a dragged end stops at a limit and the other stays", () => {
    expect(dragEnd([10, 20], 0, -4, L)).toEqual([0, 20])
    expect(dragEnd([10, 20], 0, 19.9, L)).toEqual([19, 20])
    expect(dragEnd([10, 20], 1, 60, L)).toEqual([10, 40])
    expect(dragEnd([80, 90], 1, 200, L)).toEqual([80, 100])
  })
  test("a set end goes where told and pulls the other along", () => {
    expect(setEnd([10, 20], 0, 25, L)).toEqual([25, 26])
    expect(setEnd([10, 20], 1, 70, L)).toEqual([40, 70])
    expect(setEnd([10, 20], 0, 100, L)).toEqual([99, 100])
    expect(setEnd([10, 20], 1, 0, L)).toEqual([0, 1])
  })
})

describe("timeline view", () => {
  test("zooming keeps the anchor in place and stays inside the video", () => {
    const v = zoomView({ start: 0, end: 100 }, 50, 4, 100, 2)
    expect(v).toEqual({ start: 37.5, end: 62.5 })
    expect(zoomView(v, 50, 0.01, 100, 2)).toEqual({ start: 0, end: 100 })
    const tight = zoomView({ start: 0, end: 100 }, 0, 1000, 100, 2)
    expect(tight.end - tight.start).toBeCloseTo(2, 9)
    expect(tight.start).toBe(0)
  })
  test("shifting and revealing hold the width", () => {
    expect(shiftView({ start: 10, end: 20 }, 200, 100)).toEqual({ start: 90, end: 100 })
    expect(revealTime({ start: 10, end: 20 }, 25, 100)).toEqual({ start: 16, end: 26 })
    expect(revealTime({ start: 10, end: 20 }, 15, 100)).toEqual({ start: 10, end: 20 })
  })
  test("the shared span math", () => {
    expect(zoomSpan(0, 10, 5, 0.5, 1)).toEqual({ start: 2.5, end: 7.5 })
    expect(shiftSpan(0, 10, -5, 0, 100)).toEqual({ start: 0, end: 10 })
  })
  test("ruler marks stand apart and on round times", () => {
    expect(tickStep(3600, 1000)).toBe(300)
    expect(tickStep(2, 1000)).toBe(0.2)
    expect(ticks({ start: 0.05, end: 1 }, 0.2)).toEqual([0.2, 0.4, 0.6, 0.8, 1])
  })
  test("a still covers a power of two of seconds, at least the minimum width", () => {
    expect(stillSpan(3.6, 80)).toBe(512)
    expect(stillSpan(0.001, 80)).toBe(0.125)
  })
})

describe("region", () => {
  test("the picture's place inside a letterboxed box", () => {
    expect(containRect(1600, 900, 1080, 1920)).toEqual({ x: (1600 - 506.25) / 2, y: 0, width: 506.25, height: 900 })
  })
  test("drawn either way, cut to the frame", () => {
    expect(regionBetween(0.8, 0.9, 0.2, -0.5)).toEqual({ x: 0.2, y: 0, w: 0.6, h: 0.9 })
  })
  test("moved and resized inside the frame", () => {
    const r = { x: 0.5, y: 0.5, w: 0.4, h: 0.4 }
    expect(adjustRegion(r, "move", 0.5, 0)).toEqual({ x: 0.6, y: 0.5, w: 0.4, h: 0.4 })
    expect(adjustRegion(r, "nw", 0.5, 0.5)).toEqual({ x: 0.88, y: 0.88, w: 0.02, h: 0.02 })
    expect(adjustRegion(r, "se", 1, 1)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 })
  })
})

import { isVideoItem } from "../src/components/lightbox"
describe("isVideoItem", () => {
  test("by kind first, then by the address's extension", () => {
    expect(isVideoItem({ src: "/e/42.mp4" })).toBe(true)
    expect(isVideoItem({ src: "https://x/clip.WEBM?token=1" })).toBe(true)
    expect(isVideoItem({ src: "/e/42.png" })).toBe(false)
    expect(isVideoItem({ src: "/api/evidence/42", kind: "video" })).toBe(true)
    expect(isVideoItem({ src: "/still.mp4", kind: "image" })).toBe(false)
  })
})
