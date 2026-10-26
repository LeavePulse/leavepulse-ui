export interface SearchableCommand {
  label: string
  description?: string
  keywords?: string[]
  group?: string
}

export interface CommandSearchTerms {
  include: string[]
  exclude: string[]
  groups: string[]
}

const QUERY_TOKEN = /(-?)(?:(in):)?(?:"([^"]*)"|(\S+))/giu

export function parseCommandQuery(value: string): CommandSearchTerms {
  const out: CommandSearchTerms = { include: [], exclude: [], groups: [] }
  QUERY_TOKEN.lastIndex = 0
  for (let match; (match = QUERY_TOKEN.exec(value)); ) {
    const text = (match[3] ?? match[4] ?? "").trim().toLowerCase()
    if (!text) continue
    if (match[2] && !match[1]) out.groups.push(text)
    else if (match[1]) out.exclude.push(text)
    else out.include.push(text)
  }
  return out
}

function matches(command: SearchableCommand, term: string): boolean {
  return (
    command.label.toLowerCase().includes(term)
    || (command.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(term))
    || (command.description?.toLowerCase().includes(term) ?? false)
  )
}

function withinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === a.length || i === b.length) return true
  const rest = (x: number, y: number) => a.slice(i + x) === b.slice(i + y)
  return rest(1, 1) || rest(1, 0) || rest(0, 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(2, 2))
}

function nearWord(term: string, label: string): boolean {
  if (term.length < 5) return false
  return label
    .split(/[^\p{L}\p{N}]+/u)
    .some((word) => withinOne(term, word) || (word.length > term.length && withinOne(term, word.slice(0, term.length))))
}

function score(command: SearchableCommand, terms: CommandSearchTerms): number {
  const label = command.label.toLowerCase()
  const keywords = (command.keywords ?? []).map((keyword) => keyword.toLowerCase())
  const description = command.description?.toLowerCase() ?? ""
  const group = command.group?.toLowerCase() ?? ""
  if (terms.exclude.some((term) => matches(command, term)) || terms.groups.some((term) => !group.includes(term))) return 0
  let total = terms.include.length ? 0 : 1
  for (const term of terms.include) {
    let hit = (label.includes(term) ? 4 : 0) + (keywords.some((keyword) => keyword.includes(term)) ? 3 : 0) + (description.includes(term) ? 2 : 0)
    if (!hit && nearWord(term, label)) hit = 1
    if (!hit) return 0
    total += hit
  }
  // A label that IS what was typed, or starts with it, is what the person is
  // naming: "theme" must put the Theme command above ThemeSwitcher, which only
  // contains the word but also matches its keywords and description.
  const typed = terms.include.join(" ")
  if (typed && label === typed) total += 6
  else if (typed && label.startsWith(typed)) total += 2
  return total
}

function rankExact<T extends SearchableCommand>(items: T[], terms: CommandSearchTerms): T[] {
  return items
    .map((command) => ({ command, score: score(command, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label))
    .map((entry) => entry.command)
}

const LATIN_KEYS = "`qwertyuiop[]asdfghjkl;'zxcvbnm,."
const CYRILLIC_KEYS = "ёйцукенгшщзхъфывапролджэячсмитьбю"
const LAYOUT_KEYS = new Map([...LATIN_KEYS].flatMap((key, i) => [[key, CYRILLIC_KEYS[i]!], [CYRILLIC_KEYS[i]!, key]]))

export function swapCommandLayout(value: string): string {
  return [...value].map(char => {
    const replacement = LAYOUT_KEYS.get(char.toLowerCase())
    return replacement ? char === char.toUpperCase() ? replacement.toUpperCase() : replacement : char
  }).join("")
}

export function searchCommandItems<T extends SearchableCommand>(items: T[], terms: CommandSearchTerms): { items: T[]; terms: string[] } {
  const exact = rankExact(items, terms)
  if (exact.length || !terms.include.length) return { items: exact, terms: terms.include }
  const alternate = { include: terms.include.map(swapCommandLayout), exclude: terms.exclude, groups: terms.groups }
  return { items: rankExact(items, alternate), terms: alternate.include }
}

export function rankCommandItems<T extends SearchableCommand>(items: T[], terms: CommandSearchTerms): T[] {
  return searchCommandItems(items, terms).items
}

/**
 * A query as a fetcher receives it. `text` is what a remote search should be
 * sent: the positive words and phrases, in the case they were typed, without
 * the operators a server would not understand. The operators come alongside
 * as data, so a provider that can scope or exclude on the server may.
 */
export interface PaletteQuery extends CommandSearchTerms {
  /** The box as typed, operators and all. */
  raw: string
  /** Positive terms joined by spaces, case kept, quotes dropped. */
  text: string
}

export function parsePaletteQuery(raw: string): PaletteQuery {
  const terms = parseCommandQuery(raw)
  const words: string[] = []
  QUERY_TOKEN.lastIndex = 0
  for (let match; (match = QUERY_TOKEN.exec(raw)); ) {
    const text = (match[3] ?? match[4] ?? "").trim()
    if (text && !match[1] && !match[2]) words.push(text)
  }
  return { ...terms, raw, text: words.join(" ") }
}

/**
 * The operators applied to results someone else matched: a server answered
 * the positive words, and `-word` and `in:group` still have to hold for what
 * it sent back. Positive terms are not re-checked here; the server may match
 * word forms the text does not contain.
 */
export function applyQueryFilters<T extends SearchableCommand>(items: T[], terms: CommandSearchTerms): T[] {
  if (!terms.exclude.length && !terms.groups.length) return items
  return items.filter((command) => {
    const group = command.group?.toLowerCase() ?? ""
    return !terms.exclude.some((term) => matches(command, term)) && terms.groups.every((term) => group.includes(term))
  })
}

/** A run of text, and whether it matched the query. */
export interface HighlightPart {
  text: string
  hit: boolean
}

/**
 * Text split around the terms that matched, for <mark> without v-html. Terms
 * shorter than two characters are skipped (one letter would mark half the
 * text), longer ones win where two start at the same place, and case is
 * ignored. Pass positive terms only: an excluded word is never a match.
 */
export function highlightParts(value: string, terms: readonly string[]): HighlightPart[] {
  const sorted = [...new Set(terms.map((t) => t.toLowerCase()).filter((t) => t.length >= 2))].sort(
    (a, b) => b.length - a.length,
  )
  if (!value || sorted.length === 0) return value ? [{ text: value, hit: false }] : []
  const lower = value.toLowerCase()
  const parts: HighlightPart[] = []
  let i = 0
  while (i < value.length) {
    let at = -1
    let term = ""
    for (const t of sorted) {
      const found = lower.indexOf(t, i)
      if (found !== -1 && (at === -1 || found < at || (found === at && t.length > term.length))) {
        at = found
        term = t
      }
    }
    if (at === -1) {
      parts.push({ text: value.slice(i), hit: false })
      break
    }
    if (at > i) parts.push({ text: value.slice(i, at), hit: false })
    parts.push({ text: value.slice(at, at + term.length), hit: true })
    i = at + term.length
  }
  return parts
}
