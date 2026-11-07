import { afterEach, describe, expect, test } from "bun:test"
import { createRenderer, effectScope, h, nextTick, ref, type Ref } from "vue"
import { optionStagger } from "../src/components/dropdown"
import { durationToken, easingToken, prefersReducedMotion, tokenEase } from "../src/composables/easing"
import { springSettled, springStep, usePillTransition, type SpringState } from "../src/composables/usePillTransition"
import { usePointerFrame } from "../src/composables/usePointerFrame"
import { usePrefersReducedMotion } from "../src/composables/useReducedMotion"
import { useResizeObserver } from "../src/composables/useResizeObserver"

const g = globalThis as Record<string, unknown>
const saved = { raf: g.requestAnimationFrame, caf: g.cancelAnimationFrame, ro: g.ResizeObserver }
afterEach(() => {
  g.requestAnimationFrame = saved.raf
  g.cancelAnimationFrame = saved.caf
  g.ResizeObserver = saved.ro
})

/** A frame queue the test flushes by hand. */
function fakeFrames() {
  const queue = new Map<number, FrameRequestCallback>()
  let id = 0
  g.requestAnimationFrame = (cb: FrameRequestCallback) => (queue.set(++id, cb), id)
  g.cancelAnimationFrame = (n: number) => void queue.delete(n)
  return {
    pending: () => queue.size,
    flush: () => {
      const due = [...queue.values()]
      queue.clear()
      for (const cb of due) cb(0)
    },
  }
}

const pointer = (type: string, x: number, y: number) => ({ pointerType: type, clientX: x, clientY: y }) as PointerEvent

describe("optionStagger", () => {
  test("22 ms apart, capped at the 12th option", () => {
    expect(optionStagger(0).animationDelay).toBe("0ms")
    expect(optionStagger(3).animationDelay).toBe("66ms")
    expect(optionStagger(12).animationDelay).toBe("264ms")
    expect(optionStagger(40).animationDelay).toBe("264ms")
  })
})

describe("usePointerFrame", () => {
  test("paints once per frame with the latest position", () => {
    const frames = fakeFrames()
    const painted: number[][] = []
    const scope = effectScope()
    const p = scope.run(() => usePointerFrame({ paint: (x, y) => painted.push([x, y]) }))!
    expect(p.move(pointer("mouse", 1, 1))).toBe(true)
    p.move(pointer("mouse", 5, 6))
    expect(frames.pending()).toBe(1)
    frames.flush()
    expect(painted).toEqual([[5, 6]])
    scope.stop()
  })
  test("ignores touch unless asked, and anything while disabled", () => {
    fakeFrames()
    const off = ref(false)
    const scope = effectScope()
    const mouseOnly = scope.run(() => usePointerFrame({ paint: () => {}, disabled: off }))!
    const any = scope.run(() => usePointerFrame({ paint: () => {}, anyPointer: true }))!
    expect(mouseOnly.move(pointer("touch", 0, 0))).toBe(false)
    expect(any.move(pointer("touch", 0, 0))).toBe(true)
    off.value = true
    expect(mouseOnly.move(pointer("mouse", 0, 0))).toBe(false)
    scope.stop()
  })
  test("a stopped scope drops the frame it asked for", () => {
    const frames = fakeFrames()
    let painted = 0
    const scope = effectScope()
    const p = scope.run(() => usePointerFrame({ paint: () => painted++ }))!
    p.moveTo(1, 1)
    scope.stop()
    frames.flush()
    expect(painted).toBe(0)
  })
})

describe("useResizeObserver", () => {
  class FakeObserver {
    static live = new Set<FakeObserver>()
    targets: Element[] = []
    constructor(public cb: ResizeObserverCallback) {
      FakeObserver.live.add(this)
    }
    observe(el: Element) {
      this.targets.push(el)
    }
    disconnect() {
      this.targets = []
      FakeObserver.live.delete(this)
    }
    fire(el: Element) {
      this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
  }

  test("follows the target, calls back on attach when immediate, disconnects on stop", async () => {
    g.ResizeObserver = FakeObserver
    const a = { id: "a" } as unknown as Element
    const b = { id: "b" } as unknown as Element
    const el = ref<Element | null>(null)
    const calls: Array<[boolean, unknown]> = []
    const scope = effectScope()
    scope.run(() => useResizeObserver(el, (entry, target) => calls.push([!!entry, (target as unknown as { id: string }).id]), { immediate: true }))
    expect(FakeObserver.live.size).toBe(0)
    el.value = a
    await nextTick()
    expect(calls).toEqual([[false, "a"]])
    const [first] = FakeObserver.live
    first.fire(a)
    expect(calls.at(-1)).toEqual([true, "a"])
    el.value = b
    await nextTick()
    expect(FakeObserver.live.size).toBe(1)
    expect([...FakeObserver.live][0].targets).toEqual([b])
    scope.stop()
    expect(FakeObserver.live.size).toBe(0)
  })

  test("without ResizeObserver it still calls back on attach and does not throw", async () => {
    g.ResizeObserver = undefined
    const el = ref<Element | null>(null)
    let attached = 0
    const scope = effectScope()
    scope.run(() => useResizeObserver(el, () => attached++, { immediate: true }))
    el.value = {} as Element
    await nextTick()
    expect(attached).toBe(1)
    scope.stop()
  })
})

describe("springStep", () => {
  const simulate = (fps: number, seconds = 1) => {
    let state: SpringState = { value: 0, velocity: 0 }
    for (let i = 0; i < fps * seconds; i++) state = springStep(state, 100, "float", 1 / fps)
    return state
  }

  test("lands in the same place at 30, 60 and 120 fps", () => {
    for (const fps of [30, 60, 120]) expect(Math.abs(simulate(fps).value - 100)).toBeLessThan(1)
  })

  test("the frame rate changes the path by little on the way", () => {
    const at = (fps: number) => simulate(fps, 0.2).value
    expect(Math.abs(at(30) - at(120))).toBeLessThan(10)
  })

  test("a huge frame gap stays a normal step", () => {
    const { value } = springStep({ value: 0, velocity: 0 }, 100, "float", 60)
    expect(value).toBeLessThan(100)
    expect(Number.isFinite(value)).toBe(true)
  })

  test("settles close to the target only", () => {
    expect(springSettled({ value: 100, velocity: 0 }, 100)).toBe(true)
    expect(springSettled({ value: 50, velocity: 0 }, 100)).toBe(false)
  })
})

describe("reduced motion", () => {
  const noop = () => {}
  const { createApp } = createRenderer<object, object>({
    insert: noop, remove: noop, patchProp: noop, setText: noop, setElementText: noop,
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    parentNode: () => null, nextSibling: () => null,
  })

  /** A window whose media query the test can flip. */
  function fakeMotion(matches: boolean) {
    const listeners = new Set<() => void>()
    const list = {
      matches,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }
    const win = { matchMedia: () => list } as unknown as Window
    const flip = (next: boolean) => {
      list.matches = next
      for (const fn of listeners) fn()
    }
    return { win, listeners, flip }
  }

  function mountWith<T>(use: () => T): { value: T; unmount: () => void } {
    let value!: T
    const app = createApp({
      setup() {
        value = use()
        return () => h("div")
      },
    })
    app.mount({})
    return { value, unmount: () => app.unmount() }
  }

  afterEach(() => void delete g.window)

  test("the point-in-time answer asks the window it is given", () => {
    expect(prefersReducedMotion()).toBe(false)
    expect(prefersReducedMotion(fakeMotion(true).win)).toBe(true)
  })

  test("the reactive answer follows a change mid-session and lets go on unmount", () => {
    const motion = fakeMotion(false)
    g.window = motion.win
    const { value, unmount } = mountWith<Ref<boolean>>(usePrefersReducedMotion)
    expect(value.value).toBe(false)
    motion.flip(true)
    expect(value.value).toBe(true)
    unmount()
    expect(motion.listeners.size).toBe(0)
  })

  test("a spring preset turns instant with the setting, and cannot be retuned", () => {
    const motion = fakeMotion(false)
    g.window = motion.win
    const { value, unmount } = mountWith(() => usePillTransition("pill"))
    const spring = value.value
    expect(spring).toMatchObject({ type: "spring" })
    expect(Object.isFrozen(spring)).toBe(true)
    motion.flip(true)
    expect(value.value).toEqual({ duration: 0 })
    unmount()
  })
})

describe("motion tokens", () => {
  const scoped = {
    nodeType: 1,
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({
          getPropertyValue: (name: string) => (name === "--duration-medium" ? "0.5s" : "cubic-bezier(0, 0, 1, 1)"),
        }),
      },
    },
  } as unknown as Element

  afterEach(() => void delete g.window)

  test("the server gets the fallback", () => {
    expect(easingToken("ease-travel", "linear")).toBe("linear")
    expect(durationToken("duration-medium", 99)).toBe(99)
  })

  test("a scope reads the tokens where they are declared", () => {
    g.window = {}
    expect(easingToken("ease-travel", "linear", scoped)).toBe("cubic-bezier(0, 0, 1, 1)")
    expect(durationToken("duration-medium", 99, scoped)).toBe(500)
    expect(tokenEase("ease-travel", scoped)(0.5)).toBeCloseTo(0.5, 2)
  })
})
