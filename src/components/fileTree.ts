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

/** Directories first, then case-insensitive by name — the file-manager order. */
export function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
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
