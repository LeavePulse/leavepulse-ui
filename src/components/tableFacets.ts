import { computed } from "vue"
import { countValues } from "./tableFilter"

export function useTableFacets<T extends Record<string, unknown>>(options: {
  rows: () => T[]
  columns: () => string[]
  hidden: () => Record<string, ReadonlySet<unknown>>
}) {
  // Each column stays lazy: opening one filter must not compute every other filter.
  const columns = computed(() => new Map(options.columns().map((key) => [key, {
    distinct: computed(() => [...new Set(options.rows().map((row) => row[key]))]),
    counts: computed(() => {
      const others = Object.entries(options.hidden()).filter(([column, values]) => column !== key && values.size)
      const rows = others.length
        ? options.rows().filter((row) => others.every(([column, values]) => !values.has(row[column])))
        : options.rows()
      return countValues(rows, key)
    }),
  }])))

  return {
    distinct: (key: string): unknown[] => columns.value.get(key)?.distinct.value ?? [],
    counts: (key: string): Map<unknown, number> | undefined => columns.value.get(key)?.counts.value,
  }
}
