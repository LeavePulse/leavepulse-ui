import { describe, expect, test } from "bun:test"
import { csvField, fileStem, toCsv } from "../src/components/exportData"

describe("toCsv", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "note", label: "Note" },
    { key: "n", label: "N", value: (r: { n: number }) => r.n * 2 },
  ]

  test("quotes separators, quotes and line breaks per RFC 4180", () => {
    const csv = toCsv([{ name: 'a "b", c', note: "line\nbreak", n: 1 }], columns)
    expect(csv).toBe('Name,Note,N\r\n"a ""b"", c","line\nbreak",2\r\n')
  })

  test("guards formula cells but leaves numbers alone", () => {
    const csv = toCsv([{ name: "=HYPERLINK(1)", note: "@sum", n: -3 }], columns)
    expect(csv.split("\r\n")[1]).toBe("'=HYPERLINK(1),'@sum,-6")
    expect(csvField("+1", { guardFormulas: false })).toBe("+1")
  })

  test("bom, separator and empty values", () => {
    const csv = toCsv([{ name: null, note: undefined, n: 0 }], columns, { bom: true, separator: ";" })
    expect(csv.startsWith("﻿Name;Note;N")).toBe(true)
    expect(csv.split("\r\n")[1]).toBe(";;0")
  })

  test("dates as ISO and objects as JSON", () => {
    expect(csvField(new Date(Date.UTC(2026, 0, 2)))).toBe("2026-01-02T00:00:00.000Z")
    expect(csvField({ a: 1 })).toBe('"{""a"":1}"')
  })

  test("fileStem strips unsafe characters", () => {
    expect(fileStem('Edge / traffic: "May"', "chart")).toBe("Edge-traffic-May")
    expect(fileStem("  ", "chart")).toBe("chart")
  })
})
