import { expect, test } from "bun:test"
import { useModalLayer } from "../src/components/modalDepth"

test("keeps the newest overlay above its owner without another backdrop blur", () => {
  const outer = useModalLayer()
  const inner = useModalLayer()
  outer.claim()
  inner.claim()
  expect(outer.layer.value.nested).toBe(false)
  expect(inner.layer.value.nested).toBe(true)
  expect(inner.layer.value.panel).toBe("calc(var(--z-modal) - 0)")
  expect(outer.layer.value.panel).toBe("calc(var(--z-modal) - 20)")
  inner.release()
  outer.release()
})
