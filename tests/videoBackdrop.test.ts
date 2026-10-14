import { describe, expect, test } from "bun:test"
import { formatClipTime, isNativeLoop, planLoop, seamProgress, seamReached } from "../src/components/videoBackdrop"

describe("planLoop", () => {
  test("the whole clip by default, with no overlap", () => {
    expect(planLoop(16.5)).toEqual({ from: 0, to: 16.5, fade: 0 })
  })

  test("clamps the stretch into the clip and orders it", () => {
    expect(planLoop(10, { start: -3, end: 40 })).toEqual({ from: 0, to: 10, fade: 0 })
    expect(planLoop(10, { start: 8, end: 2 })).toEqual({ from: 2, to: 8, fade: 0 })
  })

  test("widens a stretch too short to read as a loop", () => {
    expect(planLoop(10, { start: 4, end: 4.1 })).toEqual({ from: 4, to: 4.5, fade: 0 })
    expect(planLoop(10, { start: 9.9, end: 10 })).toEqual({ from: 9.5, to: 10, fade: 0 })
  })

  test("keeps the overlap within half the stretch", () => {
    expect(planLoop(10, { start: 2, end: 6, crossfade: 1 }).fade).toBe(1)
    expect(planLoop(10, { start: 2, end: 6, crossfade: 5 }).fade).toBe(2)
  })

  test("an unknown length plans nothing", () => {
    expect(planLoop(Number.NaN)).toEqual({ from: 0, to: 0, fade: 0 })
    expect(planLoop(0)).toEqual({ from: 0, to: 0, fade: 0 })
  })
})

describe("the seam", () => {
  const plan = planLoop(10, { start: 2, end: 8, crossfade: 1 })

  test("is reached a fade before the end", () => {
    expect(seamReached(plan, 6.9)).toBe(false)
    expect(seamReached(plan, 7)).toBe(true)
  })

  test("progress follows the incoming pass's own media time", () => {
    expect(seamProgress(plan, 2)).toBe(0)
    expect(seamProgress(plan, 2.5)).toBe(0.5)
    expect(seamProgress(plan, 4)).toBe(1)
    expect(seamProgress({ ...plan, fade: 0 }, 2)).toBe(1)
  })

  test("only an uncut, unblended loop is left to the element", () => {
    expect(isNativeLoop(planLoop(10), 10)).toBe(true)
    expect(isNativeLoop(planLoop(10, { crossfade: 1 }), 10)).toBe(false)
    expect(isNativeLoop(planLoop(10, { start: 1 }), 10)).toBe(false)
  })
})

describe("formatClipTime", () => {
  test("minutes and seconds, tenths on request", () => {
    expect(formatClipTime(65)).toBe("1:05")
    expect(formatClipTime(7.5, true)).toBe("0:07.5")
    expect(formatClipTime(7, true)).toBe("0:07")
    expect(formatClipTime(Number.NaN)).toBe("0:00")
  })
})
