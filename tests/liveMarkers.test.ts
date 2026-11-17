import { expect, test } from "bun:test"
import { getSchema } from "@tiptap/core"
import { EditorState, TextSelection } from "@tiptap/pm/state"
import StarterKit from "@tiptap/starter-kit"
import { liveMarkers } from "../src/editor/markdown"

const schema = getSchema([StarterKit])
const bold = schema.marks.bold!.create()
const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [schema.text("Основной ник", [bold]), schema.text(" в Discord")]),
  schema.node("paragraph", null, [schema.text("second")]),
])
const at = (from: number, to = from) => EditorState.create({ doc, selection: TextSelection.create(doc, from, to) })
const texts = (state: EditorState) => liveMarkers(state).map((marker) => marker.text)

test("the caret inside bold shows its stars", () => {
  expect(texts(at(3))).toEqual(["**", "**"])
})

test("a selection inside bold shows them too", () => {
  expect(texts(at(2, 5))).toEqual(["**", "**"])
})

test("a selection that only touches bold from outside still shows them", () => {
  expect(texts(at(10, 16))).toEqual(["**", "**"])
})

test("a selection in plain text shows nothing", () => {
  expect(texts(at(15, 18))).toEqual([])
})

test("a selection across blocks shows nothing", () => {
  expect(texts(at(3, 26))).toEqual([])
})
