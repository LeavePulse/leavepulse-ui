import { expect, test } from "bun:test"
import { colorPieces, parseAnsi } from "../src/components/ansi"

test("codes leave the text and become runs over it", () => {
  const { text, runs } = parseAnsi("\x1b[33mWARN\x1b[0m plain \x1b[1;31mbad\x1b[m")
  expect(text).toBe("WARN plain bad")
  expect(runs).toEqual([
    { start: 0, end: 4, color: "var(--color-warning)" },
    { start: 11, end: 14, color: "var(--color-danger)", bold: true },
  ])
})

test("text without codes is left alone", () => {
  expect(parseAnsi("[Server thread/INFO]: Done")).toEqual({ text: "[Server thread/INFO]: Done", runs: [] })
})

test("256-colour and true-colour codes keep their colour, other sequences go", () => {
  expect(parseAnsi("\x1b[38;2;255;170;0mgold\x1b[0m").runs[0].color).toBe("rgb(255, 170, 0)")
  expect(parseAnsi("\x1b[38;5;196mred").runs[0].color).toBe("rgb(255, 0, 0)")
  expect(parseAnsi("\x1b[2Kcleared").text).toBe("cleared")
})

test("a stretch of the message is cut where its colour changes", () => {
  const { text, runs } = parseAnsi("ab\x1b[32mcd\x1b[0mef")
  expect(colorPieces(text.slice(1, 5), 1, runs)).toEqual([
    { text: "b" },
    { text: "cd", style: { color: "var(--color-success)" } },
    { text: "e" },
  ])
})
