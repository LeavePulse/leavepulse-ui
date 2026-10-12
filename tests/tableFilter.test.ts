import { describe, expect, test } from "bun:test"
import {
  countValues,
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
