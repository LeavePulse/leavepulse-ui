import { expect, test } from "bun:test"
import { unknownAttributes } from "../src/composables/propCheck"

const button = { tagName: "BUTTON", type: "", disabled: false, form: null, formAction: "" } as unknown as Element
const input = { tagName: "INPUT", autocomplete: "", readOnly: false, maxLength: 0 } as unknown as Element

test("a misspelt prop is reported", () => {
  expect(unknownAttributes(["text"], [button])).toEqual(["text"])
  expect(unknownAttributes(["categories"], [])).toEqual(["categories"])
})

test("no attributes and no elements report nothing beyond the attributes", () => {
  expect(unknownAttributes([], [button])).toEqual([])
  expect(unknownAttributes(["id", "class"], [])).toEqual([])
})

test("global, data, aria and listener attributes pass on any component", () => {
  expect(unknownAttributes(["data-testid", "aria-keyshortcuts", "onMouseenter", "title", "role"], [])).toEqual([])
})

test("an attribute the rendered element takes passes, in either spelling", () => {
  expect(unknownAttributes(["form", "type"], [button])).toEqual([])
  expect(unknownAttributes(["readonly", "maxlength", "max-length"], [input])).toEqual([])
})

test("an attribute forwarded to an inner element passes", () => {
  expect(unknownAttributes(["autocomplete"], [button, input])).toEqual([])
})

test("ignored names and patterns pass", () => {
  expect(unknownAttributes(["vendor-x", "x-tip"], [button], ["vendor-x", /^x-/])).toEqual([])
})
