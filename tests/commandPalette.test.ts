import { expect, test } from "bun:test"
import { commandHasPreview, matchModePrefix } from "../src/components/commandPalette"
import { comboSteps } from "../src/components/keys"

test("a row with text of its own opens the pane, a bare row does not", () => {
  expect(commandHasPreview({ preview: "Body" }, { slot: false })).toBe(true)
  expect(commandHasPreview({ excerpt: "Passage" }, { slot: false })).toBe(true)
  expect(commandHasPreview({}, { slot: false })).toBe(false)
  expect(commandHasPreview(undefined, { slot: true })).toBe(false)
})

test("with a slot every row qualifies unless it says otherwise", () => {
  expect(commandHasPreview({}, { slot: true })).toBe(true)
  expect(commandHasPreview({ noPreview: true }, { slot: true })).toBe(false)
  expect(commandHasPreview({ noPreview: true, preview: "Body" }, { slot: false })).toBe(false)
})

test("hasPreview decides for the rows the flag leaves open", () => {
  const onlyPeople = (c: { id: string }) => c.id.startsWith("user:")
  expect(commandHasPreview({ id: "user:ada" }, { slot: true, hasPreview: onlyPeople })).toBe(true)
  expect(commandHasPreview({ id: "theme", preview: "Body" }, { slot: true, hasPreview: onlyPeople })).toBe(false)
  expect(commandHasPreview({ id: "user:ada", noPreview: true }, { slot: true, hasPreview: onlyPeople })).toBe(false)
})

test("combos split into steps of caps, with plus as a key of its own", () => {
  expect(comboSteps("Ctrl+K")).toEqual([["Ctrl", "K"]])
  expect(comboSteps("Ctrl++")).toEqual([["Ctrl", "+"]])
  expect(comboSteps("G I")).toEqual([["G"], ["I"]])
  expect(comboSteps("  ")).toEqual([])
})

const modes = [
  { id: "cmd", prefix: ">", children: [] },
  { id: "mods", prefix: "mr ", children: () => [] },
  { id: "m", prefix: "m", children: [] },
  { id: "plain", prefix: "#" },
  { id: "off", prefix: "!", children: [], disabled: true },
]

test("a typed prefix opens its mode with the rest as the query", () => {
  expect(matchModePrefix(">rest", modes)).toEqual({ command: modes[0], rest: "rest" })
  expect(matchModePrefix("  >", modes)).toEqual({ command: modes[0], rest: "" })
  expect(matchModePrefix("MR sodium", modes)).toEqual({ command: modes[1], rest: "sodium" })
})

test("the longest prefix wins and only modes qualify", () => {
  expect(matchModePrefix("mr", modes)?.command.id).toBe("m")
  expect(matchModePrefix("#tag", modes)).toBeNull()
  expect(matchModePrefix("!x", modes)).toBeNull()
  expect(matchModePrefix("theme", modes)).toBeNull()
  expect(matchModePrefix("", modes)).toBeNull()
})

test("the prefix carries the query language along unchanged", () => {
  expect(matchModePrefix('>deploy -prod in:ops "two words"', modes)?.rest).toBe('deploy -prod in:ops "two words"')
})
