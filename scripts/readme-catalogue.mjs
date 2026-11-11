// The component catalogue in README.md, built from the code so it never lags
// behind it: every Lp*.vue component, grouped the way the preview groups it,
// with the first sentence of the comment that opens its source as the line
// that says what it is for. `node scripts/readme-catalogue.mjs` rewrites the
// block between the markers; tests/readmeCatalogue.test.ts fails when it is stale.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const START = "<!-- catalogue:start -->"
export const END = "<!-- catalogue:end -->"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const components = join(root, "src/components")
const entries = join(root, "preview/playground/entries")

/* Preview groups in their order, and the entry files or export suffixes that feed each. */
const GROUPS = [
  { title: "Basics", file: "basics", suffix: "Basics" },
  { title: "Forms", file: "forms", suffix: "Forms" },
  { title: "Data", file: "data", suffix: "Data" },
  { title: "Navigation", file: "navigation" },
  { title: "Overlays and feedback", file: "overlays", suffix: "Overlays" },
  { title: "Motion", file: "motion", suffix: "Motion" },
  { title: "Tours and hints", file: "onboarding" },
  { title: "Theming", file: "theming" },
]
const EXTRA_FILES = ["status", "process", "fields", "looks", "text", "layout"]
const OTHER = "Shell, layout and other"

/** The entries of one preview list: each entry's name and the components it puts in scope. */
function entriesOf(source) {
  const out = []
  const blocks = source.split(/\n  \{\n/).slice(1)
  for (const block of blocks) {
    const name = block.match(/^\s*name:\s*"([^"]+)"/m)?.[1] ?? ""
    const scope = block.match(/components:\s*\{([^}]*)\}/)?.[1] ?? ""
    out.push({ name, components: [...scope.matchAll(/\bLp[A-Za-z]+/g)].map((m) => m[0]) })
  }
  return out
}

/** Every preview list, as [group title, entries], in the preview's order. */
function previewLists() {
  const lists = GROUPS.map((g) => [g.title, entriesOf(readFileSync(join(entries, `${g.file}.ts`), "utf8"))])
  for (const file of EXTRA_FILES) {
    const source = readFileSync(join(entries, `${file}.ts`), "utf8")
    const sections = source.split(/\nexport const /).slice(1)
    for (const section of sections) {
      const suffix = section.match(/^[a-z]+([A-Z][a-z]+)\b/)?.[1]
      const group = GROUPS.find((g) => g.suffix && g.suffix === suffix)
      if (group) lists.push([group.title, entriesOf(section)])
    }
  }
  return lists
}

/** The group a component belongs to: the one whose entry is named after it, else the first that shows it. */
function groupOf(name, lists) {
  const bare = name.replace(/^Lp/, "")
  const named = (entry) =>
    entry.name.split(/\s*[·,]\s*/).some((part) => part.replace(/\s+/g, "").toLowerCase() === bare.toLowerCase())
  for (const [title, list] of lists) if (list.some((e) => named(e) && e.components.includes(name))) return title
  for (const [title, list] of lists) if (list.some((e) => named(e))) return title
  for (const [title, list] of lists) if (list.some((e) => e.components.includes(name))) return title
  return OTHER
}

/* For components whose source opens with no comment that describes them. */
const SUMMARIES = {
  LpAlert: "A notice in the page's flow: info, success, warning or danger, easing between them when it changes.",
  LpBadge: "A short label or count on a tone: a status, a tag, a number of new items.",
  LpBreadcrumbs: "Where the page sits in the app, as a trail of links.",
  LpButton: "The button, in solid, soft, outline, ghost and danger looks, with loading, an icon-only square and a link mode.",
  LpCheckbox: "A checkbox with a label, including the indeterminate state.",
  LpCommandScope: "A registry of commands for LpCommandPalette: what the page and its fields offer, nested scopes first.",
  LpConfirmDialog: "A dialog that asks to confirm an action, with a danger look for destructive ones.",
  LpEmptyState: "What a list or page shows when there is nothing in it yet: an icon, a line and an action.",
  LpInput: "A text field with a label, hint, error, icons, a clear button and leading or trailing slots.",
  LpLink: "A link that renders the app's router link for internal targets and a plain anchor for external ones.",
  LpModal: "A dialog over the page, stacking above the one that opened it, with a guard against losing unsaved input.",
  LpNumberField: "A number field with steppers, limits and locale-aware formatting.",
  LpPaletteTheme: "The theme editor inside LpCommandPalette's preview.",
  LpPopover: "A floating panel anchored to a trigger, for content that is more than a tip.",
  LpRadioGroup: "A set of radio buttons for one choice among a few.",
  LpSlider: "One value on a track, dragged or stepped with the keys.",
  LpStat: "One headline figure with its label, a change against before and an optional sparkline.",
  LpStepper: "The steps of a flow, with where the person is and which are done.",
  LpSwitch: "An on/off switch with a label.",
  LpTable: "A data table: sorting, column filters, selection, row menus, a toolbar with the page's controls, export and paging.",
  LpTextarea: "A multi-line text field that can grow with its content.",
  LpToaster: "Where toasts appear; mount it once near the app root.",
  LpUptimeBar: "Uptime over a period as a row of slices, each coloured by the state it was in.",
  LpAvatar: "A person's picture, or their initials on a colour of their own when there is none.",
  LpCard: "The surface most content sits on, with an optional header, footer and right-click menu.",
  LpDivider: "A rule between blocks, optionally with a label in the middle.",
  LpInfraNode: "A host or service card on LpTopologyCanvas.",
  LpPasswordInput: "A password field with a show/hide button.",
  LpRadio: "One radio button; LpRadioGroup holds a set of them.",
  LpRepeater: "Repeatable form rows with add and remove buttons and a stable identity per row.",
  LpTabs: "Tabs with a sliding indicator, counts and dots, and keyboard movement.",
}

/** The first sentence of the comment that opens the component's script. */
function summaryOf(file) {
  const own = SUMMARIES[file.replace(/\.vue$/, "")]
  if (own) return own
  const source = readFileSync(join(components, file), "utf8")
  const opened = source.slice(Math.max(0, source.search(/<script[^>]*setup/))).replace(/^<script[^>]*>/, "")
  // Only a comment above the props describes the component; later ones describe the code.
  const code = opened.search(/defineProps|withDefaults\(|defineModel|defineEmits/)
  const script = code < 0 ? opened : opened.slice(0, code)
  // The header is a plain block comment; a doc comment (/**) usually belongs to a prop.
  const blocks = [...script.matchAll(/\/\*(\*?)([\s\S]*?)\*\//g)].map((m) => ({ doc: m[1] === "*", body: m[2] }))
  const multiline = (b) => b.body.split("\n").filter((line) => line.replace(/^\s*\*?/, "").trim()).length > 1
  const comment = (blocks.find((b) => !b.doc && multiline(b)) ?? blocks.find((b) => !b.doc) ?? blocks[0])?.body
  if (!comment) return ""
  const text = comment
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, " ")
    .trim()
  const name = file.replace(/\.vue$/, "")
  const bare = text.replace(new RegExp(`^${name}\\s+[—-]\\s+`), "").replace(/^./, (c) => c.toUpperCase())
  const sentence = bare.replace(/\b(e\.g|i\.e|etc)\./g, "$1\u0000").match(/^(.+?[.!?])(\s|$)/)?.[1]?.replace(/\u0000/g, ".") ?? text
  return sentence.length > 200 ? `${sentence.slice(0, 197).trimEnd()}…` : sentence
}

export function catalogue() {
  const lists = previewLists()
  const byGroup = new Map([...GROUPS.map((g) => [g.title, []]), [OTHER, []]])
  const index = readFileSync(join(root, "src/index.ts"), "utf8")
  const exported = new Set([...index.matchAll(/default as (Lp[A-Za-z]+)\b/g)].map((m) => m[1]))
  const files = readdirSync(components).filter((f) => /^Lp.*\.vue$/.test(f) && exported.has(f.replace(/\.vue$/, ""))).sort()
  for (const file of files) {
    const name = file.replace(/\.vue$/, "")
    byGroup.get(groupOf(name, lists)).push([name, summaryOf(file)])
  }
  const lines = [START, "", `${files.length} components. The preview (\`bun run dev\`) shows each one live, with its props, events and slots.`, ""]
  for (const [title, rows] of byGroup) {
    if (!rows.length) continue
    lines.push(`<details>`, `<summary><b>${title}</b> (${rows.length})</summary>`, "")
    for (const [name, summary] of rows) lines.push(`- \`${name}\`${summary ? `: ${summary}` : ""}`)
    lines.push("", `</details>`, "")
  }
  lines.push(END)
  return lines.join("\n")
}

export function withCatalogue(readme) {
  const from = readme.indexOf(START)
  const to = readme.indexOf(END)
  if (from < 0 || to < 0) throw new Error(`README.md has no ${START} … ${END} block`)
  return readme.slice(0, from) + catalogue() + readme.slice(to + END.length)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = join(root, "README.md")
  writeFileSync(path, withCatalogue(readFileSync(path, "utf8")))
}
