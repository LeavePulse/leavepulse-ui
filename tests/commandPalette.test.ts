import { expect, test } from "bun:test"
import {
  commandHasPreview,
  fallbackRows,
  matchModePrefix,
  pushRecent,
  readRecent,
  recentVisible,
  resolveRecentItems,
  toRecentItem,
  type RecentEntry,
  type RecentItem,
} from "../src/components/commandPalette"
import { parseCommandQuery } from "../src/components/commandSearch"
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

const elsewhere = [
  { id: "mods", label: 'Search mods for "{query}"', group: "Modrinth", fallback: true },
  { id: "packs", label: 'Search modpacks for "{query}"', group: "Modrinth", keywords: ["pack"], fallback: true },
  { id: "servers", label: "Search servers", group: "LeavePulse", fallback: true },
  { id: "local", label: "Settings" },
]

test("fallback rows show only while positive words are typed, labelled with them", () => {
  expect(fallbackRows(elsewhere, "")).toEqual([])
  expect(fallbackRows(elsewhere, "-forge")).toEqual([])
  const rows = fallbackRows(elsewhere, 'Sodium "fast render" -forge')
  expect(rows.map((r) => r.command.id)).toEqual(["mods", "packs", "servers"])
  expect(rows[0].label).toBe('Search mods for "Sodium fast render"')
})

test("fallback rows obey exclusions and scopes", () => {
  expect(fallbackRows(elsewhere, "sodium -pack").map((r) => r.command.id)).toEqual(["mods", "servers"])
  expect(fallbackRows(elsewhere, "sodium in:modrinth").map((r) => r.command.id)).toEqual(["mods", "packs"])
})

const root = [
  { id: "deploy", label: "Deploy", group: "Actions" },
  {
    id: "theme",
    label: "Theme",
    children: [
      { id: "theme/dark", label: "Dark", icon: "lucide:moon" },
      { id: "theme/light", label: "Light", icon: "lucide:sun" },
    ],
  },
  { id: "mods", label: "Search mods", children: () => [] },
]
const fromEntry = (e: RecentEntry) => ({ id: e.id, label: e.label, href: e.href })

test("a root pick is stored as a bare id, a deeper one as an entry", () => {
  expect(toRecentItem(root[0], [])).toBe("deploy")
  const hit = { id: "mod:sodium", label: "Sodium", image: { src: "https://x/icon.png", fallback: "So" }, recentData: { project: "AANobbMI" } }
  expect(toRecentItem(hit, ["mods"])).toEqual({
    id: "mod:sodium",
    label: "Sodium",
    path: ["mods"],
    image: { src: "https://x/icon.png", alt: undefined, fallback: "So", icon: undefined, shape: undefined },
    data: { project: "AANobbMI" },
  })
})

test("stored history survives JSON and drops what it cannot trust", () => {
  const list = pushRecent(pushRecent(["deploy"], toRecentItem(root[1].children![0], ["theme"]), 20), "deploy", 20)
  const back = readRecent(JSON.parse(JSON.stringify([...list, 42, { id: "x" }, null])))
  expect(back).toEqual(list)
  expect(back[0]).toBe("deploy")
  expect(readRecent("nope")).toEqual([])
  expect(readRecent(["a", "b"])).toEqual(["a", "b"])
})

test("pushRecent moves a repeat pick to the front and caps the list", () => {
  const dark = toRecentItem(root[1].children![0], ["theme"])
  const list = pushRecent(["a", dark, "b"], { ...(dark as RecentEntry) }, 2)
  expect(list).toEqual([dark, "a"])
})

test("history resolves through static paths, the app's resolver, then href", () => {
  const items: RecentItem[] = [
    { id: "theme/dark", label: "Dark (stale)", path: ["theme"] },
    { id: "mod:sodium", label: "Sodium", path: ["mods"], data: { project: "AANobbMI" } },
    { id: "doc:1", label: "Rollback", path: ["mods"], href: "/docs/rollback" },
    { id: "gone", label: "Gone", path: ["mods"] },
    "deploy",
    "missing",
    "theme",
  ]
  const resolve = (e: RecentEntry) => (e.data ? { id: e.id, label: `${e.label} (live)` } : undefined)
  const out = resolveRecentItems(items, root, { limit: 10, resolve, fromEntry })
  expect(out.map((r) => r.command.label)).toEqual(["Dark", "Sodium (live)", "Rollback", "Deploy"])
  expect(out[0].command).toBe(root[1].children![0])
  expect(out[0].path).toEqual(["theme"])
  expect(resolveRecentItems(items, root, { limit: 2, resolve, fromEntry }).length).toBe(2)
})

test("recent rows obey exclusions, and in: matches their group or the Recent heading", () => {
  const deploy = { label: "Deploy", group: "Actions" }
  expect(recentVisible(deploy, parseCommandQuery("-deploy"), "Recent")).toBe(false)
  expect(recentVisible(deploy, parseCommandQuery("-theme"), "Recent")).toBe(true)
  expect(recentVisible(deploy, parseCommandQuery("in:recent"), "Recent")).toBe(true)
  expect(recentVisible(deploy, parseCommandQuery("in:actions"), "Recent")).toBe(true)
  expect(recentVisible(deploy, parseCommandQuery("in:settings"), "Recent")).toBe(false)
})
