import { describe, expect, test } from "bun:test"
import { effectScope, nextTick, ref } from "vue"
import {
  childProgress,
  connectorFilled,
  currentStepIndex,
  overallStatus,
  stepElapsed,
  type StepStatus,
} from "../src/components/pipeline"
import { useLoadingGate } from "../src/composables/useLoadingGate"

const run = (...statuses: StepStatus[]) => statuses.map((status) => ({ status }))

describe("currentStepIndex", () => {
  test("follows the running step", () => {
    expect(currentStepIndex(run("success", "running", "pending"))).toBe(1)
  })
  test("stops at a failure", () => {
    expect(currentStepIndex(run("success", "failed", "pending"))).toBe(1)
  })
  test("points at the next step between jobs", () => {
    expect(currentStepIndex(run("success", "pending", "pending"))).toBe(1)
  })
  test("nothing before the start or after a clean finish", () => {
    expect(currentStepIndex(run("pending", "pending"))).toBe(-1)
    expect(currentStepIndex(run("success", "skipped"))).toBe(-1)
  })
})

describe("overallStatus", () => {
  test("one failure fails the run", () => {
    expect(overallStatus(run("success", "running", "failed"))).toBe("failed")
  })
  test("passes and skips are a pass", () => {
    expect(overallStatus(run("success", "skipped"))).toBe("success")
  })
  test("between jobs it is still running", () => {
    expect(overallStatus(run("success", "pending"))).toBe("running")
  })
  test("cancelled and untouched runs", () => {
    expect(overallStatus(run("success", "cancelled", "pending"))).toBe("cancelled")
    expect(overallStatus(run("pending"))).toBe("pending")
    expect(overallStatus([])).toBe("pending")
  })
})

describe("connectorFilled", () => {
  test("the line breaks where the run stopped", () => {
    expect(connectorFilled("success")).toBe(true)
    expect(connectorFilled("skipped")).toBe(true)
    expect(connectorFilled("failed")).toBe(false)
    expect(connectorFilled("running")).toBe(false)
  })
})

describe("stepElapsed", () => {
  test("an explicit duration wins", () => {
    expect(stepElapsed({ label: "", status: "success", duration: 1200, startedAt: 0, finishedAt: 5 }, 0)).toBe(1200)
  })
  test("times give a finished step's length and a running step's clock", () => {
    expect(stepElapsed({ label: "", status: "success", startedAt: 1000, finishedAt: 4000 }, 9000)).toBe(3000)
    expect(stepElapsed({ label: "", status: "running", startedAt: 1000 }, 9000)).toBe(8000)
  })
  test("nothing to say without times", () => {
    expect(stepElapsed({ label: "", status: "pending" }, 9000)).toBeNull()
    expect(stepElapsed({ label: "", status: "success", startedAt: 1000 }, 9000)).toBeNull()
  })
})

describe("childProgress", () => {
  test("counts settled children", () => {
    expect(childProgress({ label: "", status: "running", steps: [{ label: "", status: "success" }, { label: "", status: "running" }] })).toEqual({ done: 1, total: 2 })
    expect(childProgress({ label: "", status: "running" })).toBeNull()
  })
})

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe("useLoadingGate", () => {
  test("a load shorter than the delay never shows", async () => {
    const scope = effectScope()
    const active = ref(true)
    const shown = scope.run(() => useLoadingGate(active, { delay: 40, minVisible: 60 }))!
    await wait(10)
    active.value = false
    await nextTick()
    await wait(50)
    expect(shown.value).toBe(false)
    scope.stop()
  })
  test("once shown it stays for the minimum", async () => {
    const scope = effectScope()
    const active = ref(true)
    const shown = scope.run(() => useLoadingGate(active, { delay: 10, minVisible: 80 }))!
    await wait(25)
    expect(shown.value).toBe(true)
    active.value = false
    await nextTick()
    expect(shown.value).toBe(true)
    await wait(90)
    expect(shown.value).toBe(false)
    scope.stop()
  })
})
