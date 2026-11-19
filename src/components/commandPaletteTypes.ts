/*
 * The public types of LpCommandPalette, kept apart from the SFC so the
 * palette's own helpers (and the modules that only need `Command`) can import
 * them without the component. LpCommandPalette.vue re-exports every one.
 */
import type { Component } from "vue"
import type { PaletteMode } from "./commandPalette"
import type { PaletteQuery } from "./commandSearch"

/**
 * A picture in a row's icon slot: an avatar, a project logo, a world's
 * thumbnail. While it loads, and for good if it fails, the row shows
 * `fallback` (initials) or else `icon`, so a dead link never leaves a hole.
 */
export interface CommandImage {
  src?: string | null
  alt?: string
  /** Text shown while there is no picture, usually initials. */
  fallback?: string
  /** Icon shown while there is no picture; the command's `icon` when unset. */
  icon?: string
  /** circle for people, soft or square for things. Defaults to soft. */
  shape?: "circle" | "soft" | "square"
}

export interface Command {
  id: string
  label: string
  /** Second line under the label. */
  description?: string
  /**
   * A passage of the matched text, wrapped over several lines (clamped by
   * `excerptLines`) instead of truncated to one. For results a server found
   * inside long text — a docs section, a ticket, a message — where the reason
   * the row matched is the part worth reading before opening it.
   */
  excerpt?: string
  /**
   * Extra words to highlight besides the typed query. A server that matches
   * word forms or typos knows which words actually matched; the query alone
   * would leave those unmarked.
   */
  highlight?: string[]
  icon?: string
  /**
   * A picture in place of the icon: a URL, or a `CommandImage` with a
   * fallback. Sized like the icon and faded in once loaded; until then, and
   * when it fails, the fallback (or `icon`) holds the slot.
   */
  image?: string | CommandImage
  /**
   * Right-aligned hint, written as LpKeys reads it: "Ctrl+P" (shown as ⌘P on
   * an Apple keyboard), "G I" for a sequence.
   */
  shortcut?: string
  /** Extra search terms not shown but matched against the query. */
  keywords?: string[]
  /** Section heading this command sits under. */
  group?: string
  disabled?: boolean
  /**
   * Hidden from the default (empty-query) list and surfaced only when the query
   * names it: every typed word starts a word of its label or keywords. A word
   * inside another word, the description or a near miss does not reveal it.
   * For rarely-used or destructive actions (prune, decommission, …) that
   * shouldn't clutter the palette but stay reachable.
   */
  hidden?: boolean
  /**
   * For a hidden command: the words that reveal it, instead of its label and
   * keywords. A variant whose label repeats its parent's word ("Vacation: sick
   * leave…") then stays out of a search for the parent and shows up for "sick".
   */
  revealOn?: string[]
  /**
   * Picking this opens a mode instead of closing: a nested list, either given
   * outright or fetched from the query typed inside it. This is what keeps a
   * palette from flattening "restart <service>" into one row per service —
   * and what lets the second step search a list too big to enumerate.
   *
   * `onSelect` still runs when the mode opens, so a command can both act and
   * drill in. A fetcher is called like `search` (see CommandFetcher): its
   * abort signal may never reach the transport, and an answer that lands
   * after the query moved on or the mode was left is discarded.
   */
  children?: Command[] | CommandFetcher
  /** Placeholder while inside this command's mode. */
  childPlaceholder?: string
  /**
   * The mode's name in the chip beside the box, when the row's label is a
   * sentence: "Mods" for a row reading `Search mods for "{query}"`. Without
   * it a `{query}` placeholder and its quotes are dropped from the label.
   */
  modeLabel?: string
  /**
   * Typed at the start of the box, enters this command's mode directly, and
   * whatever follows the prefix becomes the query inside it: ">" for
   * commands, "mr " for a mod search. Only for a command with `children`,
   * matched against the list on screen (the root, or the open mode's own
   * static children), longest prefix first, letters in any case. Entering
   * this way does not run `onSelect`. The row shows the prefix as its hint
   * when it has no `shortcut`.
   */
  prefix?: string
  /**
   * Opening this mode takes the query typed so far along, operators and
   * all, so typing "sodium", arrowing to "Search mods" and pressing Enter
   * opens the mod search already searching for sodium instead of starting
   * it empty. Backspace out of the mode restores the query as it was.
   */
  carryQuery?: boolean
  /**
   * A "search somewhere else" row: listed only while words are typed, for
   * any words (it is not matched against them), after local and fetched
   * results: at the end of the list, or of its group when that group is
   * already listed. `{query}` in the label becomes the
   * typed words without the operators, `Search Modrinth for "{query}"`;
   * `-word` and `in:group` still apply to the row's own label, keywords and
   * group. Usually a mode with `carryQuery`, so picking it runs the search.
   */
  fallback?: boolean
  /**
   * Keep this out of the recent history. Picks are remembered wherever they
   * are made, inside modes and among fetched results too; a pick that is a
   * setting rather than a destination (a language, a zoom step) can opt out.
   * Rows offered by Tab (`actions`) are never remembered.
   */
  remember?: boolean
  /**
   * A JSON-safe value stored with this command in the recent history and
   * handed back to `resolveRecent`: what an app needs to rebuild a result
   * that a search fetched (a project id, a hit), since the command's
   * functions cannot be stored.
   */
  recentData?: unknown
  /**
   * Keep the palette open after this runs. For a command that toggles
   * something the user may want to toggle again (a theme, a filter) without
   * reopening and retyping.
   */
  keepOpen?: boolean
  /**
   * Where the command leads. The row renders as a real link, so Ctrl/⌘-click,
   * Shift-click and middle-click open it the way the browser opens any link,
   * and Ctrl/⌘+Enter opens it in a new tab from the keyboard. A plain pick
   * still runs `onSelect` (a router push, say); without one it follows the
   * link.
   */
  href?: string
  /**
   * Further things to do with this result besides opening it — copy its id,
   * open it elsewhere, share it. Tab on the highlighted row lists them as a
   * mode named after the row. A command with `href` gets "open in new tab"
   * and "copy link" after its own.
   */
  actions?: Command[]
  /**
   * The whole text behind this result, for the preview pane (`previewPane`):
   * the section a docs hit points into, the ticket body, the message. Line
   * breaks are kept. Without it the pane shows the `excerpt`.
   */
  preview?: string
  /**
   * This row has nothing for the pane, even with a `#preview` slot: the pane
   * folds away while it is highlighted instead of the slot having to draw a
   * placeholder. For a whole class of rows, `hasPreview` says it once.
   */
  noPreview?: boolean
  /** Render a live editor or other rich preview without an application-wide slot. */
  previewComponent?: Component
  /** Enter or click focuses the preview editor, including on narrow screens. */
  editInPreview?: boolean
  /** Runs after the dialog releases its focus trap (e.g. focus the original field). */
  afterClose?: () => void
  prompt?: CommandPrompt
  /** Called only when execution succeeded, with its result. */
  undo?: (result: unknown) => unknown | Promise<unknown>
  onSelect?: () => unknown | Promise<unknown>
}

export interface CommandPrompt {
  placeholder?: string
  initial?: string
  validate?: (value: string) => string | undefined | Promise<string | undefined>
  submit: (value: string) => unknown | Promise<unknown>
}

/**
 * Commands fetched for a query: `search` at the root, a function `children`
 * inside a mode.
 *
 * `query` is the box's positive words only, in the case they were typed:
 * `sodium -forge in:mods` arrives as "sodium", because a server would treat
 * the operators as words to find. They come in `parsed` instead (a
 * PaletteQuery: `raw`, `text`, lowercased `include`, `exclude` and `groups`)
 * for a provider that can scope or exclude on its side; either way the
 * palette drops returned rows that match an exclusion or miss an `in:` scope.
 *
 * `signal` aborts when the query moves on, the mode is left or the palette
 * closes. It is a courtesy, not a guarantee: hand it to `fetch` and the
 * request is cancelled, but a transport that cannot be cancelled (a Tauri
 * `invoke`, a worker message, most SDKs) never sees it and runs to the end.
 * That is safe: an answer that lands after a newer request was made, or
 * after the palette closed, is discarded and never reaches the list, so a
 * fetcher does not need to check the signal itself. Checking it before an
 * expensive step is only a saving.
 *
 * A fetcher that gathers from sources of different speeds (a local index, a
 * database, a slow remote) can return an async iterable instead — an async
 * generator is the easy way — and yield as it goes, so the quick sources show
 * without waiting for the slow one. Each batch is the whole list so far and
 * replaces the one before; the last is the answer. The search keeps its
 * loading bar until the iterable ends, the highlight stays on the row it was
 * on as rows are added, and when the query moves on the signal aborts and the
 * iterable is closed (`return()`) — a generator parked in an `await` only
 * closes at its next `yield`, running its `finally` there, so pass the signal
 * on to what it awaits. A throw after some batches keeps them on screen, with
 * a line saying the rest could not be fetched:
 *
 *   async function* search(q, signal) {
 *     const local = index.find(q)
 *     yield local
 *     const remote = await api.search(q, { signal })
 *     yield [...local, ...remote]
 *   }
 */
export type CommandFetcher = (
  query: string,
  signal: AbortSignal,
  parsed: PaletteQuery,
) => Command[] | Promise<Command[]> | AsyncIterable<Command[]>

/** Footer hints and the mode chip, spelled out so an app can translate them. */
export type PaletteLabels = Partial<Record<PaletteMode, string>> & {
  navigate: string
  pin?: string
  unpin?: string
  undo?: string
  backToResults?: string
  actionFailed?: string
  submit?: string
  running?: string
  search?: string
  pinned?: string
  select: string
  close: string
  /** The close button that stands in for Esc on a touch screen. */
  dismiss: string
  /** Hint for leaving a mode, shown only while inside one. */
  back: string
  searching: string
  /** Shown when `search` (or a fetching mode) threw. */
  searchFailed: string
  /** Shown under streamed results when the fetcher threw after some of them; defaults to "Some results could not be loaded." */
  searchIncomplete?: string
  retry: string
  /** The row that unfolds a group cut by `groupLimit`; `{count}` is how many are hidden. */
  showMore: string
  /** Footer hint for Tab while the highlighted row has actions. */
  actions: string
  openInNewTab: string
  copyLink: string
  /** Toast after "copy link"; empty for none. */
  linkCopied: string
  /**
   * @deprecated The pane now closes for a row with nothing to show, so this
   * text is never displayed. Kept so existing `labels` objects still type-check.
   */
  noPreview?: string
  /** Accessible name and description of the dialog, read by screen readers only. */
  title?: string
  description?: string
  /** The key hint printed beside the box and in the footer. */
  esc?: string
  /** The Tab key's name in the footer hint for a row's actions. */
  tab?: string
}
