import { describe, expect, test } from "bun:test"
import { ref } from "vue"
import { useTableFilterChoice } from "../src/composables/useTableFilterChoice"
import {
  countValues,
  filterRows,
  fromHiddenSets,
  mergeRestored,
  sameHidden,
  showOnly,
  shownValues,
  toHiddenSets,
  type TableFilters,
  hideAllValues,
  invertHidden,
  matchesQuery,
  onlyValues,
  parseTableState,
  serializeTableState,
  summarizeShown,
  unhideValues,
} from "../src/components/tableFilter"

const statuses = ["open", "triaged", "blocked", "closed"]

describe("filter transitions", () => {
  test("only keeps the chosen values and hides the rest", () => {
    expect([...onlyValues(statuses, ["blocked"])]).toEqual(["open", "triaged", "closed"])
    expect([...onlyValues(statuses, ["open", "closed"])]).toEqual(["triaged", "blocked"])
  })

  test("none hides everything, all is the empty set", () => {
    expect([...hideAllValues(statuses)]).toEqual(statuses)
  })

  test("invert swaps shown and hidden", () => {
    expect([...invertHidden(statuses, new Set(["open"]))]).toEqual(["triaged", "blocked", "closed"])
    expect([...invertHidden(statuses, new Set())]).toEqual(statuses)
  })

  test("unhide brings the matches back and leaves the rest", () => {
    expect([...unhideValues(new Set(["open", "blocked", "closed"]), ["blocked"])]).toEqual(["open", "closed"])
  })
})

describe("value search", () => {
  test("every word, any order, any case, accents folded", () => {
    expect(matchesQuery("In progress", "prog")).toBe(true)
    expect(matchesQuery("In progress", "PROGRESS in")).toBe(true)
    expect(matchesQuery("Café orders", "cafe")).toBe(true)
    expect(matchesQuery("Closed", "open")).toBe(false)
    expect(matchesQuery("Anything", "   ")).toBe(true)
  })
})

describe("counts and chips", () => {
  test("counts rows per value", () => {
    const counts = countValues([{ s: "a" }, { s: "b" }, { s: "a" }], "s")
    expect(counts.get("a")).toBe(2)
    expect(counts.get("b")).toBe(1)
  })

  test("summaries name the first values and count the rest", () => {
    expect(summarizeShown(["Open"])).toBe("Open")
    expect(summarizeShown(["Open", "Pending"])).toBe("Open, Pending")
    expect(summarizeShown(["Open", "Pending", "Blocked", "QA", "Ready"])).toBe("Open, Pending +3")
  })
})

describe("remembered state", () => {
  const keys = ["status", "owner", "points"]

  test("round-trips sort, plain filter values and hidden columns", () => {
    const raw = serializeTableState({
      sort: { key: "points", dir: "desc" },
      hidden: { status: ["closed", 3, true, null] },
      columns: ["owner"],
    })
    expect(parseTableState(raw, keys)).toEqual({
      sort: { key: "points", dir: "desc" },
      hidden: { status: ["closed", 3, true, null] },
      columns: ["owner"],
    })
  })

  test("drops values that cannot come back as the same value", () => {
    const raw = serializeTableState({ hidden: { status: [new Date(0), { id: 1 }, "open"] } })
    expect(parseTableState(raw, keys)?.hidden).toEqual({ status: ["open"] })
  })

  test("forgets columns the table no longer has, and survives junk", () => {
    const raw = JSON.stringify({ sort: { key: "gone", dir: "asc" }, hidden: { gone: ["x"] }, columns: ["gone", "owner"] })
    expect(parseTableState(raw, keys)).toEqual({ hidden: {}, columns: ["owner"] })
    expect(parseTableState("{not json", keys)).toBeNull()
    expect(parseTableState(null, keys)).toBeNull()
  })
})

describe("controlled filters", () => {
  test("showOnly and shownValues are each other's inverse", () => {
    expect(showOnly(statuses, ["open"])).toEqual(["triaged", "blocked", "closed"])
    expect(shownValues(statuses, showOnly(statuses, ["open", "closed"]))).toEqual(["open", "closed"])
    expect(shownValues(statuses, undefined)).toEqual(statuses)
  })

  test("filterRows applies every column and ignores empty ones", () => {
    const rows = [
      { status: "open", owner: "Ada" },
      { status: "closed", owner: "Ada" },
      { status: "open", owner: "Ken" },
    ]
    expect(filterRows(rows, { status: ["closed"], owner: [] })).toEqual([rows[0], rows[2]])
    expect(filterRows(rows, { status: ["closed"], owner: ["Ken"] })).toEqual([rows[0]])
    expect(filterRows(rows, {})).toEqual(rows)
  })

  test("sets and lists round-trip, empty columns dropped", () => {
    expect(fromHiddenSets(toHiddenSets({ status: ["open"], owner: [] }))).toEqual({ status: ["open"] })
  })

  test("sameHidden treats an empty column as no column", () => {
    expect(sameHidden({ a: new Set() }, {})).toBe(true)
    expect(sameHidden({ a: new Set([1, 2]) }, { a: new Set([2, 1]) })).toBe(true)
    expect(sameHidden({ a: new Set([1]) }, { a: new Set([2]) })).toBe(false)
  })

  test("restored filters fill only the columns the parent left alone", () => {
    const merged = mergeRestored({ status: new Set(["open"]) }, { status: ["closed"], owner: ["Ken"] })
    expect([...merged.status!]).toEqual(["open"])
    expect([...merged.owner!]).toEqual(["Ken"])
  })
})

describe("useTableFilterChoice", () => {
  const choices = { all: null, live: ["open"], done: ["closed", "blocked"] }

  test("reads the choice the column filter matches, undefined for a mix", () => {
    const filters = ref<TableFilters>({})
    const choice = useTableFilterChoice(filters, "status", choices, statuses)
    expect(choice.value).toBe("all")
    filters.value = { status: showOnly(statuses, ["blocked", "closed"]) }
    expect(choice.value).toBe("done")
    filters.value = { status: ["open"] }
    expect(choice.value).toBeUndefined()
  })

  test("writes the column filter and leaves other columns alone", () => {
    const filters = ref<TableFilters>({ owner: ["Ken"] })
    const choice = useTableFilterChoice(filters, "status", choices, statuses)
    choice.value = "live"
    expect(filters.value).toEqual({ owner: ["Ken"], status: ["triaged", "blocked", "closed"] })
    choice.value = "all"
    expect(filters.value).toEqual({ owner: ["Ken"] })
  })

  test("the vocabulary defaults to the values the choices name", () => {
    const filters = ref<TableFilters>({})
    const choice = useTableFilterChoice(filters, "status", choices)
    choice.value = "live"
    expect(filters.value).toEqual({ status: ["closed", "blocked"] })
  })
})
