import { expect, test } from "bun:test"
import { ref } from "vue"
import { useTableFacets } from "../src/components/tableFacets"

function setup() {
  const rows = ref([
    { status: "open", owner: "A" },
    { status: "closed", owner: "A" },
    { status: "open", owner: "B" },
  ])
  const hidden = ref<Record<string, Set<unknown>>>({})
  const facets = useTableFacets({ rows: () => rows.value, columns: () => ["status", "owner"], hidden: () => hidden.value })
  return { rows, hidden, ...facets }
}

test("facet counts obey other columns' filters, retaining the column's own choices", () => {
  const facets = setup()
  facets.hidden.value = { status: new Set(["closed"]), owner: new Set(["B"]) }
  expect([...facets.counts("status")!]).toEqual([["open", 1], ["closed", 1]])
  expect([...facets.counts("owner")!]).toEqual([["A", 1], ["B", 1]])
})

test("changing a filter reuses distinct values, changing a row refreshes them", () => {
  const facets = setup()
  const distinct = facets.distinct("owner")
  facets.hidden.value = { owner: new Set(["B"]) }
  expect(facets.distinct("owner")).toBe(distinct)
  facets.rows.value[0]!.owner = "C"
  expect(facets.distinct("owner")).toEqual(["C", "A", "B"])
  expect(facets.counts("owner")!.get("C")).toBe(1)
})

test("distinct facets preserve first appearance, NaN and object identity", () => {
  const a = {}, b = {}
  const rows = [{ value: NaN }, { value: a }, { value: NaN }, { value: b }, { value: a }]
  const facets = useTableFacets({ rows: () => rows, columns: () => ["value"], hidden: () => ({}) })
  expect(facets.distinct("value")).toEqual([NaN, a, b])
})

test("opening one column's filter does not compute unused columns", () => {
  let otherReads = 0
  const rows = [{ first: "A", get other() { otherReads++; return "B" } }]
  const facets = useTableFacets({ rows: () => rows, columns: () => ["first", "other"], hidden: () => ({}) })
  expect(facets.distinct("first")).toEqual(["A"])
  expect(facets.counts("first")!.get("A")).toBe(1)
  expect(otherReads).toBe(0)
})
