/*
 * The arithmetic behind LpTable's opt-in features, kept apart from the
 * component so each rule can be tested without a DOM: several sort keys, column
 * widths and pins, groups, the row window of virtual scrolling, presets and
 * the "all matching except" selection.
 */
import { clamp } from "../composables/clamp"
import { compareValues } from "./tableSort"

export interface SortKey {
  key: string
  dir: "asc" | "desc"
}

export interface SortableColumn<Row> {
  key: string
  sortable?: boolean
  sortValue?: (row: Row) => unknown
  compare?: (a: Row, b: Row) => number
}

/** Rows in the order of every sort key, the first one deciding first. Stable. */
export function sortByKeys<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  sorts: readonly SortKey[],
  columns: readonly SortableColumn<Row>[],
): Row[] {
  const steps = sorts.flatMap((sort) => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortable) return []
    const factor = sort.dir === "asc" ? 1 : -1
    const value = col.sortValue ?? ((row: Row) => row[sort.key])
    const compare = col.compare ?? ((a: Row, b: Row) => compareValues(value(a), value(b)))
    return [{ compare, factor }]
  })
  if (!steps.length) return [...rows]
  return [...rows].sort((a, b) => {
    for (const { compare, factor } of steps) {
      const order = compare(a, b) * factor
      if (order) return order
    }
    return 0
  })
}

/**
 * A click on a header. Alone it makes that column the only key; `add` (Shift)
 * keeps the others. Either way the column cycles none → asc → desc → none.
 */
export function nextSorts(current: readonly SortKey[], key: string, add: boolean): SortKey[] {
  const found = current.find((sort) => sort.key === key)
  const next: SortKey | null = !found ? { key, dir: "asc" } : found.dir === "asc" ? { key, dir: "desc" } : null
  if (!add) return next ? [next] : []
  if (!found) return [...current, next!]
  return current.flatMap((sort) => (sort.key !== key ? [sort] : next ? [next] : []))
}

export const MIN_COLUMN_PX = 48

/** A width the column allows. `max` below `min` gives way to `min`. */
export function clampColumnWidth(width: number, min = MIN_COLUMN_PX, max = Number.POSITIVE_INFINITY): number {
  return Math.round(Math.max(min, Math.min(max, width)))
}

export type ColumnPin = "left" | "right"

/** Left pins first and right pins last, each keeping the order it was given in. */
export function orderPinned<Col extends { pin?: ColumnPin }>(columns: readonly Col[]): Col[] {
  return [
    ...columns.filter((c) => c.pin === "left"),
    ...columns.filter((c) => !c.pin),
    ...columns.filter((c) => c.pin === "right"),
  ]
}

/** How far from its edge each pinned column sticks: the widths of the pins outside it. */
export function pinOffsets(
  columns: readonly { key: string; pin?: ColumnPin }[],
  widths: Readonly<Record<string, number>>,
): Record<string, number> {
  const offsets: Record<string, number> = {}
  let left = 0
  for (const col of columns) {
    if (col.pin !== "left") continue
    offsets[col.key] = left
    left += widths[col.key] ?? 0
  }
  let right = 0
  for (const col of [...columns].reverse()) {
    if (col.pin !== "right") continue
    offsets[col.key] = right
    right += widths[col.key] ?? 0
  }
  return offsets
}

export interface RowGroup<Row> {
  value: unknown
  id: string
  rows: Row[]
}

/** Rows by group, in the order each group first appears, so a sort orders the groups too. */
export function groupRows<Row>(rows: readonly Row[], valueOf: (row: Row) => unknown): RowGroup<Row>[] {
  const groups = new Map<unknown, RowGroup<Row>>()
  for (const row of rows) {
    const value = valueOf(row)
    const group = groups.get(value)
    if (group) group.rows.push(row)
    else groups.set(value, { value, id: String(value ?? ""), rows: [row] })
  }
  return [...groups.values()]
}

export interface RowWindow {
  start: number
  end: number
  before: number
  after: number
}

/** Which rows of a fixed-height list to draw, and the height standing in for the rest. */
export function rowWindow(scrollTop: number, viewport: number, rowHeight: number, count: number, overscan: number): RowWindow {
  if (rowHeight <= 0 || count <= 0) return { start: 0, end: Math.max(0, count), before: 0, after: 0 }
  const top = clamp(scrollTop, 0, Math.max(0, count * rowHeight - viewport))
  const start = Math.max(0, Math.floor(top / rowHeight) - overscan)
  const end = Math.min(count, Math.ceil((top + Math.max(0, viewport)) / rowHeight) + overscan)
  return { start, end, before: start * rowHeight, after: (count - end) * rowHeight }
}

export interface ColumnPreset {
  id: string
  label: string
  /** The columns shown. A key that no longer exists is ignored. */
  columns: readonly string[]
  /** Widths in px to apply along with it (with `resizableColumns`). */
  widths?: Readonly<Record<string, number>>
}

/** The columns a preset hides: the rest, minus those that may not be hidden. */
export function presetHidden(
  preset: Pick<ColumnPreset, "columns">,
  columns: readonly { key: string; alwaysVisible?: boolean }[],
): Set<string> {
  const shown = new Set(preset.columns)
  const hidden = columns.filter((c) => !c.alwaysVisible && !shown.has(c.key)).map((c) => c.key)
  // A preset naming nothing that exists must not leave a table with no columns.
  return hidden.length === columns.length ? new Set() : new Set(hidden)
}
