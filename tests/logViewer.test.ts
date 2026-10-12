import { describe, expect, test } from "bun:test"
import { countLevels, matchPositions, ringWindow, stepMatch } from "../src/components/logSearch"

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
