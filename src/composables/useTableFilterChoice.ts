import { computed, toValue, type MaybeRefOrGetter, type Ref, type WritableComputedRef } from "vue"
import { shownValues, showOnly, type TableFilters } from "../components/tableFilter"

/**
 * One column of LpTable's header filters as a single choice, for a control
 * above the table (LpSegmented, LpSelect, a row of stat tiles) that filters
 * the same thing as the column's funnel. Both then read and write one state:
 * picking a choice sets the funnel, and narrowing the funnel to a choice's
 * values lights that choice up.
 *
 * `choices` maps each choice to the values it shows; `null` is the choice
 * that shows everything. `values` is the column's vocabulary, by default every
 * value the choices name. The ref reads `undefined` while the funnel holds a
 * mix no choice describes, so the control shows nothing picked rather than a
 * choice that is not what the table shows.
 */
export function useTableFilterChoice<C extends string>(
  filters: Ref<TableFilters>,
  column: string,
  choices: Record<C, readonly unknown[] | null>,
  values?: MaybeRefOrGetter<readonly unknown[]>,
): WritableComputedRef<C | undefined> {
  const entries = Object.entries(choices) as [C, readonly unknown[] | null][]
  const vocabulary = computed(() => {
    const own = values === undefined ? undefined : toValue(values)
    return own ?? [...new Set(entries.flatMap(([, shown]) => shown ?? []))]
  })

  return computed({
    get: () => {
      const all = vocabulary.value
      const shown = new Set(shownValues(all, filters.value[column]))
      for (const [choice, keep] of entries) {
        if (keep === null) {
          if (shown.size === all.length) return choice
          continue
        }
        if (keep.length === shown.size && keep.every((v) => shown.has(v))) return choice
      }
      return undefined
    },
    set: (choice) => {
      const keep = choice === undefined ? null : choices[choice]
      const hidden = keep === null ? [] : showOnly(vocabulary.value, keep)
      const next = { ...filters.value }
      delete next[column]
      if (hidden.length) next[column] = hidden
      filters.value = next
    },
  })
}
