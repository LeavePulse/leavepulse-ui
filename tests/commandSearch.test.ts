import { expect, test } from "bun:test"
import { applyQueryFilters, parseCommandQuery, parsePaletteQuery, rankCommandItems } from "../src/components/commandSearch"

const items = [
  { id: "logs", label: "Logs", group: "Server", keywords: ["audit"] },
  { id: "archive", label: "Archive", group: "Server", description: "Saved messages" },
  { id: "theme", label: "Dark theme", group: "Appearance" },
]

test("parses quoted phrases, exclusions and groups", () => {
  expect(parseCommandQuery('"dark theme" -archive in:"appearance"')).toEqual({
    include: ["dark theme"],
    exclude: ["archive"],
    groups: ["appearance"],
  })
})

test("ranks a group scope and exclusion", () => {
  const terms = parseCommandQuery("in:server -archive")
  expect(rankCommandItems(items, terms).map((item) => item.id)).toEqual(["logs"])
})

test("a label that is exactly the query outranks one that merely contains it", () => {
  const items = [
    { id: "a", label: "ThemeSwitcher", keywords: ["theme-switcher"], description: "Theme picker" },
    { id: "b", label: "Theme", keywords: ["theme"] },
  ]
  expect(rankCommandItems(items, parseCommandQuery("theme")).map((c) => c.id)).toEqual(["b", "a"])
})

test("a fetcher's query keeps the positive words in their case and drops the operators", () => {
  const q = parsePaletteQuery('Sodium "Fabric API" -forge in:mods')
  expect(q.text).toBe("Sodium Fabric API")
  expect(q.include).toEqual(["sodium", "fabric api"])
  expect(q.exclude).toEqual(["forge"])
  expect(q.groups).toEqual(["mods"])
  expect(q.raw).toBe('Sodium "Fabric API" -forge in:mods')
  expect(parsePaletteQuery("-forge").text).toBe("")
})

test("fetched results still obey exclusions and scopes", () => {
  const hits = [
    { id: "a", label: "Sodium", group: "Mods" },
    { id: "b", label: "Sodium Forge port", group: "Mods" },
    { id: "c", label: "Sodium pack", group: "Modpacks", keywords: ["forge"] },
    { id: "d", label: "Sodium shader", group: "Shaders" },
  ]
  expect(applyQueryFilters(hits, parsePaletteQuery("sodium -forge in:mod")).map((h) => h.id)).toEqual(["a"])
  expect(applyQueryFilters(hits, parsePaletteQuery("anything")).length).toBe(4)
})
