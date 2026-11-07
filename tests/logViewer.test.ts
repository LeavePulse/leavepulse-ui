import { describe, expect, test } from "bun:test"
import { countLevels, matchPositions, ringWindow, stepMatch } from "../src/components/logSearch"
import {
  compilePattern, exportLines, findIds, groupRepeats, inTimeRange, jsonRows, MATCH_BUDGET_MS, MAX_MATCH_INPUT, MAX_PATTERN_LENGTH,
  messageParts, messageShape, nearestByTime, patternPositions, rowSpan, stackLines, structuredPayload, timeMs,
} from "../src/components/logTools"

describe("log viewer search", () => {
  test("ringWindow keeps the newest lines and reports the cut", () => {
    expect(ringWindow([1, 2, 3, 4, 5], 2)).toEqual({ lines: [4, 5], offset: 3 })
    const all = [1, 2]
    expect(ringWindow(all, 5).lines).toBe(all)
    expect(ringWindow(all, undefined).offset).toBe(0)
  })

  test("countLevels treats a missing level as the fallback", () => {
    const counts = countLevels([{ level: "warn" }, {}, { level: "info" }], "info")
    expect(counts.get("info")).toBe(2)
    expect(counts.get("warn")).toBe(1)
  })

  test("matchPositions is case-insensitive and ignores a blank term", () => {
    const rows = [{ message: "Disk FULL" }, { message: "ok" }, { message: "full again" }]
    expect(matchPositions(rows, "full")).toEqual([0, 2])
    expect(matchPositions(rows, "  ")).toEqual([])
    expect(matchPositions([{ message: "x", source: "API" }, { message: "y" }], "api")).toEqual([0])
  })

  test("stepMatch wraps both ways and starts at the matching end", () => {
    expect(stepMatch(-1, 3, 1)).toBe(0)
    expect(stepMatch(-1, 3, -1)).toBe(2)
    expect(stepMatch(2, 3, 1)).toBe(0)
    expect(stepMatch(0, 3, -1)).toBe(2)
    expect(stepMatch(0, 0, 1)).toBe(-1)
  })
})

describe("log viewer tools", () => {
  test("compilePattern refuses what it cannot run safely, without throwing", () => {
    expect(compilePattern("(").error).toBe("invalid")
    expect(compilePattern("(a+)+$").error).toBe("unsafe")
    expect(compilePattern("(a*)*").error).toBe("unsafe")
    expect(compilePattern("x".repeat(MAX_PATTERN_LENGTH + 1)).error).toBe("too-long")
    expect(compilePattern("(a|b)+").error).toBeNull()
  })

  test("a pattern finds ranges, stays stateless between lines and skips empty matches", () => {
    const { pattern } = compilePattern("err[a-z]*")
    expect(pattern!.test("ERROR here")).toBe(true)
    expect(pattern!.test("ERROR here")).toBe(true)
    expect(pattern!.ranges("an error, errors")).toEqual([[3, 8], [10, 16]])
    expect(compilePattern("x*").pattern!.ranges("abc")).toEqual([])
  })

  test("a pattern reads only the capped head of a huge line", () => {
    const { pattern } = compilePattern("needle")
    expect(pattern!.test("x".repeat(MAX_MATCH_INPUT) + "needle")).toBe(false)
  })

  test("patternPositions stops starting lines once the budget is spent", () => {
    const { pattern } = compilePattern("a")
    let clock = 0
    const rows = Array.from({ length: 10 }, () => ({ message: "a" }))
    expect(patternPositions(rows, pattern!, () => (clock += MATCH_BUDGET_MS / 2)).length).toBeLessThan(rows.length)
    expect(patternPositions([], pattern!)).toEqual([])
  })

  test("timeMs reads numbers, digits and dates, not labels", () => {
    expect(timeMs(5)).toBe(5)
    expect(timeMs("5")).toBe(5)
    expect(timeMs("1970-01-01T00:00:01Z")).toBe(1000)
    expect(timeMs("12:03:05")).toBeNull()
    expect(timeMs(undefined)).toBeNull()
    expect(timeMs(Number.NaN)).toBeNull()
  })

  test("inTimeRange is inclusive and keeps lines with no readable time", () => {
    expect(inTimeRange(5, { from: 5, to: 5 })).toBe(true)
    expect(inTimeRange(4, { from: 5 })).toBe(false)
    expect(inTimeRange(6, { to: 5 })).toBe(false)
    expect(inTimeRange("at frame", { from: 5 })).toBe(true)
    expect(inTimeRange(1, undefined)).toBe(true)
  })

  test("nearestByTime picks the closest readable line", () => {
    expect(nearestByTime([{ time: 10 }, {}, { time: 30 }], 26)).toBe(2)
    expect(nearestByTime([{}], 1)).toBe(-1)
    expect(nearestByTime([{ time: 1 }], "soon")).toBe(-1)
  })

  test("groupRepeats folds shapes wherever they sit, within a level and source", () => {
    const rows = [
      { line: { message: "job 41 failed", level: "error" }, n: 0 },
      { line: { message: "ok" }, n: 1 },
      { line: { message: "job 42 failed", level: "error" }, n: 2 },
      { line: { message: "job 43 failed", level: "warn" }, n: 3 },
    ]
    expect(groupRepeats(rows).map((r) => [r.n, r.count])).toEqual([[0, 2], [1, 1], [3, 1]])
    expect(groupRepeats([])).toEqual([])
    expect(messageShape("id 550e8400-e29b-41d4-a716-446655440000 at 0xff took 1.5")).toBe("id # at # took #")
  })

  test("findIds reads the common spellings and leaves short values alone", () => {
    expect(findIds('trace_id=abc123 "requestId": "req-99x" spanId:1234567').map((i) => [i.kind, i.value])).toEqual([
      ["trace", "abc123"], ["request", "req-99x"], ["span", "1234567"],
    ])
    expect(findIds("trace_id=a1")).toEqual([])
    const [id] = findIds("x trace_id=abc123 y")
    expect("x trace_id=abc123 y".slice(id.start, id.end)).toBe("abc123")
  })

  test("messageParts keeps the text whole and lets an id win over a hit", () => {
    const message = "a trace_id=abc123 b"
    const ids = findIds(message)
    const parts = messageParts(message, [[0, 1], [11, 13]], ids)
    expect(parts.map((p) => p.text).join("")).toBe(message)
    expect(parts.filter((p) => p.id).map((p) => p.text)).toEqual(["abc123"])
    expect(parts[0]).toEqual({ text: "a", hit: true })
    expect(messageParts("", [], [])).toEqual([{ text: "", hit: false }])
  })

  test("structuredPayload finds JSON, after a prefix too, and nothing else", () => {
    expect(structuredPayload('{"a":1}')).toEqual({ a: 1 })
    expect(structuredPayload('done {"a":1}')).toEqual({ a: 1 })
    expect(structuredPayload("[broken {")).toBeNull()
    expect(structuredPayload("plain")).toBeNull()
  })

  test("jsonRows flattens, honours what is collapsed and filters keeping the parents", () => {
    const value = { user: { id: 7, tags: ["x"] }, ok: true, gone: null }
    expect(jsonRows(value, new Set()).map((r) => r.path)).toEqual(["user", "user.id", "user.tags", "user.tags.0", "ok", "gone"])
    expect(jsonRows(value, new Set(["user"])).map((r) => r.path)).toEqual(["user", "ok", "gone"])
    expect(jsonRows(value, new Set(), "tags").map((r) => r.path)).toEqual(["user", "user.tags"])
    expect(jsonRows({ a: {} }, new Set())[0]).toMatchObject({ value: "{0}", expandable: false })
  })

  test("stackLines marks frames and ignores plain text", () => {
    const lines = stackLines("Error: boom\n    at run (a.ts:1:1)")!
    expect(lines.map((l) => l.frame)).toEqual([false, true])
    expect(stackLines("one line")).toBeNull()
    expect(stackLines("two\nplain lines")).toBeNull()
  })

  test("exportLines keeps a multi-line message intact and writes one object per line", () => {
    const lines = [{ message: "a\n  b" }, { message: "c" }]
    expect(exportLines(lines, "text", (l) => l.message)).toBe("a\n  b\nc")
    expect(exportLines(lines, "ndjson", (l) => l.message).split("\n").map((l) => JSON.parse(l))).toEqual(lines)
  })

  test("rowSpan orders its ends", () => {
    expect(rowSpan(5, 2)).toEqual([2, 5])
    expect(rowSpan(2, 2)).toEqual([2, 2])
  })
})
