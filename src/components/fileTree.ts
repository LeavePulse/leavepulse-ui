/*
 * Shared file-tree types and helpers. Lives in its own module so LpFileTree and
 * its recursive LpFileTreeNode body can both import them without a
 * component-to-component cycle. Re-exported from LpFileTree.vue.
 */

import type { ContextMenuItemDef } from "./LpContextMenu.vue"

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

/** Human-readable byte size — binary units, matching what file managers show. */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB", "PB"]
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  // One decimal below 10 (2.4 MB), none above (240 MB) — keeps the column tidy.
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

/** Short local date-time for the modified column; passes strings through. */
export function formatModified(value: Date | number | string): string {
  if (typeof value === "string") return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
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
  for (const child of node.children) {
    const state = checkStateOf(child, checked)
    if (state === "checked") any = true
    else if (state === "indeterminate") {
      any = true
      all = false
    } else all = false
  }
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

    for (const child of node.children) {
      const childStats = visit(child)
      if (childStats.state === "checked") any = true
      else if (childStats.state === "indeterminate") {
        any = true
        all = false
      } else all = false
      count += childStats.checked
      total += childStats.total
      if (childStats.size !== undefined) {
        bytes += childStats.size
        sized = true
      }
    }

    const self: NodeStats = {
      state: all ? "checked" : any ? "indeterminate" : "unchecked",
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
