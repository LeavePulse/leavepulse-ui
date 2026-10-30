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

/**
 * A table's header filters as a consumer holds them (v-model:filters on
 * LpTable): per column key, the values hidden. A column that is absent or has
 * an empty list is not filtered. Hidden rather than shown for the same reason
 * as inside the table: a value nobody has seen before shows up.
 */
export type TableFilters = Record<string, unknown[]>

/** The hidden list that leaves only `keep` of `values` showing. */
export function showOnly(values: readonly unknown[], keep: readonly unknown[]): unknown[] {
  return [...onlyValues(values, keep)]
}

/** Which of `values` a column's filter still shows. */
export function shownValues(values: readonly unknown[], hidden: readonly unknown[] | undefined): unknown[] {
  if (!hidden?.length) return [...values]
  const out = new Set(hidden)
  return values.filter((v) => !out.has(v))
}

/**
 * The rows a set of header filters leaves, for the same data drawn somewhere
 * the table is not (cards on a phone, a CSV built by the page).
 */
export function filterRows<Row extends Record<string, unknown>>(rows: readonly Row[], filters: TableFilters): Row[] {
  const active = Object.entries(filters).filter(([, hidden]) => hidden.length).map(([key, hidden]) => [key, new Set(hidden)] as const)
  if (!active.length) return [...rows]
  return rows.filter((row) => active.every(([key, hidden]) => !hidden.has(row[key])))
}

/** Sets per column, from the plain lists a consumer writes. */
export function toHiddenSets(filters: TableFilters): Record<string, Set<unknown>> {
  return Object.fromEntries(Object.entries(filters).map(([key, values]) => [key, new Set(values)]))
}

/** The plain lists a consumer reads, empty columns left out. */
export function fromHiddenSets(hidden: Record<string, ReadonlySet<unknown>>): TableFilters {
  return Object.fromEntries(Object.entries(hidden).filter(([, set]) => set.size).map(([key, set]) => [key, [...set]]))
}

/** Whether two filter states hide the same values, empty columns counting as absent. */
export function sameHidden(a: Record<string, ReadonlySet<unknown>>, b: Record<string, ReadonlySet<unknown>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const x = a[key]
    const y = b[key]
    if ((x?.size ?? 0) !== (y?.size ?? 0)) return false
    if (x && y) for (const v of x) if (!y.has(v)) return false
  }
  return true
}

/**
 * Persisted filters meeting the ones a parent already set: the parent's
 * explicit state (a deep link, a control above the table) wins per column,
 * and what was remembered fills only the columns it leaves alone.
 */
export function mergeRestored(
  current: Record<string, ReadonlySet<unknown>>,
  restored: Record<string, unknown[]>,
): Record<string, Set<unknown>> {
  const out: Record<string, Set<unknown>> = Object.fromEntries(Object.entries(current).map(([k, v]) => [k, new Set(v)]))
  for (const [key, values] of Object.entries(restored)) if (!out[key]?.size) out[key] = new Set(values)
  return out
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
