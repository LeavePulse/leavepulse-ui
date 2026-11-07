import { describe, expect, test } from "bun:test"
import { dayOf, groupByDay, untilMidnight, type NotificationItem } from "../src/components/notifications"

const noon = new Date(2026, 10, 7, 12, 0, 0).getTime()
const at = (d: number, h: number) => new Date(2026, 10, d, h, 0, 0).toISOString()
const item = (id: string, createdAt?: string): NotificationItem => ({ id, title: id, createdAt })

describe("notification day groups", () => {
  test("today, yesterday and earlier follow the local calendar, not 24-hour spans", () => {
    expect(dayOf(at(7, 0), noon)).toBe("today")
    expect(dayOf(at(6, 23), noon)).toBe("yesterday")
    expect(dayOf(at(6, 0), noon)).toBe("yesterday")
    expect(dayOf(at(5, 23), noon)).toBe("earlier")
    expect(dayOf(undefined, noon)).toBe("earlier")
    expect(dayOf("not a date", noon)).toBe("earlier")
  })

  test("runs keep the caller's order; an out-of-order item opens a new run", () => {
    const groups = groupByDay([item("a", at(7, 9)), item("b", at(6, 9)), item("c", at(7, 8)), item("d")], noon, true)
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ["today", ["a"]],
      ["yesterday", ["b"]],
      ["today", ["c"]],
      ["earlier", ["d"]],
    ])
    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length)
  })

  test("no grouping when it is off or no item has a time", () => {
    expect(groupByDay([item("a", at(7, 9))], noon, false)).toEqual([{ key: "all", day: null, items: [item("a", at(7, 9))] }])
    expect(groupByDay([item("a"), item("b")], noon, true)[0]!.day).toBeNull()
  })

  test("the groups wake at the next local midnight", () => {
    expect(untilMidnight(noon)).toBe(12 * 3_600_000)
  })
})
