import { expect, test } from "bun:test"
import { parseCommandQuery, rankCommandItems } from "../src/components/commandSearch"

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
