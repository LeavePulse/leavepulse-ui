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

export function rankCommandItems<T extends SearchableCommand>(items: T[], terms: CommandSearchTerms): T[] {
  return items
    .map((command) => ({ command, score: score(command, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label))
    .map((entry) => entry.command)
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
