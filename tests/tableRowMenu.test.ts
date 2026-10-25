import { describe, expect, test } from "bun:test"
import { resolveRowMenu } from "../src/components/tableRowMenu"

const items = [{ label: "Open" }, { label: "Delete", danger: true }]

describe("resolveRowMenu", () => {
  test("a bare array keeps working and has no heading", () => {
    expect(resolveRowMenu(items)).toEqual({ items })
  })

  test("an object carries its heading along with the items", () => {
    const menu = resolveRowMenu({ title: "ger-01-p", subtitle: "#42", icon: "lucide:server", items })
    expect(menu.title).toBe("ger-01-p")
    expect(menu.subtitle).toBe("#42")
    expect(menu.icon).toBe("lucide:server")
    expect(menu.items).toBe(items)
  })

  test("nothing returned is an empty menu", () => {
    expect(resolveRowMenu(undefined)).toEqual({ items: [] })
    expect(resolveRowMenu(null)).toEqual({ items: [] })
  })
})
