import { describe, expect, test } from "bun:test"
import { scrollToElement } from "../src/composables/scroll"

function scene(top: number, height: number, view = 800) {
  const calls: number[] = []
  const container = {
    scrollTop: 1000,
    scrollLeft: 0,
    clientHeight: view,
    clientWidth: 1200,
    getBoundingClientRect: () => ({ top: 0, bottom: view, left: 0, right: 1200 }),
    scrollTo: ({ top: to }: { top: number }) => calls.push(to),
  }
  const el = {
    ownerDocument: { defaultView: {}, scrollingElement: null },
    getBoundingClientRect: () => ({ top, bottom: top + height, left: 0, right: 100, width: 100, height }),
  }
  return { calls, run: (block: "nearest" | "center" | "start") => scrollToElement(el as unknown as Element, { block, margin: 48, container: container as unknown as HTMLElement }) }
}

describe("scrollToElement with an element taller than the scroller", () => {
  test("nearest leaves it alone while its start is in view, instead of running to its end", () => {
    const { calls, run } = scene(200, 5000)
    run("nearest")
    expect(calls).toEqual([])
  })

  test("nearest brings it in by its start when the start is out of view", () => {
    const below = scene(900, 5000)
    below.run("nearest")
    expect(below.calls).toEqual([1000 + 900 - 48])
    const above = scene(-3000, 5000)
    above.run("nearest")
    expect(above.calls).toEqual([1000 - 3000 - 48])
  })

  test("center shows its start, not its middle", () => {
    const { calls, run } = scene(200, 5000)
    run("center")
    expect(calls).toEqual([1000 + 200 - 48])
  })

  test("an element that fits keeps the usual behaviour", () => {
    const { calls, run } = scene(900, 100)
    run("nearest")
    expect(calls).toEqual([1000 + 900 - 800 + 100 + 48])
  })
})
