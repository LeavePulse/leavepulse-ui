import { afterAll, beforeAll, expect, test } from "bun:test"
import { anyModalOpen, topModalElement, useModalLayer } from "../src/components/modalDepth"

const g = globalThis as { window?: unknown }
const hadWindow = "window" in g
beforeAll(() => {
  if (!hadWindow) g.window = globalThis
})
afterAll(() => {
  if (!hadWindow) delete g.window
})

test("keeps the newest overlay above its owner without another backdrop blur", () => {
  const outer = useModalLayer()
  const inner = useModalLayer()
  outer.claim()
  inner.claim()
  expect(outer.layer.value.nested).toBe(false)
  expect(inner.layer.value.nested).toBe(true)
  expect(inner.layer.value.panel).toBe("calc(var(--z-modal) - 0)")
  expect(outer.layer.value.panel).toBe("calc(var(--z-modal) - 20)")
  expect(inner.top.value).toBe(true)
  expect(outer.top.value).toBe(false)
  inner.release()
  outer.release()
  expect(anyModalOpen()).toBe(false)
})

test("reports the panel of the topmost modal", () => {
  const a = { id: "a" } as unknown as HTMLElement
  const b = { id: "b" } as unknown as HTMLElement
  const outer = useModalLayer({ element: () => a })
  const inner = useModalLayer({ element: () => b })
  outer.claim()
  inner.claim()
  expect(topModalElement()).toBe(b)
  inner.release()
  expect(topModalElement()).toBe(a)
  outer.release()
  expect(topModalElement()).toBe(null)
})

test("claims nothing on the server", () => {
  const saved = g.window
  delete g.window
  try {
    const layer = useModalLayer()
    layer.claim()
    expect(anyModalOpen()).toBe(false)
  } finally {
    g.window = saved
  }
})
