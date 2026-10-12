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
const LATIN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`"
const CYRILLIC = "\u0439\u0446\u0443\u043A\u0435\u043D\u0433\u0448\u0449\u0437\u0445\u044A\u0444\u044B\u0432\u0430\u043F\u0440\u043E\u043B\u0434\u0436\u044D\u044F\u0447\u0441\u043C\u0438\u0442\u044C\u0431\u044E\u0451"
const SWAP = new Map<string, string>()

for (let i = 0; i < LATIN.length; i++) {
  SWAP.set(LATIN[i]!, CYRILLIC[i]!)
  SWAP.set(CYRILLIC[i]!, LATIN[i]!)
}

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

export function swapCommandTerms(terms: CommandSearchTerms): CommandSearchTerms {
  const swap = (term: string) => [...term].map((ch) => SWAP.get(ch) ?? ch).join("")
  return {
    include: terms.include.map(swap),
    exclude: terms.exclude.map(swap),
    groups: terms.groups.map(swap),
  }
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
  return total
}

export function rankCommandItems<T extends SearchableCommand>(items: T[], terms: CommandSearchTerms): T[] {
  return items
    .map((command) => ({ command, score: score(command, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label))
    .map((entry) => entry.command)
}
