import { describe, expect, test } from "bun:test"
import { hints } from "../src/composables/useHints"

describe("hint examples", () => {
  test("a sample counts while any copy of it is mounted", () => {
    const first = hints.registerExample("t.sample")
    const second = hints.registerExample("t.sample")
    first()
    expect(hints.hasExample("t.sample")).toBe(true)
    second()
    expect(hints.hasExample("t.sample")).toBe(false)
  })

  test("showing a sample is undone by the returned function", () => {
    const hide = hints.showExample("t.shown")
    expect(hints.showingExample("t.shown")).toBe(true)
    hide()
    expect(hints.showingExample("t.shown")).toBe(false)
  })

  test("a registered sample never makes the real control present", () => {
    const stop = hints.registerExample("t.absent")
    hints.showExample("t.absent")()
    expect(hints.present("t.absent")).toBe(false)
    stop()
  })
})
