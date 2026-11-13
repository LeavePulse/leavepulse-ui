import { describe, expect, test } from "bun:test"
import {
  createDragSession,
  createVelocityTracker,
  FLICK_VELOCITY,
  lockAxis,
  momentumDistance,
  pageAfterSwipe,
  pinchFrame,
  rubberBand,
  rubberClamp,
  shouldDismiss,
  slopFor,
  swipeDirection,
  wheelPixels,
} from "../src/composables/gesture"

describe("velocity", () => {
  test("measures over the recent window, not the last pair", () => {
    const v = createVelocityTracker()
    v.add({ x: 0, y: 0 }, 0)
    v.add({ x: 50, y: 0 }, 50)
    v.add({ x: 100, y: 0 }, 100)
    v.add({ x: 101, y: 0 }, 100.5)
    expect(v.velocity(100.5).x).toBeCloseTo(1, 1)
  })

  test("a pointer that rested before release was not flung", () => {
    const v = createVelocityTracker()
    v.add({ x: 0, y: 0 }, 0)
    v.add({ x: 100, y: 0 }, 50)
    expect(v.velocity(300)).toEqual({ x: 0, y: 0 })
  })

  test("old samples fall out of the window", () => {
    const v = createVelocityTracker()
    v.add({ x: 0, y: 0 }, 0)
    v.add({ x: 1000, y: 0 }, 10)
    v.add({ x: 1000, y: 0 }, 400)
    v.add({ x: 1010, y: 0 }, 410)
    expect(v.velocity(410).x).toBeCloseTo(1, 5)
  })

  test("one sample has no speed", () => {
    const v = createVelocityTracker()
    v.add({ x: 3, y: 4 }, 1)
    expect(v.velocity()).toEqual({ x: 0, y: 0 })
  })
})

describe("axis lock", () => {
  test("waits inside the slop", () => {
    expect(lockAxis({ x: 3, y: 2 }, 8)).toBeNull()
  })
  test("commits to the leading axis", () => {
    expect(lockAxis({ x: 12, y: 3 }, 8)).toBe("x")
    expect(lockAxis({ x: -2, y: -20 }, 8)).toBe("y")
  })
  test("a diagonal waits for a clearer lead with a ratio", () => {
    expect(lockAxis({ x: 10, y: 9 }, 8, 1.5)).toBeNull()
  })
  test("a finger gets more slop than a mouse", () => {
    expect(slopFor("touch")).toBeGreaterThan(slopFor("mouse"))
  })
})

describe("swipe", () => {
  const still = { x: 0, y: 0 }
  test("far enough at any speed", () => {
    expect(swipeDirection({ x: -80, y: 5 }, still)).toBe("left")
    expect(swipeDirection({ x: 2, y: 90 }, still)).toBe("down")
  })
  test("a short flick counts, a short drag does not", () => {
    expect(swipeDirection({ x: 30, y: 0 }, { x: FLICK_VELOCITY + 0.1, y: 0 })).toBe("right")
    expect(swipeDirection({ x: 30, y: 0 }, still)).toBeNull()
  })
  test("a flick against the movement is not a swipe", () => {
    expect(swipeDirection({ x: 30, y: 0 }, { x: -1, y: 0 })).toBeNull()
  })
  test("a diagonal is not a swipe", () => {
    expect(swipeDirection({ x: 70, y: 65 }, still)).toBeNull()
  })
  test("a fixed axis ignores the other", () => {
    expect(swipeDirection({ x: 5, y: -80 }, still, { axis: "x" })).toBeNull()
  })
  test("a twitch is not a flick", () => {
    expect(swipeDirection({ x: 6, y: 0 }, { x: 2, y: 0 })).toBeNull()
  })
})

describe("rubber band", () => {
  test("gives less the further it is pulled and never passes the size", () => {
    const a = rubberBand(50, 300)
    const b = rubberBand(100, 300)
    expect(a).toBeGreaterThan(0)
    expect(b - a).toBeLessThan(a)
    expect(rubberBand(1e9, 300)).toBeLessThan(300)
  })
  test("keeps the sign and is zero at the edge", () => {
    expect(rubberBand(-40, 300)).toBeLessThan(0)
    expect(rubberBand(0, 300)).toBe(0)
  })
  test("clamp passes values inside and stretches outside", () => {
    expect(rubberClamp(50, 0, 100, 200)).toBe(50)
    const over = rubberClamp(150, 0, 100, 200)
    expect(over).toBeGreaterThan(100)
    expect(over).toBeLessThan(150)
  })
})

describe("dismiss", () => {
  test("past half dismisses, short of it springs back", () => {
    expect(shouldDismiss({ offset: 160, velocity: 0, size: 300 })).toBe(true)
    expect(shouldDismiss({ offset: 100, velocity: 0, size: 300 })).toBe(false)
  })
  test("a flick dismisses from a short pull", () => {
    expect(shouldDismiss({ offset: 30, velocity: 1, size: 300 })).toBe(true)
  })
  test("pulling back from far does not dismiss", () => {
    expect(shouldDismiss({ offset: 200, velocity: -1, size: 300 })).toBe(false)
  })
  test("a pull the wrong way never dismisses", () => {
    expect(shouldDismiss({ offset: -200, velocity: 2, size: 300 })).toBe(false)
  })
})

describe("paging", () => {
  const base = { index: 1, count: 3, size: 400, velocity: 0 }
  test("a quarter pages, less springs back", () => {
    expect(pageAfterSwipe({ ...base, offset: -120 })).toBe(2)
    expect(pageAfterSwipe({ ...base, offset: 120 })).toBe(0)
    expect(pageAfterSwipe({ ...base, offset: -50 })).toBe(1)
  })
  test("a flick pages from a short drag", () => {
    expect(pageAfterSwipe({ ...base, offset: -30, velocity: -1 })).toBe(2)
  })
  test("stops at the ends unless looping", () => {
    expect(pageAfterSwipe({ ...base, index: 2, offset: -200 })).toBe(2)
    expect(pageAfterSwipe({ ...base, index: 2, offset: -200, loop: true })).toBe(0)
  })
})

test("pinch scale and origin", () => {
  const f = pinchFrame({ x: 0, y: 0 }, { x: 200, y: 0 }, 100)
  expect(f.scale).toBe(2)
  expect(f.origin).toEqual({ x: 100, y: 0 })
})

test("momentum travels further the faster the fling", () => {
  expect(momentumDistance(2)).toBeGreaterThan(momentumDistance(1))
  expect(momentumDistance(-1)).toBeLessThan(0)
})

test("wheel units become pixels", () => {
  expect(wheelPixels(3, 1, 500)).toBe(48)
  expect(wheelPixels(1, 2, 500)).toBe(500)
  expect(wheelPixels(40, 0, 500)).toBe(40)
})

describe("drag session", () => {
  test("stays pending inside the slop, then commits once", () => {
    const d = createDragSession({ x: 0, y: 0 }, 0, { slop: 8 })
    expect(d.move({ x: 3, y: 2 }, 10).phase).toBe("pending")
    const first = d.move({ x: 12, y: 0 }, 20)
    expect([first.phase, first.first]).toEqual(["drag", true])
    expect(d.move({ x: 20, y: 0 }, 30).first).toBe(false)
  })

  test("an axis rejects a move that goes the other way, so the page can scroll", () => {
    const d = createDragSession({ x: 0, y: 0 }, 0, { slop: 8, axis: "x" })
    expect(d.move({ x: 2, y: 20 }, 16).phase).toBe("rejected")
    expect(d.move({ x: 40, y: 20 }, 32).phase).toBe("rejected")
  })

  test("lock commits to the first axis and reports it", () => {
    const d = createDragSession({ x: 0, y: 0 }, 0, { slop: 8, axis: "lock" })
    expect(d.move({ x: 1, y: -15 }, 16).axis).toBe("y")
  })

  test("delta is since the last frame, movement since the press", () => {
    const d = createDragSession({ x: 0, y: 0 }, 0, { slop: 1 })
    d.move({ x: 10, y: 0 }, 16)
    const f = d.move({ x: 25, y: 0 }, 32)
    expect(f.delta.x).toBe(15)
    expect(f.movement.x).toBe(25)
  })

  test("a fast release is a swipe, a press that never moved is not", () => {
    const fast = createDragSession({ x: 300, y: 0 }, 0, { slop: 8, axis: "x" })
    fast.move({ x: 280, y: 0 }, 16)
    fast.move({ x: 260, y: 0 }, 32)
    expect(fast.end({ x: 250, y: 0 }, 40).swipe).toBe("left")
    const still = createDragSession({ x: 0, y: 0 }, 0, { slop: 8 })
    expect(still.end({ x: 2, y: 0 }, 200).swipe).toBeNull()
  })
})
