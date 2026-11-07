import { expect, test } from "bun:test"
import { effectScope, nextTick, ref, shallowRef } from "vue"
import { createLinkedView, linkChart, linkLog, linkPipeline, linkTable, linkTopology, type LinkedCanvas } from "../src/composables/useLinkedView"

const inScope = <T>(run: () => T): T => effectScope().run(run)!

test("the same selection again changes nothing, clear empties everything", () => {
  const view = createLinkedView()
  const entity = { id: "a", kind: "server" }
  view.select(entity)
  view.select({ id: "a", kind: "server" })
  expect(view.entity.value).toBe(entity)
  view.timeRange.value = { from: 1 }
  view.moment.value = { time: 1, label: "x" }
  view.traceId.value = "t"
  view.clear()
  expect([view.entity.value, view.timeRange.value, view.moment.value, view.traceId.value]).toEqual([null, null, null, null])
})

test("a table holds one row and answers only to its own kind", () => {
  const view = createLinkedView()
  const table = linkTable(view, { kind: "server" })
  table.value["onUpdate:selected"](["a"])
  expect(view.entity.value).toEqual({ id: "a", kind: "server" })
  expect(table.value.selected).toEqual(["a"])
  table.value["onUpdate:selected"](["a", "b"])
  expect(view.entity.value?.id).toBe("b")
  view.select({ id: 7, kind: "deployment" })
  expect(table.value.selected).toEqual([])
  table.value["onUpdate:selected"]([])
  expect(view.entity.value).toBeNull()
})

test("a selection focuses the graph, and the graph's echo does not select again", async () => {
  const view = createLinkedView()
  const focused: string[] = []
  const canvas = shallowRef<LinkedCanvas | null>({
    focusNode: async (id) => {
      focused.push(id)
      return true
    },
  })
  const topology = inScope(() => linkTopology(view, canvas, { kind: "server" }))
  view.select({ id: 12, kind: "server" })
  await nextTick()
  expect(focused).toEqual(["12"])
  topology.value.onNodeSelect("other")
  await nextTick()
  expect(view.entity.value).toEqual({ id: "other", kind: "server" })
  view.select({ id: "d", kind: "deployment" })
  await nextTick()
  expect(focused).toEqual(["12", "other"])
})

test("a selection filters the log by source, and the chips stay usable", async () => {
  const view = createLinkedView()
  const log = inScope(() => linkLog(view, { sourcesOf: (e) => [`svc-${e.id}`] }))
  view.select({ id: "a" })
  await nextTick()
  expect(log.value.sources).toEqual(["svc-a"])
  log.value["onUpdate:sources"]([])
  expect(log.value.sources).toEqual([])
  view.select(null)
  await nextTick()
  expect(log.value.sources).toEqual([])
})

test("following a trace fills the search, typing over it lets go, and clearing leaves typed text", async () => {
  const view = createLinkedView()
  const log = inScope(() => linkLog(view))
  log.value.onIdClick({ kind: "trace", value: "abc" })
  await nextTick()
  expect(log.value.search).toBe("abc")
  expect(log.value.filterMatches).toBe(true)
  log.value["onUpdate:search"]("error")
  await nextTick()
  expect(view.traceId.value).toBeNull()
  expect(log.value.filterMatches).toBe(false)
  expect(log.value.search).toBe("error")
  view.traceId.value = "abc"
  await nextTick()
  view.traceId.value = null
  await nextTick()
  expect(log.value.search).toBe("")
})

test("a picked line marks the timeline, one with no time clears the mark", () => {
  const view = createLinkedView()
  const log = inScope(() => linkLog(view))
  log.value.onSelect({ line: { time: 20, message: "boom" } })
  expect(view.moment.value).toEqual({ time: 20, label: "boom" })
  log.value.onSelect({ line: { message: "stack" } })
  expect(view.moment.value).toBeNull()
})

test("the chart's window and the shared range are one, in both directions", () => {
  const view = createLinkedView()
  const chart = linkChart(view, { times: [10, 20, 30, 40] })
  expect(chart.value.range).toBeNull()
  chart.value["onUpdate:range"]({ start: 1, end: 2 })
  expect(view.timeRange.value).toEqual({ from: 20, to: 30 })
  expect(chart.value.range).toEqual({ start: 1, end: 2 })
  view.timeRange.value = { from: 31 }
  expect(chart.value.range).toEqual({ start: 2, end: 3 })
  chart.value["onUpdate:range"](null)
  expect(view.timeRange.value).toBeNull()
})

test("a chart with no points has no window and no annotation", () => {
  const view = createLinkedView()
  view.timeRange.value = { from: 1 }
  view.moment.value = { time: 1, label: "x" }
  const chart = linkChart(view, { times: [] })
  expect(chart.value.range).toBeNull()
  expect(chart.value.annotations).toEqual([])
})

test("the marked moment joins the chart's own annotations only while it is on the chart", () => {
  const view = createLinkedView()
  const own = [{ at: 0, label: "deploy" }]
  const chart = linkChart(view, { times: [10, 20, 30], annotations: own })
  view.moment.value = { time: 21, label: "boom" }
  expect(chart.value.annotations).toEqual([...own, { at: 1, label: "boom" }])
  view.moment.value = { time: 99, label: "later" }
  expect(chart.value.annotations).toEqual(own)
})

test("selecting opens the failed steps, keeps what the reader opened, and ignores other kinds", async () => {
  const view = createLinkedView()
  const steps = ref([
    { label: "build", key: "build", status: "success" as const },
    { label: "deploy", key: "deploy", status: "failed" as const },
  ])
  const pipeline = inScope(() => linkPipeline(view, { kind: "deployment", steps }))
  view.select({ id: "s", kind: "server" })
  await nextTick()
  expect(pipeline.value.expanded).toEqual([])
  pipeline.value["onUpdate:expanded"](["build"])
  view.select({ id: "d", kind: "deployment" })
  await nextTick()
  expect(pipeline.value.expanded).toEqual(["build", "deploy"])
})

test("a step that fails while its deployment is selected opens too", async () => {
  const view = createLinkedView()
  const steps = ref<{ label: string; status: "running" | "failed" }[]>([{ label: "a", status: "running" }])
  const pipeline = inScope(() => linkPipeline(view, { steps }))
  view.select({ id: "d" })
  await nextTick()
  expect(pipeline.value.expanded).toEqual([])
  steps.value = [{ label: "a", status: "failed" }]
  await nextTick()
  expect(pipeline.value.expanded).toEqual(["0"])
})
