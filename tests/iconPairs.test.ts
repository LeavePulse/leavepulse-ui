import { describe, expect, test } from "bun:test"
import { iconPairs } from "../src/looks/iconPairs.mjs"

const set = {
  prefix: "demo",
  width: 24,
  height: 24,
  icons: { check: { body: "<path d='c'/>" }, close: { body: "<path d='x'/>" }, gear: { body: "<path d='g'/>" } },
  aliases: { tick: { parent: "check" } },
}

describe("iconPairs", () => {
  test("same names pair up, synonyms cover the rest, unknown targets are dropped", () => {
    const { prefix, map, collection } = iconPairs(set, { synonyms: { x: "close", settings: "gear", ghost: "nope" } })
    expect(prefix).toBe("demo")
    expect(map.check).toBe("check")
    expect(map.tick).toBe("tick")
    expect(map.x).toBe("close")
    expect(map.settings).toBe("gear")
    expect(map.ghost).toBeUndefined()
    expect(collection).toBe(set)
  })

  test("only keeps the named lucide icons and cuts the collection to them", () => {
    const { map, collection } = iconPairs(set, { synonyms: { x: "close" }, only: ["lucide:x", "check", "bell"] })
    expect(map).toEqual({ x: "close", check: "check" })
    expect(Object.keys(collection.icons).sort()).toEqual(["check", "close"])
  })
})
