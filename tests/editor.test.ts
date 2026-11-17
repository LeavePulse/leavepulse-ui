import { describe, expect, test } from "bun:test"
import { getSchema } from "@tiptap/core"
import { Node } from "@tiptap/pm/model"
import StarterKit from "@tiptap/starter-kit"
import { outlineOf } from "../src/editor/anchors"
import { resolvePlugins, type EditorPlugin } from "../src/editor/blocks"

const block = (id: string, label: string) => ({ id, label, icon: "lucide:box", group: "text", insert: (chain: never) => chain })

describe("resolvePlugins", () => {
  test("a later plugin replaces a block or mark with the same id and keeps the order of first appearance", () => {
    const first: EditorPlugin = { id: "a", blocks: [block("p", "Text"), block("h", "Heading")] }
    const second: EditorPlugin = { id: "b", blocks: [block("p", "Paragraph"), block("x", "Extra")] }
    const resolved = resolvePlugins([first, second], { collaborative: false, placeholder: () => "" })
    expect(resolved.blocks.map((row) => [row.id, row.label])).toEqual([
      ["p", "Paragraph"],
      ["h", "Heading"],
      ["x", "Extra"],
    ])
  })

  test("extension factories see whether the document is shared", () => {
    const seen: boolean[] = []
    const plugin: EditorPlugin = { id: "c", extensions: ({ collaborative }) => (seen.push(collaborative), []) }
    resolvePlugins([plugin], { collaborative: true, placeholder: () => "" })
    expect(seen).toEqual([true])
  })
})

describe("outlineOf", () => {
  const schema = getSchema([StarterKit])
  const heading = (level: number, text: string) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] })

  test("ids come from the text, repeated titles get a counter", () => {
    const doc = Node.fromJSON(schema, { type: "doc", content: [heading(1, "Правила чату"), heading(2, "Spam & flood"), heading(2, "Spam & flood")] })
    expect(outlineOf(doc).map(({ id, level }) => [id, level])).toEqual([
      ["h-правила-чату", 1],
      ["h-spam-flood", 2],
      ["h-spam-flood-2", 2],
    ])
  })
})

describe("styling plugin", async () => {
  const { stylingPlugin } = await import("../src/editor/styling")

  test("menus derive from the options, and the font menu needs fonts", () => {
    expect(stylingPlugin().menus?.map((menu) => menu.id)).toEqual(["size", "color", "background", "align"])
    const withFonts = stylingPlugin({ fonts: [{ name: "Caveat", family: "Caveat, cursive" }], labels: { font: "Шрифт" } })
    expect(withFonts.menus?.[0]?.id).toBe("font")
    expect(withFonts.menus?.[0]?.label).toBe("Шрифт")
  })

  test("default colours are theme tokens, so they follow the theme", () => {
    const color = stylingPlugin().menus?.find((menu) => menu.id === "color")
    const editor = { getAttributes: () => ({}), isActive: () => false } as never
    const values = color?.items(editor).map((item) => item.swatch)
    expect(values?.every((value) => value?.startsWith("var(--color-"))).toBe(true)
  })
})
