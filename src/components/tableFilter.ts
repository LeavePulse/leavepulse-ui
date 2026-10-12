/*
 * The rules behind LpTable's value filters and remembered state, kept pure so
 * they can be tested. A column's filter is the set of HIDDEN values (see
 * LpTable): a value nobody has seen before shows up rather than staying out.
 */

/** Hide everything except `keep`: "show only this" in one step. */
export function onlyValues(values: readonly unknown[], keep: readonly unknown[]): Set<unknown> {
  const kept = new Set(keep)
  return new Set(values.filter((v) => !kept.has(v)))
}

/** Hide every value: the "None" step before ticking the few that matter. */
export function hideAllValues(values: readonly unknown[]): Set<unknown> {
  return new Set(values)
}

/** Swap shown and hidden among the values the column holds. */
export function invertHidden(values: readonly unknown[], hidden: ReadonlySet<unknown>): Set<unknown> {
  return new Set(values.filter((v) => !hidden.has(v)))
}

/** Show these values again, leaving the rest of the filter as it was. */
export function unhideValues(hidden: ReadonlySet<unknown>, values: readonly unknown[]): Set<unknown> {
  const next = new Set(hidden)
  for (const v of values) next.delete(v)
  return next
}

/** Lower-cased and stripped of accents, so "cafe" finds "Café". */
export function foldText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase()
}

/** Every word of the query appears somewhere in the label, in any order. */
export function matchesQuery(label: string, query: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = foldText(label)
  return words.every((w) => hay.includes(w))
}

/** How many rows hold each value of a column. */
export function countValues<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  key: string,
): Map<unknown, number> {
  const counts = new Map<unknown, number>()
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1)
  return counts
}

/**
 * A chip's text for one column's filter: the values still shown, the first
 * `listed` by name and the rest as "+N", which says more than "3 of 12".
 */
export function summarizeShown(shownLabels: readonly string[], listed = 2): string {
  if (shownLabels.length <= listed) return shownLabels.join(", ")
  return `${shownLabels.slice(0, listed).join(", ")} +${shownLabels.length - listed}`
}

// ── remembered state ───────────────────────────────────────────

export interface PersistedTableState {
  sort?: { key: string; dir: "asc" | "desc" } | null
  hidden?: Record<string, unknown[]>
  columns?: string[]
}

type Plain = string | number | boolean | null

function isPlain(value: unknown): value is Plain {
  return value === null || ["string", "number", "boolean"].includes(typeof value)
}

/**
 * The state worth keeping across visits, as JSON. Only plain values survive:
 * a Date or an object hidden in a filter cannot come back as the same value
 * (the filter compares by identity), so it is left out rather than restored
 * as something that matches nothing.
 */
export function serializeTableState(state: PersistedTableState): string {
  const hidden: Record<string, Plain[]> = {}
  for (const [key, values] of Object.entries(state.hidden ?? {})) {
    const plain = values.filter(isPlain)
    if (plain.length) hidden[key] = plain
  }
  return JSON.stringify({ sort: state.sort ?? null, hidden, columns: state.columns ?? [] })
}

/** Read it back, dropping anything about columns the table no longer has. */
export function parseTableState(raw: string | null, columnKeys: readonly string[]): PersistedTableState | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== "object") return null
  const known = new Set(columnKeys)
  const record = data as Record<string, unknown>
  const out: PersistedTableState = {}

  const sort = record.sort as { key?: unknown; dir?: unknown } | null | undefined
  if (sort === null) out.sort = null
  else if (sort && typeof sort.key === "string" && known.has(sort.key) && (sort.dir === "asc" || sort.dir === "desc")) {
    out.sort = { key: sort.key, dir: sort.dir }
  }

  if (record.hidden && typeof record.hidden === "object") {
    out.hidden = {}
    for (const [key, values] of Object.entries(record.hidden as Record<string, unknown>)) {
      if (known.has(key) && Array.isArray(values)) out.hidden[key] = values.filter(isPlain)
    }
  }

  if (Array.isArray(record.columns)) {
    out.columns = record.columns.filter((c): c is string => typeof c === "string" && known.has(c))
  }
  return out
}
