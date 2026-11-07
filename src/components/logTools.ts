/*
 * The log viewer's reading tools, free of the component so their rules can be
 * tested alone: pattern search, time range, repeats, correlation ids, structured
 * payloads and what a selection exports as.
 */

/*
 * A pattern is typed by a person but runs over every line of a live stream, and
 * JavaScript cannot interrupt a running match. So the guard is in what may reach
 * the engine: a bounded pattern, none of the nested quantifiers that backtrack
 * catastrophically, a bounded length of text per line, and a time budget per
 * pass that stops starting new lines. A single match on one capped line is the
 * longest it can block.
 */
export const MAX_PATTERN_LENGTH = 200
export const MAX_MATCH_INPUT = 2000
export const MATCH_BUDGET_MS = 50
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,\d*\})/

export type PatternError = "too-long" | "unsafe" | "invalid"

export interface LogPattern {
  test(text: string): boolean
  ranges(text: string): [number, number][]
}

export function compilePattern(source: string): { pattern: LogPattern | null; error: PatternError | null } {
  if (source.length > MAX_PATTERN_LENGTH) return { pattern: null, error: "too-long" }
  if (NESTED_QUANTIFIER.test(source)) return { pattern: null, error: "unsafe" }
  let regex: RegExp
  try {
    regex = new RegExp(source, "giu")
  } catch {
    return { pattern: null, error: "invalid" }
  }
  const capped = (text: string) => (text.length > MAX_MATCH_INPUT ? text.slice(0, MAX_MATCH_INPUT) : text)
  return {
    error: null,
    pattern: {
      test(text) {
        regex.lastIndex = 0
        return regex.test(capped(text))
      },
      ranges(text) {
        const out: [number, number][] = []
        // matchAll starts from wherever the last `test` left the shared regex.
        regex.lastIndex = 0
        for (const match of capped(text).matchAll(regex)) {
          // A zero-width match highlights nothing.
          if (match[0]) out.push([match.index, match.index + match[0].length])
        }
        return out
      },
    },
  }
}

/** Positions of the rows the pattern finds, giving up once the budget is spent. */
export function patternPositions(
  rows: readonly { message: string; source?: string }[],
  pattern: LogPattern,
  now: () => number = () => performance.now(),
): number[] {
  const out: number[] = []
  const deadline = now() + MATCH_BUDGET_MS
  for (let i = 0; i < rows.length; i++) {
    if (now() > deadline) break
    const row = rows[i]
    if (pattern.test(row.message) || (row.source !== undefined && pattern.test(row.source))) out.push(i)
  }
  return out
}

/** Every occurrence of a plain term, case-insensitive. */
export function termRanges(text: string, term: string): [number, number][] {
  const needle = term.toLowerCase()
  if (!needle) return []
  const lower = text.toLowerCase()
  const out: [number, number][] = []
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
    out.push([at, at + needle.length])
  }
  return out
}

/** A line's time as epoch ms; a pre-formatted label ("12:03:05") has none. */
export function timeMs(time: number | string | undefined): number | null {
  if (time == null) return null
  if (typeof time === "number") return Number.isFinite(time) ? time : null
  if (/^\d+$/.test(time)) return Number(time)
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? null : parsed
}

export interface LogTimeRange {
  from?: number | string
  to?: number | string
}

/**
 * Inclusive at both ends. A line with no readable time stays: most are the
 * continuation of the entry above (a stack frame), and hiding them would cut
 * the entries the range keeps in half.
 */
export function inTimeRange(time: number | string | undefined, range: LogTimeRange | undefined): boolean {
  if (!range) return true
  const at = timeMs(time)
  if (at === null) return true
  const from = timeMs(range.from)
  const to = timeMs(range.to)
  return (from === null || at >= from) && (to === null || at <= to)
}

/** The position of the row closest in time, -1 when none has a readable time. */
export function nearestByTime(rows: readonly { time?: number | string }[], target: number | string): number {
  const wanted = timeMs(target)
  if (wanted === null) return -1
  let best = -1
  let distance = Infinity
  rows.forEach((row, i) => {
    const at = timeMs(row.time)
    if (at === null) return
    const gap = Math.abs(at - wanted)
    if (gap < distance) {
      best = i
      distance = gap
    }
  })
  return best
}

const VOLATILE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\b0x[0-9a-f]+\b|\b[0-9a-f]{16,}\b|\d+(?:\.\d+)*/gi

/** A message with its volatile parts (numbers, ids, hashes) blanked, so repeats compare equal. */
export function messageShape(message: string): string {
  return message.replace(VOLATILE, "#")
}

export interface RepeatRow<L> {
  line: L
  n: number
  count: number
}

/** Folds rows of the same level, source and shape into the first, wherever they sit. */
export function groupRepeats<L extends { message: string; level?: string; source?: string }>(
  rows: readonly { line: L; n: number }[],
): RepeatRow<L>[] {
  const groups = new Map<string, RepeatRow<L>>()
  for (const { line, n } of rows) {
    const key = [line.level ?? "", line.source ?? "", messageShape(line.message)].join("\0")
    const group = groups.get(key)
    if (group) group.count++
    else groups.set(key, { line, n, count: 1 })
  }
  return [...groups.values()]
}

export type LogIdKind = "trace" | "request" | "span" | "correlation"

export interface LogId {
  kind: LogIdKind
  value: string
  start: number
  end: number
}

const ID_PATTERN = /\b(trace|request|req|span|correlation|corr)[_-]?id["']?\s*[=:]\s*["']?([\w-]{6,})/gi
const ID_KINDS: Record<string, LogIdKind> = {
  trace: "trace",
  request: "request",
  req: "request",
  span: "span",
  correlation: "correlation",
  corr: "correlation",
}

/** The correlation ids a message carries, as `trace_id=abc` or `"requestId": "abc"`. */
export function findIds(message: string): LogId[] {
  const out: LogId[] = []
  for (const match of message.matchAll(ID_PATTERN)) {
    const value = match[2]
    const start = match.index + match[0].length - value.length
    out.push({ kind: ID_KINDS[match[1].toLowerCase()], value, start, end: start + value.length })
  }
  return out
}

export interface MessagePart {
  text: string
  hit: boolean
  id?: LogId
}

/** A message cut around its search hits and ids. An id wins where the two overlap. */
export function messageParts(message: string, hits: readonly [number, number][], ids: readonly LogId[]): MessagePart[] {
  const parts: MessagePart[] = []
  const plain = (from: number, to: number) => {
    let at = from
    for (const [start, end] of hits) {
      if (end <= at || start >= to) continue
      if (start > at) parts.push({ text: message.slice(at, start), hit: false })
      const stop = Math.min(end, to)
      parts.push({ text: message.slice(Math.max(start, at), stop), hit: true })
      at = stop
    }
    if (at < to) parts.push({ text: message.slice(at, to), hit: false })
  }
  let at = 0
  for (const id of ids) {
    plain(at, id.start)
    parts.push({ text: message.slice(id.start, id.end), hit: false, id })
    at = id.end
  }
  plain(at, message.length)
  return parts.length ? parts : [{ text: message, hit: false }]
}

/** The object or array a message holds, whole or after a text prefix; null when it holds none. */
export function structuredPayload(message: string): object | null {
  const start = message.search(/[{[]/)
  if (start < 0) return null
  try {
    const value: unknown = JSON.parse(message.slice(start))
    return typeof value === "object" && value !== null ? value : null
  } catch {
    return null
  }
}

export interface JsonRow {
  path: string
  depth: number
  label: string
  /** Rendered value; for an object or array its size, as `{3}` or `[3]`. */
  value: string
  kind: "object" | "array" | "string" | "number" | "boolean" | "null"
  expandable: boolean
}

function kindOf(value: unknown): JsonRow["kind"] {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  const type = typeof value
  return type === "string" || type === "number" || type === "boolean" ? type : "object"
}

function holds(value: unknown, needle: string, label: string): boolean {
  if (label.toLowerCase().includes(needle)) return true
  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, child]) => holds(child, needle, key))
  }
  return String(value).toLowerCase().includes(needle)
}

/**
 * A payload as flat rows, skipping what is collapsed. With `filter`, only the
 * fields whose name or value hold it, plus the parents leading to them.
 */
export function jsonRows(root: object, collapsed: ReadonlySet<string>, filter = ""): JsonRow[] {
  const needle = filter.trim().toLowerCase()
  const rows: JsonRow[] = []
  const walk = (value: object, parent: string, depth: number) => {
    for (const [label, child] of Object.entries(value)) {
      if (needle && !holds(child, needle, label)) continue
      const path = parent ? `${parent}.${label}` : label
      const kind = kindOf(child)
      const nested = kind === "object" || kind === "array"
      const size = nested ? Object.keys(child as object).length : 0
      const shown = kind === "array" ? `[${size}]` : kind === "object" ? `{${size}}` : kind === "string" ? (child as string) : String(child)
      rows.push({ path, depth, label, value: shown, kind, expandable: nested && size > 0 })
      if (nested && !collapsed.has(path)) walk(child as object, path, depth + 1)
    }
  }
  walk(root, "", 0)
  return rows
}

const STACK_FRAME = /^\s*(?:at\s+\S|File ".+", line \d+|#\d+\s|\S+\.\w+:\d+)/

/** Text split into lines, with a stack's frames marked; null when it holds no stack. */
export function stackLines(text: string): { text: string; frame: boolean }[] | null {
  const lines = text.split(/\r?\n/).map((line) => ({ text: line, frame: STACK_FRAME.test(line) }))
  return lines.length > 1 && lines.some((line) => line.frame) ? lines : null
}

export type LogExportFormat = "text" | "ndjson"

/** Lines as a file: readable text, or one JSON object per line. */
export function exportLines<L>(lines: readonly L[], format: LogExportFormat, asText: (line: L) => string): string {
  const rows = format === "ndjson" ? lines.map((line) => JSON.stringify(line)) : lines.map(asText)
  return rows.join("\n")
}

/** The inclusive run between two row numbers, whichever order they came in. */
export function rowSpan(from: number, to: number): [number, number] {
  return from <= to ? [from, to] : [to, from]
}
