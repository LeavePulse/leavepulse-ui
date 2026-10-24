import { beforeEach, describe, expect, test } from "bun:test"
import { useToast } from "../src/composables/useToast"

;(globalThis as { window?: unknown }).window ??= globalThis

describe("toast details", () => {
  const toast = useToast()
  beforeEach(() => toast.clear())

  test("an Error shows its message and carries its details to copy", () => {
    const error = Object.assign(new Error("Bad parameter subject_id"), { details: "GET /feed · 400 · req 1" })
    toast.error(error)
    expect(toast.queue.at(-1)).toMatchObject({ message: "Bad parameter subject_id", details: "GET /feed · 400 · req 1" })
  })

  test("explicit details win over the error's own", () => {
    toast.error(Object.assign(new Error("x"), { details: "inner" }), { details: "outer" })
    expect(toast.queue.at(-1)?.details).toBe("outer")
  })

  test("a hand-written message takes details from its cause", () => {
    toast.error("Not saved: boom", { cause: Object.assign(new Error("boom"), { details: "PUT /x · 500" }) })
    expect(toast.queue.at(-1)).toMatchObject({ message: "Not saved: boom", details: "PUT /x · 500" })
  })

  test("a plain string has no details", () => {
    toast.error("Plain")
    expect(toast.queue.at(-1)).toMatchObject({ message: "Plain", details: undefined })
  })
})
