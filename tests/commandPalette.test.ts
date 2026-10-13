import { expect, test } from "bun:test"
import { commandHasPreview } from "../src/components/commandPalette"
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
