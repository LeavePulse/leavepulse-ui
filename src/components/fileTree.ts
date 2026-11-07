/*
 * Shared file-tree types and helpers. Lives in its own module so LpFileTree and
 * its recursive LpFileTreeNode body can both import them without a
 * component-to-component cycle. Re-exported from LpFileTree.vue.
 */

import { clamp } from "../composables/clamp"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"
import { formatBytes } from "./format"

export interface FileNode {
  /** Stable identity — use the full path when you have one. */
  id: string
  name: string
  /** Directories can hold `children`; files are leaves. */
  kind: "file" | "dir"
  /** Size in bytes. Shown right-aligned when `showSize` is on. */
  size?: number
  /** Last-modified time — Date, epoch ms, or a pre-formatted string. */
  modified?: Date | number | string
  /** Extra right-aligned text (badge-ish), e.g. "read-only". */
  meta?: string
  /**
   * Omit on a directory to mark its children as not-yet-loaded: the row shows a
   * chevron and emits `expand` on first open so the caller can fetch them.
   * An empty array means "loaded, and genuinely empty".
   */
  children?: FileNode[]
  /** Override the type-derived icon. */
  icon?: string
  /** Dimmed row (e.g. a git-ignored or unreadable entry). Still expandable. */
  disabled?: boolean
  /** Right-click menu for this entry. */
  menu?: ContextMenuItemDef[]
}

/** Directory icons are state-driven; files fall back to an extension map. */
const EXT_ICONS: Record<string, string> = {
  json: "lucide:file-json",
  jsonc: "lucide:file-json",
  yaml: "lucide:file-cog",
  yml: "lucide:file-cog",
  toml: "lucide:file-cog",
  ini: "lucide:file-cog",
  conf: "lucide:file-cog",
  env: "lucide:file-key",
  ts: "lucide:file-code",
  tsx: "lucide:file-code",
  js: "lucide:file-code",
  mjs: "lucide:file-code",
  cjs: "lucide:file-code",
  vue: "lucide:file-code",
  py: "lucide:file-code",
  rs: "lucide:file-code",
  go: "lucide:file-code",
  sh: "lucide:file-terminal",
  zsh: "lucide:file-terminal",
  bash: "lucide:file-terminal",
  md: "lucide:file-text",
  mdx: "lucide:file-text",
  txt: "lucide:file-text",
  log: "lucide:scroll-text",
  csv: "lucide:file-spreadsheet",
  sql: "lucide:database",
  png: "lucide:file-image",
  jpg: "lucide:file-image",
  jpeg: "lucide:file-image",
  gif: "lucide:file-image",
  svg: "lucide:file-image",
  webp: "lucide:file-image",
  ico: "lucide:file-image",
  zip: "lucide:file-archive",
  gz: "lucide:file-archive",
  tar: "lucide:file-archive",
  tgz: "lucide:file-archive",
  xz: "lucide:file-archive",
  pdf: "lucide:file-type",
  lock: "lucide:file-lock",
  pem: "lucide:file-key",
  key: "lucide:file-key",
  crt: "lucide:file-key",
}

/** Dotfiles that read as config regardless of extension. */
const NAME_ICONS: Record<string, string> = {
  ".env": "lucide:file-key",
  ".gitignore": "lucide:git-branch",
  ".dockerignore": "lucide:container",
  dockerfile: "lucide:container",
  "docker-compose.yml": "lucide:container",
  "docker-compose.yaml": "lucide:container",
  makefile: "lucide:file-cog",
  "package.json": "lucide:package",
}

/** Icon for a node: explicit override → dir state → name → extension → generic. */
export function fileIcon(node: FileNode, expanded = false): string {
  if (node.icon) return node.icon
  if (node.kind === "dir") return expanded ? "lucide:folder-open" : "lucide:folder"

  const lower = node.name.toLowerCase()
  if (NAME_ICONS[lower]) return NAME_ICONS[lower]
  // Leading dot doesn't start an extension (".env" is a name, not an ext).
  const dot = lower.lastIndexOf(".")
  const ext = dot > 0 ? lower.slice(dot + 1) : ""
  return EXT_ICONS[ext] ?? "lucide:file"
}

/*
 * Built once. `String.localeCompare` with options constructs a collator on every
 * call, which on a few thousand nodes costs tens of milliseconds — enough to
 * drop frames while a dialog is animating open.
 */
const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

/** Directories first, then case-insensitive by name — the file-manager order. */
export function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1
    return NAME_COLLATOR.compare(a.name, b.name)
  })
}

/**
 * Human-readable byte size for the size column (`formatBytes`, binary units,
 * matching what file managers show). The decimal is kept even when it is zero
 * ("1.0 MB") so the column holds one shape from row to row.
 */
export function formatSize(bytes: number, locale?: string): string {
  return formatBytes(bytes, locale, { fixed: true })
}

const modifiedFormats = new Map<string, Intl.DateTimeFormat>()

/** Short local date-time for the modified column; passes strings through. */
export function formatModified(value: Date | number | string, locale?: string): string {
  if (typeof value === "string") return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  // Built once per locale: the column formats a date on every row.
  const key = locale ?? ""
  let format = modifiedFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    modifiedFormats.set(key, format)
  }
  return format.format(date)
}

/**
 * Total size of a subtree: a directory's own `size` when the caller computed one
 * (the common case for a server-side listing), otherwise the sum of its loaded
 * descendants. Returns undefined when nothing along the way carries a size.
 */
export function subtreeSize(node: FileNode): number | undefined {
  if (node.kind === "file") return node.size
  if (node.size !== undefined) return node.size
  if (!node.children?.length) return undefined
  let total = 0
  let seen = false
  for (const child of node.children) {
    const size = subtreeSize(child)
    if (size !== undefined) {
      total += size
      seen = true
    }
  }
  return seen ? total : undefined
}

/** Every id in a subtree including the root — the unit a checkbox toggles. */
export function subtreeIds(node: FileNode): string[] {
  const out = [node.id]
  for (const child of node.children ?? []) out.push(...subtreeIds(child))
  return out
}

export type CheckState = "checked" | "unchecked" | "indeterminate"

/**
 * A node's checkbox state derived from the checked-id set.
 *
 * A directory reflects its loaded children: all checked → checked, some →
 * indeterminate. A directory whose children aren't loaded yet (or which has
 * none) falls back to its own membership, so an unexpanded folder can still be
 * ticked as a whole — which is exactly what a backup picker needs.
 */
export function checkStateOf(node: FileNode, checked: ReadonlySet<string>): CheckState {
  if (node.kind === "file" || !node.children?.length) {
    return checked.has(node.id) ? "checked" : "unchecked"
  }
  let all = true
  let any = false
  let considered = 0
  for (const child of node.children) {
    const state = checkStateOf(child, checked)
    // A locked, unticked entry can never be ticked, so it must not hold its
    // folder at "indeterminate" forever.
    if (child.disabled && state === "unchecked") continue
    considered++
    if (state === "checked") any = true
    else if (state === "indeterminate") {
      any = true
      all = false
    } else all = false
  }
  if (!considered) return checked.has(node.id) ? "checked" : "unchecked"
  if (all) return "checked"
  return any ? "indeterminate" : "unchecked"
}

/**
 * How much of a directory's subtree is ticked, counting FILES only (folders are
 * containers, not payload). Lets a row say "3 / 12" so a half-filled checkbox
 * isn't the only clue that a folder is partially selected.
 */
export function checkedCount(
  node: FileNode,
  checked: ReadonlySet<string>,
): { checked: number; total: number } {
  let count = 0
  let total = 0
  function walk(list: FileNode[]) {
    for (const child of list) {
      if (child.kind === "file") {
        total++
        if (checked.has(child.id)) count++
      } else if (child.children?.length) {
        walk(child.children)
      }
    }
  }
  walk(node.children ?? [])
  return { checked: count, total }
}

/** Everything a row needs to render, precomputed once per node. */
export interface NodeStats {
  state: CheckState
  /** Ticked files in the subtree, and how many there are in total. */
  checked: number
  total: number
  /** Rolled-up subtree size, or undefined when nothing carries one. */
  size?: number
}

/**
 * Derive every row's state in ONE post-order pass over the tree, keyed by node
 * id. Calling `checkStateOf`/`subtreeSize`/`checkedCount` per row instead makes
 * each row walk its own subtree, which is quadratic on a deep tree and shows up
 * as a stutter the moment a directory holds a few thousand files.
 */
export function computeStats(
  nodes: FileNode[],
  checked: ReadonlySet<string>,
): Map<string, NodeStats> {
  const stats = new Map<string, NodeStats>()

  function visit(node: FileNode): NodeStats {
    if (node.kind === "file" || !node.children?.length) {
      // A leaf, or a directory whose children aren't loaded: fall back to its
      // own membership so an unexpanded folder can still be ticked whole.
      const isChecked = checked.has(node.id)
      const self: NodeStats = {
        state: isChecked ? "checked" : "unchecked",
        checked: node.kind === "file" && isChecked ? 1 : 0,
        total: node.kind === "file" ? 1 : 0,
        size: node.size,
      }
      stats.set(node.id, self)
      return self
    }

    let all = true
    let any = false
    let count = 0
    let total = 0
    let bytes = 0
    let sized = node.size !== undefined
    let considered = 0

    for (const child of node.children) {
      const childStats = visit(child)
      if (!child.disabled || childStats.state !== "unchecked") {
        considered++
        if (childStats.state === "checked") any = true
        else if (childStats.state === "indeterminate") {
          any = true
          all = false
        } else all = false
      }
      count += childStats.checked
      total += childStats.total
      if (childStats.size !== undefined) {
        bytes += childStats.size
        sized = true
      }
    }

    const own: CheckState = checked.has(node.id) ? "checked" : "unchecked"
    const self: NodeStats = {
      state: !considered ? own : all ? "checked" : any ? "indeterminate" : "unchecked",
      checked: count,
      total,
      // An explicit size on the directory wins: a server-side listing usually
      // knows the real figure without the children being loaded.
      size: node.size ?? (sized ? bytes : undefined),
    }
    stats.set(node.id, self)
    return self
  }

  for (const node of nodes) visit(node)
  return stats
}

/** Ids of every ancestor directory of `id`, so callers can reveal a deep node. */
export function ancestorIds(nodes: FileNode[], id: string): string[] {
  const path: string[] = []
  function walk(list: FileNode[], trail: string[]): boolean {
    for (const node of list) {
      if (node.id === id) {
        path.push(...trail)
        return true
      }
      if (node.children && walk(node.children, [...trail, node.id])) return true
    }
    return false
  }
  walk(nodes, [])
  return path
}

/** What narrows the tree. Every field is optional; all that are set must hold. */
export interface FileTreeFilter {
  /** Case-insensitive, against the entry's name and its path from the root. */
  query?: string
  kind?: FileNode["kind"]
  /** File extensions without the dot. A directory never matches one. */
  extensions?: string[]
  /** Bytes, inclusive. An entry with no `size` does not match. */
  minSize?: number
  maxSize?: number
  /** Inclusive. An entry with no readable `modified` does not match. */
  modifiedFrom?: Date | number
  modifiedTo?: Date | number
}

const PATH_SEPARATOR = "/"

/** A file's extension, lowercase. A leading dot starts a name, not an extension. */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}

function modifiedTime(value: FileNode["modified"]): number {
  if (value === undefined) return Number.NaN
  return value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value)
}

const timeOf = (value: Date | number) => (typeof value === "number" ? value : value.getTime())

/** True when no field of the filter would narrow anything. */
export function isFilterEmpty(filter: FileTreeFilter | undefined): boolean {
  if (!filter) return true
  return (
    !filter.query?.trim() &&
    filter.kind === undefined &&
    !filter.extensions?.length &&
    filter.minSize === undefined &&
    filter.maxSize === undefined &&
    filter.modifiedFrom === undefined &&
    filter.modifiedTo === undefined
  )
}

/** Whether one entry, at this path, passes the filter on its own. */
export function matchesFilter(node: FileNode, path: string, filter: FileTreeFilter): boolean {
  const needle = filter.query?.trim().toLowerCase()
  if (needle && !node.name.toLowerCase().includes(needle) && !path.toLowerCase().includes(needle)) return false
  if (filter.kind && node.kind !== filter.kind) return false
  if (filter.extensions?.length) {
    if (node.kind !== "file") return false
    const wanted = filter.extensions.map((ext) => ext.replace(/^\./, "").toLowerCase())
    if (!wanted.includes(fileExtension(node.name))) return false
  }
  if (filter.minSize !== undefined || filter.maxSize !== undefined) {
    if (node.size === undefined) return false
    if (filter.minSize !== undefined && node.size < filter.minSize) return false
    if (filter.maxSize !== undefined && node.size > filter.maxSize) return false
  }
  if (filter.modifiedFrom !== undefined || filter.modifiedTo !== undefined) {
    const time = modifiedTime(node.modified)
    if (Number.isNaN(time)) return false
    if (filter.modifiedFrom !== undefined && time < timeOf(filter.modifiedFrom)) return false
    if (filter.modifiedTo !== undefined && time > timeOf(filter.modifiedTo)) return false
  }
  return true
}

export interface FilteredTree {
  nodes: FileNode[]
  /** Directories that hold a match: shown open while the filter is on. */
  openIds: Set<string>
}

/**
 * The tree with only the matches and the folders leading to them. A kept folder
 * is a copy whose `children` are its kept entries, so what is ticked through it
 * is what is shown. A folder that is not loaded keeps `children` undefined: only
 * loaded entries can be searched.
 */
export function filterTree(nodes: FileNode[], filter: FileTreeFilter | undefined): FilteredTree {
  const openIds = new Set<string>()
  if (!filter || isFilterEmpty(filter)) return { nodes, openIds }
  const active = filter

  function walk(list: FileNode[], parentPath: string): FileNode[] {
    const kept: FileNode[] = []
    for (const node of list) {
      const path = parentPath ? `${parentPath}${PATH_SEPARATOR}${node.name}` : node.name
      const children = node.children && walk(node.children, path)
      if (children?.length) {
        openIds.add(node.id)
        kept.push({ ...node, children })
      } else if (matchesFilter(node, path, active)) {
        kept.push(children ? { ...node, children } : node)
      }
    }
    return kept
  }

  return { nodes: walk(nodes, ""), openIds }
}

/** The tree with children fetched by `load` put in place. The app's own `children` win. */
export function withLoadedChildren(nodes: FileNode[], loaded: ReadonlyMap<string, FileNode[]>): FileNode[] {
  if (!loaded.size) return nodes
  return nodes.map((node) => {
    if (node.kind !== "dir") return node
    const children = node.children ?? loaded.get(node.id)
    if (!children) return node
    return { ...node, children: withLoadedChildren(children, loaded) }
  })
}

/** One row of the flattened tree, with what a flat DOM cannot imply to assistive tech. */
export interface FlatRow {
  node: FileNode
  depth: number
  /** Siblings at this level, and this row's 1-based place among them. */
  setSize: number
  posInSet: number
}

/** The visible rows in render order: open directories followed by their children. */
export function flattenVisible(nodes: FileNode[], open: ReadonlySet<string>, sort: boolean): FlatRow[] {
  const rows: FlatRow[] = []
  function walk(list: FileNode[], depth: number) {
    const ordered = sort ? sortNodes(list) : list
    ordered.forEach((node, index) => {
      rows.push({ node, depth, setSize: ordered.length, posInSet: index + 1 })
      if (node.kind === "dir" && open.has(node.id) && node.children?.length) walk(node.children, depth + 1)
    })
  }
  walk(nodes, 0)
  return rows
}

export interface RowWindow {
  /** First row to render, and one past the last. */
  start: number
  end: number
}

/** Which rows a scroll position shows, with `overscan` extra on each side. */
export function rowWindow(scrollTop: number, viewport: number, rowHeight: number, total: number, overscan: number): RowWindow {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const count = Math.ceil(Math.max(0, viewport) / rowHeight)
  return {
    start: clamp(first - overscan, 0, total),
    end: Math.min(total, first + count + overscan),
  }
}

/** Ids between two rows, inclusive, in row order; locked rows are left out. */
export function rangeIds(rows: readonly FileNode[], anchor: string | undefined, target: string): string[] {
  const to = rows.findIndex((node) => node.id === target)
  if (to < 0) return []
  const found = anchor === undefined ? -1 : rows.findIndex((node) => node.id === anchor)
  const from = found < 0 ? to : found
  return rows
    .slice(Math.min(from, to), Math.max(from, to) + 1)
    .filter((node) => !node.disabled)
    .map((node) => node.id)
}

/** The chain from the root down to `id`, itself included. */
export function nodeTrail(id: string, byId: ReadonlyMap<string, FileNode>, parentOf: ReadonlyMap<string, string>): FileNode[] {
  const trail: FileNode[] = []
  for (let at: string | undefined = id; at !== undefined; at = parentOf.get(at)) {
    const node = byId.get(at)
    if (node) trail.unshift(node)
  }
  return trail
}

/**
 * Whether `sources` may land in `target`: a directory that is not one of them,
 * not inside one of them, and not where all of them already are.
 */
export function canDrop(sources: readonly string[], target: FileNode, parentOf: ReadonlyMap<string, string>): boolean {
  if (target.kind !== "dir" || target.disabled || !sources.length) return false
  for (let at: string | undefined = target.id; at !== undefined; at = parentOf.get(at)) {
    if (sources.includes(at)) return false
  }
  return sources.some((id) => parentOf.get(id) !== target.id)
}

/** Those of `ids` no other of them contains: a moved folder carries what is inside it. */
export function topmostIds(ids: readonly string[], parentOf: ReadonlyMap<string, string>): string[] {
  const all = new Set(ids)
  return ids.filter((id) => {
    for (let at = parentOf.get(id); at !== undefined; at = parentOf.get(at)) {
      if (all.has(at)) return false
    }
    return true
  })
}

export type RenameProblem = "empty" | "separator" | "duplicate"

/** Why a new name cannot stand, or null. An unchanged name is the caller's no-op. */
export function renameProblem(name: string, node: FileNode, siblings: readonly FileNode[]): RenameProblem | null {
  const next = name.trim()
  if (!next) return "empty"
  if (/[/\\\0]/.test(next)) return "separator"
  return siblings.some((other) => other.id !== node.id && other.name === next) ? "duplicate" : null
}

/** How much of a name to select for renaming: the stem, so the extension survives typing. */
export function renameSelectionEnd(node: FileNode): number {
  const dot = node.name.lastIndexOf(".")
  return node.kind === "file" && dot > 0 ? dot : node.name.length
}
