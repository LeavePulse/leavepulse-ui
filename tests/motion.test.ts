import { afterEach, describe, expect, test } from "bun:test"
import { effectScope, nextTick, ref } from "vue"
import { optionStagger } from "../src/components/dropdown"
import { usePointerFrame } from "../src/composables/usePointerFrame"
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
