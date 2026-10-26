import { applyQueryFilters, parsePaletteQuery, type CommandSearchTerms, type HighlightPart, type SearchableCommand } from "./commandSearch"
import type { Command } from "./LpCommandPalette.vue"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"

/** The same action definitions serve a row menu and the command palette. */
export function menuPaletteCommands(items: ContextMenuItemDef[], prefix: string): Command[] {
  return items.map((item, index) => ({
    id: `${prefix}/${index}`, label: item.label, icon: item.icon, disabled: item.disabled,
    onSelect: item.onSelect, keepOpen: item.checked !== undefined,
    children: item.children ? menuPaletteCommands(item.children, `${prefix}/${index}`) : undefined,
  }))
}

/*
 * The parts of LpCommandPalette that are plain logic, kept out of the SFC so
 * they can be tested without mounting a dialog.
 */

/** The fields of a command that decide whether the preview pane opens for it. */
export interface PreviewableCommand {
  previewComponent?: unknown
  preview?: string
  excerpt?: string
  noPreview?: boolean
}

/**
 * Whether the pane has something to show for a row. `noPreview` on the row
 * wins, then the app's `hasPreview`; without either, a row qualifies when the
 * app supplied a `#preview` slot or the row carries text of its own.
 */
export function commandHasPreview<T extends PreviewableCommand>(
  command: T | undefined,
  options: { slot: boolean; hasPreview?: (command: T) => boolean },
): boolean {
  if (!command || command.noPreview) return false
  if (options.hasPreview) return options.hasPreview(command)
  return options.slot || !!(command.previewComponent || command.preview || command.excerpt)
}

export const PALETTE_MODES = {
  people: { prefix: "@", label: "People", icon: "lucide:users" },
  channels: { prefix: "#", label: "Channels", icon: "lucide:hash" },
  roles: { prefix: "&", label: "Roles", icon: "lucide:shield" },
  commands: { prefix: ">", label: "Commands", icon: "lucide:terminal" },
  help: { prefix: "?", label: "Help", icon: "lucide:circle-help" },
} as const
export type PaletteMode = keyof typeof PALETTE_MODES

/** One line of LpPaletteFacts: what it is, and what it is set to now. */
export interface PaletteFact {
  /** Text, or the preview slot's `highlight(text)` to mark the query. */
  label: string | HighlightPart[]
  /** Right-aligned value; a change rolls in rather than swapping. */
  value?: string | number
  /** A second, quieter line under the label. */
  hint?: string | HighlightPart[]
  icon?: string
  /** A colour dot in place of the icon: a role colour, a status. */
  color?: string
  /** Marks the row that is in effect now: the current theme, the open tab. */
  current?: boolean
  /** Draw the value in the monospace face: ids, paths, versions. */
  mono?: boolean
}

/** One tile of LpPaletteStats. */
export interface PaletteStat {
  label: string
  /** A number counts to its new value; text rolls. */
  value: number | string
  /** Abbreviate a number: 1.2k, 3.4M. */
  compact?: boolean
  suffix?: string
  format?: (value: number) => string
}

/** The fields of a command that let typing enter its mode. */
export interface PrefixedCommand {
  prefix?: string
  children?: unknown
  disabled?: boolean
}

/**
 * The mode a query opens by its prefix, and the query left after it. Only a
 * command with `children` and a non-empty `prefix` qualifies; letters match
 * in any case, and the longest prefix wins, so "mr " and "m" can live side by
 * side. Leading spaces are ignored: they are never what someone meant.
 */
export function matchModePrefix<T extends PrefixedCommand>(
  query: string,
  commands: readonly T[],
): { command: T; rest: string } | null {
  const typed = query.trimStart().toLowerCase()
  let best: T | null = null
  for (const command of commands) {
    const prefix = command.prefix?.toLowerCase()
    if (!prefix || !command.children || command.disabled || !typed.startsWith(prefix)) continue
    if (!best || prefix.length > (best.prefix?.length ?? 0)) best = command
  }
  if (!best) return null
  return { command: best, rest: query.trimStart().slice(best.prefix!.length) }
}

/** The fields of a command that make it a "search elsewhere" row. */
export interface FallbackCommand extends SearchableCommand {
  fallback?: boolean
  hidden?: boolean
}

/**
 * The fallback rows to show for a query, with their labels filled in. They
 * appear only while positive words are typed, whatever those words are: the
 * row offers to search somewhere else for them, so matching it against them
 * would hide it exactly when it is needed. Exclusions and `in:` scopes still
 * apply, to the row's own label, keywords and group. `{query}` in the label
 * becomes the positive words, without the operators.
 */
export function fallbackRows<T extends FallbackCommand>(
  items: readonly T[],
  raw: string,
): { command: T; label: string }[] {
  const parsed = parsePaletteQuery(raw.trim())
  if (!parsed.text) return []
  return applyQueryFilters(
    items.filter((c) => c.fallback),
    parsed,
  ).map((command) => ({ command, label: command.label.split("{query}").join(parsed.text) }))
}

/**
 * A remembered pick that is not a root command: one chosen inside a mode, or
 * a result a search fetched. It keeps what the row needs to be drawn again
 * and where it was found, so the palette can find the live command next time
 * (`path` through static children, or the app's `resolveRecent`), and fall
 * back to its `href` when neither can.
 */
export interface RecentEntry {
  id: string
  label: string
  description?: string
  icon?: string
  image?: string | { src?: string | null; alt?: string; fallback?: string; icon?: string; shape?: "circle" | "soft" | "square" }
  href?: string
  /** Ids of the modes it was picked in, outermost first. */
  path: string[]
  /** The command's `recentData`, kept as given for `resolveRecent`. */
  data?: unknown
}

/** A stored history item: a root command id (the old format), or an entry. */
export type RecentItem = string | RecentEntry

/** The fields of a command a history entry is built from and resolved to. */
export interface RecentSource {
  id: string
  label: string
  description?: string
  icon?: string
  image?: RecentEntry["image"]
  href?: string
  recentData?: unknown
  disabled?: boolean
  children?: unknown
}

function isEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string"
    && typeof v.label === "string"
    && Array.isArray(v.path)
    && v.path.every((step) => typeof step === "string")
  )
}

/** Stored history, with anything malformed dropped rather than trusted. */
export function readRecent(stored: unknown): RecentItem[] {
  if (!Array.isArray(stored)) return []
  return stored.filter((v): v is RecentItem => typeof v === "string" || isEntry(v))
}

function recentKey(item: RecentItem): string {
  return typeof item === "string" ? item : [...item.path, item.id].join("\u0000")
}

/**
 * The history item for a pick. A root pick stays a bare id, the format older
 * versions wrote and still read; anything deeper becomes an entry with only
 * the fields that survive JSON.
 */
export function toRecentItem(command: RecentSource, path: readonly string[]): RecentItem {
  if (!path.length) return command.id
  const entry: RecentEntry = { id: command.id, label: command.label, path: [...path] }
  if (command.description) entry.description = command.description
  if (command.icon) entry.icon = command.icon
  if (typeof command.image === "string") entry.image = command.image
  else if (command.image) {
    const { src, alt, fallback, icon, shape } = command.image
    entry.image = { src, alt, fallback, icon, shape }
  }
  if (command.href) entry.href = command.href
  if (command.recentData !== undefined) entry.data = command.recentData
  return entry
}

/** The history with `item` first and any earlier copy of it dropped. */
export function pushRecent(list: readonly RecentItem[], item: RecentItem, keep: number): RecentItem[] {
  const key = recentKey(item)
  return [item, ...list.filter((v) => recentKey(v) !== key)].slice(0, keep)
}

/**
 * The live commands a history stands for, newest first. A bare id is looked
 * up among the root commands; an entry is followed down its path through
 * static children, then offered to `resolve` (for results a fetcher found),
 * and last rebuilt from its own fields when it has an `href` to follow.
 * Whatever none of these can find is skipped, so a stored history never
 * resurrects something that cannot run.
 */
export function resolveRecentItems<T extends RecentSource>(
  items: readonly RecentItem[],
  commands: readonly T[],
  options: { limit: number; resolve?: (entry: RecentEntry) => T | null | undefined; fromEntry: (entry: RecentEntry) => T },
): { command: T; path: string[] }[] {
  const out: { command: T; path: string[] }[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (out.length >= options.limit) break
    const key = recentKey(item)
    if (seen.has(key)) continue
    const found = typeof item === "string" ? commands.find((c) => c.id === item) : findEntry(item, commands, options)
    if (!found || found.disabled || found.children) continue
    seen.add(key)
    out.push({ command: found, path: typeof item === "string" ? [] : [...item.path] })
  }
  return out
}

function findEntry<T extends RecentSource>(
  entry: RecentEntry,
  commands: readonly T[],
  options: { resolve?: (entry: RecentEntry) => T | null | undefined; fromEntry: (entry: RecentEntry) => T },
): T | undefined {
  let level: readonly T[] | null = commands
  for (const step of entry.path) {
    const mode: T | undefined = level?.find((c) => c.id === step)
    level = mode && Array.isArray(mode.children) ? (mode.children as T[]) : null
  }
  const live = level?.find((c) => c.id === entry.id)
  if (live) return live
  const resolved = options.resolve?.(entry)
  if (resolved) return resolved
  return entry.href ? options.fromEntry(entry) : undefined
}

/**
 * Whether a recent row survives the operators typed so far. Recent rows show
 * while no positive words are typed, so "-theme" or "in:recent" filters them
 * like any other row; an `in:` scope matches the row's own group or the
 * Recent heading it sits under.
 */
export function recentVisible(command: SearchableCommand, terms: CommandSearchTerms, recentLabel: string): boolean {
  if (!applyQueryFilters([{ ...command, group: undefined }], { ...terms, groups: [] }).length) return false
  return terms.groups.every((term) =>
    [command.group, recentLabel].some((group) => group?.toLowerCase().includes(term)),
  )
}

/**
 * The name a mode's chip shows. `modeLabel` when given; otherwise the label,
 * with a `{query}` placeholder and the quotes around it taken out, since the
 * words it stood for are in the box now ("Search mods for "{query}"" reads
 * "Search mods").
 */
export function modeChipLabel(command: { label: string; modeLabel?: string }): string {
  if (command.modeLabel) return command.modeLabel
  if (!command.label.includes("{query}")) return command.label
  return command.label
    .replace(/\s*["'“”«»]?\{query\}["'“”«»]?/g, "")
    .replace(/\s+(for|in|on|:)$/i, "")
    .trim()
}
