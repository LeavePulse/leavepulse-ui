<script lang="ts">
// Attributes go to the scroll area, not the wrapper: a height or max-height set
// by the page has always landed there, and the sticky header depends on it.
export default { inheritAttrs: false }
</script>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useAttrs, watch } from "vue"
import LpCheckbox from "./LpCheckbox.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpPagination from "./LpPagination.vue"
import LpPopover from "./LpPopover.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import LpTableFilter, { type TableFilterOption } from "./LpTableFilter.vue"
import { useAsyncTask } from "../composables/useAsyncTask"
import { useHotkeys } from "../composables/useHotkeys"
import { usePaintSelect } from "../composables/usePaintSelect"
import { useRovingFocus } from "../composables/useRovingFocus"
import { useLabels } from "../composables/useLpConfig"
import { compareValues } from "./tableSort"
import LpButton from "./LpButton.vue"
import { downloadFile, fileStem, toCsv, type CsvOptions } from "./exportData"
import { countValues, parseTableState, serializeTableState, summarizeShown } from "./tableFilter"

export interface TableColumn<Row> {
  key: string
  label: string
  align?: "left" | "right" | "center"
  width?: string
  /**
   * Keep the cell on one line. For ids, codes, dates and amounts, which a
   * narrow screen otherwise breaks at a hyphen or a space ("ORD-" / "1040");
   * the table scrolls sideways instead.
   */
  nowrap?: boolean
  /** Allow clicking the header to sort by this column. */
  sortable?: boolean
  /** The value this column sorts by, when the cell holds something else. */
  sortValue?: (row: Row) => unknown
  /** Full control over the order; wins over `sortValue`. Ascending order. */
  compare?: (a: Row, b: Row) => number
  /**
   * Offer "show only these values" in the header's menu, built from the values
   * actually present in the rows. For a column that holds a small vocabulary —
   * a type, a state, a site — where the question is "just the mains leads,
   * please". Pointless on a column of unique values, so it is opt-in.
   */
  filterable?: boolean
  /**
   * How a raw cell value reads in that filter list. `power_ac` is the stored
   * vocabulary; the menu should say what the column itself says.
   */
  valueLabel?: (value: unknown) => string
  /** The value a CSV export writes for this column; the raw cell by default. */
  exportValue?: (row: Row) => unknown
  /** Keep this column out of the show/hide list — an actions column has no
   *  name to offer and nothing to gain from being hidden. */
  alwaysVisible?: boolean
  /**
   * Leave the column out while the table is narrower than this many pixels
   * (a phone, a narrow card), so the columns that matter keep their room
   * instead of the whole table scrolling sideways. Wider than that, the
   * user's own show/hide applies as usual.
   */
  hideBelow?: number
}

export interface TableLabels {
  [key: string]: string
  loading: string
  error: string
  empty: string
  sortAsc: string
  sortDesc: string
  sortClear: string
  filter: string
  showAll: string
  columns: string
  exportCsv: string
  selectAll: string
  shortcutsGroup: string
  filterColumn: string
  filterSearch: string
  filterAll: string
  filterNone: string
  filterInvert: string
  filterOnly: string
  filterOnlyShown: string
  filterAddShown: string
  filterNoValues: string
  filterNothingShown: string
  clearFilter: string
  clearFilters: string
  noMatches: string
  resetFilters: string
  rowCount: string
  rowsTotal: string
  selectedCount: string
  clearSelection: string
  pageSelected: string
  selectAllMatching: string
  allMatchingSelected: string
}

export interface TableExportOptions extends CsvOptions {
  /**
   * Which rows: every row in the current order, the rows the header filters
   * leave, or the selected ones. With `load` only the loaded page is known.
   */
  scope?: "all" | "filtered" | "selected"
  /** File name without extension. */
  filename?: string
  /** Return the CSV without offering a download. */
  download?: boolean
}

export interface SortState {
  key: string
  dir: "asc" | "desc"
}

/**
 * What a server-backed table asks for. `hidden` mirrors the header filter: the
 * values unticked per column, so a value the server has never sent before shows
 * up instead of being silently excluded.
 */
export interface TableQuery {
  page: number
  pageSize: number
  sort: SortState | null
  hidden: Record<string, unknown[]>
}

/**
 * One page of a server-backed table. `facets` are the distinct values of the
 * filterable columns across the whole result — one page cannot know them, and a
 * filter built from twenty-five rows would offer whatever happened to be on it.
 */
export interface TablePage<Row> {
  rows: Row[]
  total: number
  facets?: Record<string, unknown[]>
}

type RowKey = string | number


const props = withDefaults(
  defineProps<{
    columns: TableColumn<T>[]
    /** The rows, for a table that holds its data. Ignored when `load` is set. */
    rows?: T[]
    /**
     * Fetch the rows instead of being handed them: paging, sorting and the
     * header filters then happen on the server. Debounced and abortable, the
     * same way as the command palette's `search` — a stale page never lands
     * over a fresher one.
     */
    load?: (query: TableQuery, signal: AbortSignal) => TablePage<T> | Promise<TablePage<T>>
    /** Rows per page with `load`. */
    pageSize?: number
    /** Wait after a sort or filter change before `load` runs. */
    debounce?: number
    loadingLabel?: string
    errorLabel?: string
    /**
     * Stable id per row. Without it a row is keyed by its position in `rows`,
     * which survives sorting and filtering but not a new array; set it whenever
     * rows are replaced (`load`, polling) and selection must carry over.
     */
    rowKey?: keyof T | ((row: T) => RowKey)
    emptyLabel?: string
    emptyIcon?: string
    /**
     * Rows can be selected (v-model:selected). `true` shows a tick column,
     * where pressing a tick and sweeping ticks the run. `"hold"` keeps the
     * column out of sight until it is needed: a long press on a row selects it
     * (and the same press goes on selecting the rows it is dragged across), the
     * column slides in, and while anything is selected a click on a row toggles
     * it. Emptying the selection, or Escape, slides the column away again.
     */
    selectable?: boolean | "hold"
    /** Selected row keys (v-model:selected). */
    selected?: RowKey[]
    /** Active sort (v-model:sort). When set, the parent owns ordering (server
     *  side); otherwise the table sorts its own rows client-side. */
    sort?: SortState | null
    /** Pin the header while the body scrolls. Pair with a height on the wrapper. */
    stickyHeader?: boolean
    /** Per-row right-click menu. Return [] (or omit the prop) to disable it for
     *  a row; the row then keeps the browser's native context menu. */
    rowMenu?: (row: T) => ContextMenuItemDef[]
    /** Wording for the header's right-click menu. Passed in because the kit
     *  carries no translations: an app that leaves these alone gets English. */
    sortAscLabel?: string
    sortDescLabel?: string
    sortClearLabel?: string
    /** Wording for the value filter and the column chooser. */
    filterLabel?: string
    showAllLabel?: string
    columnsLabel?: string
    /** Offer a CSV download in a toolbar above the table and in its menu. */
    exportable?: boolean
    /** File name for that download, without extension. */
    exportFilename?: string
    /** All of the wording above in one object, and the config-level scope "table". */
    labels?: Partial<TableLabels>
    /** Row height: `compact` for dense data, `comfortable` (default) otherwise. */
    density?: "comfortable" | "compact"
    /**
     * Always show the bar above the table with the row count. It shows on its
     * own while filters are active or rows are selected.
     */
    summary?: boolean
    /**
     * Remember sort, value filters and hidden columns across visits under this
     * key (localStorage). Only plain filter values (text, numbers) are kept.
     */
    persist?: string
    /**
     * With `load`: the user chose "select all N" beyond the loaded page
     * (v-model:allMatching). The keys in `selected` are then only the loaded
     * ones; acting on everything that matches is the consumer's to do.
     */
    allMatching?: boolean
  }>(),
  {
    rows: () => [],
    pageSize: 25,
    debounce: 150,
    emptyIcon: "lucide:inbox",
    selectable: false,
    selected: () => [],
    density: "comfortable",
    summary: false,
    allMatching: false,
    // undefined, not null: null is a parent saying "unsorted", undefined is no
    // parent at all, and only the latter lets the table keep its own sort.
    sort: undefined,
  },
)

const labelSet = useLabels<TableLabels>(
  "table",
  {
    loading: "Loading…",
    error: "Could not load",
    empty: "Nothing here yet",
    sortAsc: "Sort ascending",
    sortDesc: "Sort descending",
    sortClear: "Clear sorting",
    filter: "Show only",
    showAll: "Show all",
    columns: "Columns",
    exportCsv: "Export CSV",
    selectAll: "Select every row",
    shortcutsGroup: "Table",
    filterColumn: "Filter {column}",
    filterSearch: "Search values",
    filterAll: "All",
    filterNone: "None",
    filterInvert: "Invert",
    filterOnly: "Only",
    filterOnlyShown: "Only these {count}",
    filterAddShown: "Add these {count}",
    filterNoValues: "No values match",
    filterNothingShown: "none",
    clearFilter: "Clear the {column} filter",
    clearFilters: "Clear all",
    noMatches: "No rows match the filters",
    resetFilters: "Reset filters",
    rowCount: "{shown} of {total}",
    rowsTotal: "{total} rows",
    selectedCount: "{count} selected",
    clearSelection: "Clear selection",
    pageSelected: "All {count} on this page are selected.",
    selectAllMatching: "Select all {total}",
    allMatchingSelected: "All {total} are selected.",
  },
  () => props.labels,
)
const text = computed<TableLabels>(() => ({
  ...labelSet.value,
  loading: props.loadingLabel ?? labelSet.value.loading,
  error: props.errorLabel ?? labelSet.value.error,
  empty: props.emptyLabel ?? labelSet.value.empty,
  sortAsc: props.sortAscLabel ?? labelSet.value.sortAsc,
  sortDesc: props.sortDescLabel ?? labelSet.value.sortDesc,
  sortClear: props.sortClearLabel ?? labelSet.value.sortClear,
  filter: props.filterLabel ?? labelSet.value.filter,
  showAll: props.showAllLabel ?? labelSet.value.showAll,
  columns: props.columnsLabel ?? labelSet.value.columns,
}))

/*
 * Layout classes belong on the root, not on the scroll area. Since the pager
 * wrapper became the root, a caller's `min-h-0 flex-1` landed on the inner
 * scroll area while the wrapper kept sizing to its content — in a flex column
 * the table grew past its container and its bottom edge was clipped away.
 * Everything else (style, aria, listeners) still goes to the scroll area, so a
 * `max-height` keeps capping the scrolling part.
 */
const attrs = useAttrs()
const rootClass = computed(() => attrs.class)
const scrollAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const emit = defineEmits<{
  (e: "update:selected", value: RowKey[]): void
  (e: "update:sort", value: SortState | null): void
  (e: "update:allMatching", value: boolean): void
  (e: "rowClick", row: T): void
}>()

function keyFor(row: T, index: number): RowKey {
  if (typeof props.rowKey === "function") return props.rowKey(row)
  if (props.rowKey) return row[props.rowKey] as RowKey
  // Position in the source, not in the sorted view: a sort must not move a
  // tick from one row to another.
  return sourceIndex.value.get(row) ?? index
}

function alignClass(align?: "left" | "right" | "center"): string {
  if (align === "right") return "text-right"
  if (align === "center") return "text-center"
  return "text-left"
}

/*
 * The row a right-click landed on, and the menu the table shows because of it.
 *
 * Rows used to be wrapped one LpContextMenu each. Two things were wrong with
 * that. LpContextMenu's root is a v-if/v-else pair and reka's ContextMenuRoot
 * is a context provider with no element of its own, so every row handed
 * <TransitionGroup> a fragment where it needs an element: Vue warned once per
 * row ("renders non-element root node that cannot be animated") and the row
 * enter/leave/move animations silently did nothing. It also stood up a full
 * reka menu instance per row — fifty rows, fifty poppers, all closed.
 *
 * So the <tr> is now a plain child of the TransitionGroup, and the ONE menu
 * already wrapping the whole table serves the rows too: the right-click is
 * caught on the way up, the row it came from is remembered, and the menu is
 * built for that row. `always` keeps that menu mounted even while it would
 * otherwise be empty, so the first right-click is not swallowed while it
 * populates.
 */
const menuRow = ref<T | null>(null)

function onRowContextMenu(row: T) {
  menuRow.value = row
}

// Row items first — they are what the pointer is actually on — then the
// table-wide ones under a rule, when the row has any of its own.
const contextMenu = computed<ContextMenuItemDef[]>(() => {
  // A finger's long press opens this menu too; while it is selecting rows, no.
  if (paint.painting.value) return []
  const table = tableMenu()
  const row = menuRow.value ? (props.rowMenu?.(menuRow.value) ?? []) : []
  if (!row.length) return table
  if (!table.length) return row
  return [...row, { ...table[0], separatorBefore: true }, ...table.slice(1)]
})

// ── sorting ──────────────────────────────────────────────────
//
// The parent may drive `sort` through v-model, which is how a server-side sort
// is expressed. When it does not, the table keeps the state itself and sorts
// its own rows — otherwise `sortable` rendered a header that could be clicked,
// emitted an event nobody was listening for, and left the rows exactly as they
// were: a control that answers a click by doing nothing.
const ownSort = ref<SortState | null>(null)
const activeSort = computed(() => (props.sort !== undefined ? props.sort : ownSort.value))

// ── server-backed rows ───────────────────────────────────────
const loaded = shallowRef<T[]>([])
const total = ref(0)
const facets = ref<Record<string, unknown[]>>({})
const failed = ref(false)
const page = ref(1)
const task = useAsyncTask<TablePage<T>>()
const loading = task.pending

const sourceRows = computed<T[]>(() => (props.load ? loaded.value : props.rows))
const sourceIndex = computed(() => new Map(sourceRows.value.map((row, i) => [row, i])))

// The tallest page shown so far, held as a floor: the last page is usually
// short, and without it the pager below jumps up the moment you reach it.
/*
 * The table sits in LpContextMenu's as-child trigger, which re-clones its child
 * on every render and leaves a template ref on it undefined after the first
 * update. The component's own root is stable, so the table is found from it.
 */
const frameEl = ref<HTMLElement | null>(null)
const floor = ref(0)
async function holdHeight() {
  await nextTick()
  const height = frameEl.value?.querySelector("table")?.offsetHeight ?? 0
  if (height > floor.value) floor.value = height
}

/*
 * ── hiding values, and hiding columns ────────────────────────────────────────
 *
 * Both live here rather than in each page for the same reason the sort does: a
 * table that can be sorted but not narrowed sends every caller off to build its
 * own filter bar, and six of those are six different ideas of what filtering
 * looks like.
 *
 * State is the *hidden* set, not the shown one. A column that gains a new value
 * — a cable type nobody had recorded yet — then appears by default instead of
 * being invisible until someone notices the list has an unticked entry they
 * never saw.
 */
const hiddenValues = ref<Record<string, Set<unknown>>>({})

/*
 * Rows animate only when the table itself reshuffles them — a header filter or
 * a sort, a change the eye should follow. A parent replacing `rows` wholesale
 * (the next page, a reload) swaps instantly: animated, the old page would fade
 * out beside the new one, and the table would show both lists for a moment.
 */
const animating = ref(false)
let motionTimer: ReturnType<typeof setTimeout> | undefined
function withMotion(change: () => void) {
  if (!props.load) {
    animating.value = true
    if (motionTimer) clearTimeout(motionTimer)
    motionTimer = setTimeout(() => (animating.value = false), 600)
  }
  change()
}
const hiddenColumns = ref<Set<string>>(new Set())

// The table's own width, for `hideBelow`: what decides is the room the table
// has, not the window, which a sidebar or a card can take most of.
// Measured on the scroll viewport around the table: that is the room it has,
// while the table itself widens with whatever it overflows by.
const tableEl = ref<HTMLElement | null>(null)
const tableWidth = ref(Number.POSITIVE_INFINITY)
let widthObserver: ResizeObserver | undefined
watch(
  tableEl,
  (table) => {
    widthObserver?.disconnect()
    const el = table?.closest<HTMLElement>("[data-reka-scroll-area-viewport]") ?? table?.parentElement
    if (!el || typeof ResizeObserver === "undefined") return
    widthObserver = new ResizeObserver(() => (tableWidth.value = el.clientWidth))
    widthObserver.observe(el)
    tableWidth.value = el.clientWidth
  },
  { flush: "post" },
)

const visibleColumns = computed(() =>
  props.columns.filter(
    (c) => !hiddenColumns.value.has(c.key) && !(c.hideBelow && tableWidth.value < c.hideBelow),
  ),
)

/** The distinct values a filterable column holds, in first-seen order. */
function valuesOf(col: TableColumn<T>): unknown[] {
  if (props.load && facets.value[col.key]) return facets.value[col.key]
  const seen: unknown[] = []
  for (const row of sourceRows.value) {
    const v = row[col.key]
    if (!seen.includes(v)) seen.push(v)
  }
  return seen
}

function isValueHidden(key: string, value: unknown): boolean {
  return hiddenValues.value[key]?.has(value) ?? false
}

function toggleValue(key: string, value: unknown) {
  withMotion(() => applyToggle(key, value))
}

function applyToggle(key: string, value: unknown) {
  const next = new Set(hiddenValues.value[key] ?? [])
  if (next.has(value)) next.delete(value)
  else next.add(value)
  hiddenValues.value = { ...hiddenValues.value, [key]: next }
}

function showAllValues(key: string) {
  withMotion(() => (hiddenValues.value = { ...hiddenValues.value, [key]: new Set() }))
}

function setHidden(key: string, next: Set<unknown>) {
  withMotion(() => (hiddenValues.value = { ...hiddenValues.value, [key]: next }))
}

function labelOf(col: TableColumn<T>, value: unknown): string {
  return col.valueLabel?.(value) ?? String(value ?? "—")
}

/*
 * What the filter of one column offers. Counts follow the OTHER filters, the
 * way a faceted search does: with "Status: open" set, the "Owner" filter
 * counts open rows, which is what the user is about to narrow further.
 */
function filterOptions(col: TableColumn<T>): TableFilterOption[] {
  let counts: Map<unknown, number> | undefined
  if (!props.load) {
    const others = Object.entries(hiddenValues.value).filter(([key, set]) => key !== col.key && set.size)
    const rows = others.length
      ? props.rows.filter((row) => others.every(([key, hidden]) => !hidden.has(row[key])))
      : props.rows
    counts = countValues(rows, col.key)
  }
  return valuesOf(col).map((value) => ({ value, label: labelOf(col, value), count: counts?.get(value) ?? (counts ? 0 : undefined) }))
}

/** Every column with something hidden, summarised for the chips above the table. */
const activeFilters = computed(() =>
  props.columns
    .filter((col) => col.filterable && hiddenValues.value[col.key]?.size)
    .map((col) => {
      const hidden = hiddenValues.value[col.key]!
      const shown = valuesOf(col).filter((v) => !hidden.has(v)).map((v) => labelOf(col, v))
      return { col, text: shown.length ? summarizeShown(shown) : text.value.filterNothingShown }
    }),
)

function clearAllFilters() {
  withMotion(() => (hiddenValues.value = {}))
}

function filterLabels() {
  const t = text.value
  return {
    search: t.filterSearch,
    all: t.filterAll,
    none: t.filterNone,
    invert: t.filterInvert,
    only: t.filterOnly,
    onlyShown: t.filterOnlyShown,
    addShown: t.filterAddShown,
    noValues: t.filterNoValues,
  }
}

function toggleColumn(key: string) {
  const next = new Set(hiddenColumns.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  hiddenColumns.value = next
}

/** Rows left once the per-column value filters have been applied. */
const filteredRows = computed<T[]>(() => {
  if (props.load) return sourceRows.value
  const active = Object.entries(hiddenValues.value).filter(([, set]) => set.size)
  if (!active.length) return props.rows
  return props.rows.filter((row) =>
    active.every(([key, hidden]) => !hidden.has(row[key])),
  )
})

// We compare by raw cell value with a stable-ish coerce.
function sortRows(rows: T[]): T[] {
  const s = activeSort.value
  if (!s || props.load) return rows
  const col = props.columns.find((c) => c.key === s.key)
  if (!col?.sortable) return rows
  const factor = s.dir === "asc" ? 1 : -1
  const own = col.compare
  const value = col.sortValue ?? ((row: T) => row[s.key])
  return [...rows].sort((a, b) => (own ? own(a, b) : compareValues(value(a), value(b))) * factor)
}

const displayRows = computed<T[]>(() => sortRows(filteredRows.value))

function toggleSort(col: TableColumn<T>) {
  if (!col.sortable) return
  const s = activeSort.value
  // Cycle: none → asc → desc → none, scoped to the clicked column.
  let next: SortState | null
  if (!s || s.key !== col.key) next = { key: col.key, dir: "asc" }
  else if (s.dir === "asc") next = { key: col.key, dir: "desc" }
  else next = null
  // Kept locally as well as emitted: a parent that binds v-model overwrites
  // this on the way back, and one that does not still gets a table that sorts.
  withMotion(() => {
    ownSort.value = next
    emit("update:sort", next)
  })
}

function sortIcon(col: TableColumn<T>): string {
  const s = activeSort.value
  if (s?.key !== col.key) return "lucide:chevrons-up-down"
  return s.dir === "asc" ? "lucide:arrow-up" : "lucide:arrow-down"
}

/**
 * What right-clicking a header offers: the directions by name.
 *
 * The click cycles none → asc → desc → none, which is right for the common
 * case and clumsy for the rest — going back to unsorted from ascending is two
 * more clicks. Naming the three states makes each one reachable at once.
 *
 * Empty for a column that does not sort, and LpContextMenu passes an empty
 * list straight through to the browser's own menu.
 */
// Opened from the header menu: the menu has to finish closing and hand focus
// back before the popover can take it, or the popover reads that focus move as
// an outside interaction and dismisses itself. So the trigger is clicked once
// the menu is gone.
function openFilter(key: string) {
  const open = () => frameEl.value?.querySelector<HTMLElement>(`[data-lp-filter="${CSS.escape(key)}"]`)?.click()
  const started = performance.now()
  const wait = () => {
    if (!document.querySelector("[data-reka-menu-content]") || performance.now() - started > 600) setTimeout(open, 30)
    else requestAnimationFrame(wait)
  }
  requestAnimationFrame(wait)
}

function headerMenu(col: TableColumn<T>): ContextMenuItemDef[] {
  const s = activeSort.value
  const set = (next: SortState | null) => () =>
    withMotion(() => {
      ownSort.value = next
      emit("update:sort", next)
    })

  const items: ContextMenuItemDef[] = []

  if (col.sortable) {
    items.push(
      {
        label: text.value.sortAsc,
        icon: "lucide:arrow-up",
        disabled: s?.key === col.key && s.dir === "asc",
        onSelect: set({ key: col.key, dir: "asc" }),
      },
      {
        label: text.value.sortDesc,
        icon: "lucide:arrow-down",
        disabled: s?.key === col.key && s.dir === "desc",
        onSelect: set({ key: col.key, dir: "desc" }),
      },
      {
        label: text.value.sortClear,
        icon: "lucide:x",
        disabled: !s,
        onSelect: set(null),
      },
    )
  }

  // The values themselves live in the funnel's popover, where they can be
  // searched, painted and narrowed to one; the menu only leads there, and
  // offers the one-step way back. A second, plainer list here meant two
  // places to filter that behaved differently.
  if (col.filterable) {
    const hidden = hiddenValues.value[col.key]
    items.push(
      {
        label: text.value.filterColumn.replace("{column}", col.label),
        icon: "lucide:filter",
        separatorBefore: items.length > 0,
        onSelect: () => openFilter(col.key),
      },
      {
        label: text.value.showAll,
        icon: "lucide:list",
        disabled: !hidden?.size,
        onSelect: () => showAllValues(col.key),
      },
    )
  }

  return items
}

/**
 * The menu for the header itself, away from any one column: which columns to
 * show. Asked here because it is a question about the table rather than about
 * a column — right-clicking `Type` to hide `Where` would be the wrong place.
 */
function tableMenu(): ContextMenuItemDef[] {
  const offered = props.columns.filter((c) => !c.alwaysVisible && c.label)
  const exportItem: ContextMenuItemDef[] = props.exportable
    ? [{ label: text.value.exportCsv, icon: "lucide:download", onSelect: () => exportCsv() }]
    : []
  if (!offered.length) return exportItem
  return [
    ...exportItem,
    {
      label: text.value.columns,
      icon: "lucide:columns-3",
      children: offered.map((col) => ({
        label: col.label,
        checked: !hiddenColumns.value.has(col.key),
        // The last visible column cannot be hidden: a table with no columns is
        // a blank card the operator has no way back from.
        disabled:
          !hiddenColumns.value.has(col.key) && visibleColumns.value.length <= 1,
        onSelect: () => toggleColumn(col.key),
      })),
    },
  ]
}

function fetchPage(delay = 0) {
  const load = props.load
  if (!load) return
  const hidden = Object.fromEntries(
    Object.entries(hiddenValues.value)
      .filter(([, set]) => set.size)
      .map(([key, set]) => [key, [...set]]),
  )
  const query: TableQuery = { page: page.value, pageSize: props.pageSize, sort: activeSort.value, hidden }
  task.run((signal) => load(query, signal), {
    delay,
    apply: (result) => {
      // Rows deleted from the last page leave it past the end; step back to
      // the page that now exists rather than strand the user on an empty one.
      const last = Math.max(1, Math.ceil(result.total / props.pageSize))
      if (page.value > last) {
        page.value = last
        return
      }
      loaded.value = result.rows
      total.value = result.total
      facets.value = result.facets ?? {}
      failed.value = false
      holdHeight()
    },
    fail: () => {
      failed.value = true
    },
  })
}

// A new sort or filter starts from the first page: page 4 of a different
// question is a page of nothing in particular.
watch([activeSort, hiddenValues], () => {
  if (!props.load) return
  if (page.value !== 1) page.value = 1
  else fetchPage(props.debounce)
})
watch(page, () => fetchPage())

// ── remembered state ─────────────────────────────────────────
// Read after mount, not during setup: a server render knows nothing of this
// browser's storage, and restoring earlier would make the first client render
// disagree with it.
const storageKey = computed(() => (props.persist ? `lp-table:${props.persist}` : ""))
const restored = ref(false)
onMounted(() => {
  if (storageKey.value) {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(storageKey.value)
    } catch {}
    const state = parseTableState(raw, props.columns.map((c) => c.key))
    if (state) {
      if (state.sort !== undefined) {
        ownSort.value = state.sort
        emit("update:sort", state.sort)
      }
      if (state.hidden) {
        hiddenValues.value = Object.fromEntries(Object.entries(state.hidden).map(([k, v]) => [k, new Set(v)]))
      }
      if (state.columns) hiddenColumns.value = new Set(state.columns)
    }
  }
  restored.value = true
})
watch([activeSort, hiddenValues, hiddenColumns], () => {
  if (!storageKey.value || !restored.value) return
  const state = serializeTableState({
    sort: activeSort.value,
    hidden: Object.fromEntries(Object.entries(hiddenValues.value).map(([k, v]) => [k, [...v]])),
    columns: [...hiddenColumns.value],
  })
  try {
    localStorage.setItem(storageKey.value, state)
  } catch {}
})
watch(() => props.load, () => fetchPage(), { immediate: true })

// ── export ───────────────────────────────────────────────────
// The columns on screen, minus the unnamed ones (actions), in the order shown.
function exportCsv(options: TableExportOptions = {}): string {
  const scope = options.scope ?? "filtered"
  let rows: T[]
  if (scope === "all") rows = sortRows(sourceRows.value)
  else if (scope === "selected") {
    const keys = new Set(props.selected)
    rows = sortRows(sourceRows.value).filter((row, i) => keys.has(keyFor(row, i)))
  } else rows = displayRows.value
  const columns = visibleColumns.value
    .filter((col) => col.label)
    .map((col) => ({
      key: col.key,
      label: col.label,
      value: col.exportValue ?? ((row: T) => row[col.key]),
    }))
  const csv = toCsv(rows, columns, options)
  if (options.download !== false) {
    downloadFile(`${fileStem(options.filename ?? props.exportFilename, "table")}.csv`, csv, "text/csv;charset=utf-8")
  }
  return csv
}

defineExpose({ reload: () => fetchPage(), exportCsv })

// ── selection ────────────────────────────────────────────────
const selectedSet = computed(() => new Set(props.selected))
// "All" is what the user can see: rows a header filter hides are left alone.
const allKeys = computed(() => filteredRows.value.map((r, i) => keyFor(r, i)))
const allChecked = computed(
  () => allKeys.value.length > 0 && allKeys.value.every((k) => selectedSet.value.has(k)),
)
const someChecked = computed(
  () => !allChecked.value && allKeys.value.some((k) => selectedSet.value.has(k)),
)

function toggleAll(checked: boolean) {
  const next = new Set(selectedSet.value)
  for (const key of allKeys.value) {
    if (checked) next.add(key)
    else next.delete(key)
  }
  emit("update:selected", [...next])
}

function toggleRow(key: RowKey, checked: boolean) {
  const next = new Set(selectedSet.value)
  if (checked) next.add(key)
  else next.delete(key)
  emit("update:selected", [...next])
}

// Press a row's tick and sweep down the column to tick (or clear) the run,
// as in a file manager; Ctrl+A inside the table ticks every row shown.
const keyByText = computed(
  () => new Map(displayRows.value.map((row, index) => [String(keyFor(row, index)), keyFor(row, index)])),
)
const paint = usePaintSelect<RowKey>({
  root: frameEl,
  enabled: () => !!props.selectable,
  selection: () => props.selected,
  set: (keys) => emit("update:selected", keys),
  resolve: (raw) => keyByText.value.get(raw),
  selectAll: () => [...new Set([...props.selected, ...allKeys.value])],
  help: () => ({ group: text.value.shortcutsGroup, label: text.value.selectAll }),
})

const holdMode = computed(() => props.selectable === "hold")
/*
 * In hold mode the tick column is there all along, collapsed to nothing, and
 * opens by easing its width: the other columns then slide over instead of
 * jumping when it appears.
 */
const ticksShown = computed(
  () => props.selectable === true || props.selected.length > 0 || paint.painting.value,
)

function clearSelection() {
  emit("update:selected", [])
  if (props.allMatching) emit("update:allMatching", false)
}

/*
 * A long press on a row starts selection in hold mode. Presses that begin on
 * something the row holds that answers clicks of its own (a link, a button, a
 * field) are left to it.
 */
const OWN_CLICKS = "a,button,input,select,textarea,label,[role=button],[role=checkbox],[contenteditable=true]"
function onRowPointerDown(event: PointerEvent, key: RowKey) {
  if (!holdMode.value) return
  if ((event.target as Element | null)?.closest(OWN_CLICKS)) return
  paint.onPointerDown(event, key, { hold: 420 })
}

// Once something is selected, a click on a row adds or removes it, as in a
// phone's selection mode; with nothing selected it is the row's click again.
function onRowClick(row: T, key: RowKey) {
  if (holdMode.value && props.selected.length) toggleRow(key, !selectedSet.value.has(key))
  else emit("rowClick", row)
}

useHotkeys(
  () =>
    props.selectable && props.selected.length
      ? [
          {
            key: "escape",
            help: { group: text.value.shortcutsGroup, label: text.value.clearSelection },
            handler: () => clearSelection(),
          },
        ]
      : [],
  { scope: frameEl },
)

// ── the bar above the table ──────────────────────────────────
const pageKeys = computed(() => displayRows.value.map((row, i) => keyFor(row, i)))
const pageAllSelected = computed(
  () => pageKeys.value.length > 0 && pageKeys.value.every((k) => selectedSet.value.has(k)),
)
// "Select all" beyond the page is a separate, explicit step: the header tick
// only ever means the rows the user can see.
watch(pageAllSelected, (all) => {
  if (!all && props.allMatching) emit("update:allMatching", false)
})
/*
 * One status line that rolls between its states ("60 rows", "3 selected",
 * "All 40 are selected") instead of swapping text in a frame; the controls
 * beside it fade in and out, and the group eases its width so they slide.
 */
const statusText = computed(() => {
  if (!(props.selectable && props.selected.length)) return countText.value
  return props.allMatching
    ? text.value.allMatchingSelected.replace("{total}", String(total.value))
    : text.value.selectedCount.replace("{count}", String(props.selected.length))
})

const countText = computed(() => {
  const t = text.value
  if (props.load) return t.rowsTotal.replace("{total}", String(total.value))
  if (displayRows.value.length !== props.rows.length) {
    return t.rowCount.replace("{shown}", String(displayRows.value.length)).replace("{total}", String(props.rows.length))
  }
  return t.rowsTotal.replace("{total}", String(props.rows.length))
})
// A selectable table keeps the bar at all times (the row count until something
// is selected): ticking the first row must not push the table down.
// As documented on `summary`: the bar shows on its own while filters are
// active or rows are selected, not merely because rows can be selected, which
// left a lone "75 rows" over every selectable table.
const showBar = computed(
  () => props.summary || (!!props.selectable && props.selected.length > 0) || activeFilters.value.length > 0,
)
const filteredOut = computed(() => {
  if (loading.value || failed.value || displayRows.value.length) return false
  if (props.load) return Object.values(hiddenValues.value).some((set) => set.size)
  return props.rows.length > 0
})

const cellY = computed(() => (props.density === "compact" ? "py-1.5" : "py-3"))

const colSpan = computed(() => visibleColumns.value.length + (props.selectable ? 1 : 0))

/*
 * Keyboard navigation over the rows. A table is one Tab stop, not one per row:
 * a few hundred rows would otherwise be a few hundred Tab presses, which is the
 * same as having no keyboard support at all.
 *
 * Typeahead matches the FIRST column, which in practice is the name — the thing
 * a person looking for a row would type. Rows are addressed by their key so the
 * cursor survives a re-sort.
 */
const rovingItems = computed(() =>
  displayRows.value.map((row, index) => ({
    id: String(keyFor(row, index)),
    label: String(row[props.columns[0]?.key ?? ""] ?? ""),
  })),
)

const rowByKey = computed(() => {
  const map = new Map<string, T>()
  displayRows.value.forEach((row, index) => map.set(String(keyFor(row, index)), row))
  return map
})

const roving = useRovingFocus(rovingItems, {
  onActivate: (id) => {
    const row = rowByKey.value.get(id)
    if (!row) return
    // Space ticks the box where the table has one, since that is what a
    // selectable list is for; Enter always means "open this row".
    emit("rowClick", row)
  },
})

function onRowKeydown(event: KeyboardEvent) {
  // Space ticks rather than activates when the table is selectable — the
  // standard split for a multi-select list.
  if (event.key === " " && props.selectable && roving.activeId.value) {
    event.preventDefault()
    const key = roving.activeId.value
    const row = rowByKey.value.get(key)
    if (row) {
      const rowKey = keyFor(row, displayRows.value.indexOf(row))
      toggleRow(rowKey, !selectedSet.value.has(rowKey))
    }
    return
  }
  roving.onKeydown(event)
}

// With stickyHeader, the overlay scrollbar would otherwise run up under the
// pinned header. Measure the header height and inset the bar by it so the bar
// starts below the header. Tracked live (density/content can change it).
const headEl = ref<HTMLElement | null>(null)
const headHeight = ref(0)
let ro: ResizeObserver | undefined
watch(
  [headEl, () => props.stickyHeader],
  ([el, sticky]) => {
    ro?.disconnect()
    if (!el || !sticky || typeof ResizeObserver === "undefined") {
      headHeight.value = 0
      return
    }
    ro = new ResizeObserver(() => {
      headHeight.value = el.offsetHeight
    })
    ro.observe(el)
    headHeight.value = el.offsetHeight
  },
  { immediate: true, flush: "post" },
)
onBeforeUnmount(() => {
  ro?.disconnect()
  widthObserver?.disconnect()
  if (motionTimer) clearTimeout(motionTimer)
})

const barInsetTop = computed(() =>
  props.stickyHeader && headHeight.value ? `${headHeight.value}px` : undefined,
)
</script>

<template>
  <!-- No top fade: a sticky header sits in the masked band and would be dimmed
       by it. The bottom edge is left crisp with it for symmetry. -->
  <div ref="frameEl" class="flex flex-col gap-3" :class="rootClass">
  <div v-if="exportable" class="flex justify-end">
    <LpButton variant="ghost" size="sm" @click="exportCsv()">
      <LpIcon name="lucide:download" :size="14" />
      {{ text.exportCsv }}
    </LpButton>
  </div>
  <!-- What the table is showing right now: the filters in force, each one
       a chip that clears it, the row count, and what is selected with room
       for the consumer's bulk actions. Eased in and out (LpShift), so the
       table below glides rather than jumps when the first filter is set. -->
  <!-- The gap below the bar lives inside the eased box (pb-3), cancelled
       outside it (-mb-3): an empty box must not leave the root's gap behind. -->
  <LpShift class="-mb-3">
    <div v-if="showBar" class="flex min-h-8 items-center gap-x-3 pb-3 text-xs">
      <div v-if="activeFilters.length" class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <span
          v-for="f in activeFilters"
          :key="f.col.key"
          class="inline-flex max-w-72 animate-[chip-in_var(--duration-fast)_var(--ease-emphasized)] items-center gap-1 rounded-pill bg-brand-soft py-0.5 pr-1 pl-2.5 text-ink motion-reduce:animate-none"
        >
          <span class="truncate"><span class="text-muted">{{ f.col.label }}:</span> {{ f.text }}</span>
          <button
            type="button"
            class="grid size-4 shrink-0 place-items-center rounded-pill text-muted outline-none transition-colors duration-fast hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            :aria-label="text.clearFilter.replace('{column}', f.col.label)"
            @click="showAllValues(f.col.key)"
          >
            <LpIcon name="lucide:x" :size="12" />
          </button>
        </span>
        <button
          v-if="activeFilters.length > 1"
          type="button"
          class="rounded-control px-1.5 py-0.5 font-medium text-muted outline-none transition-colors duration-fast hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          @click="clearAllFilters"
        >
          {{ text.clearFilters }}
        </button>
      </div>
      <!-- One line, always: the status and its controls never wrap, so the bar
           keeps its height and the table under it stays put; the group eases
           its width as controls come and go. -->
      <LpShift axis="width" class="ml-auto shrink-0">
      <div class="flex items-center gap-2 whitespace-nowrap text-muted">
        <LpRollingText
          :value="statusText"
          align="end"
          class="tabular-nums"
          :class="selectable && selected.length ? 'font-medium text-ink' : ''"
          aria-live="polite"
        />
        <Transition
          enter-active-class="transition-opacity duration-fast motion-reduce:transition-none"
          leave-active-class="transition-opacity duration-fast motion-reduce:transition-none"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <span v-if="selectable && selected.length" class="flex items-center gap-2">
            <Transition
              enter-active-class="transition-opacity duration-fast motion-reduce:transition-none"
              leave-active-class="transition-opacity duration-fast motion-reduce:transition-none"
              enter-from-class="opacity-0"
              leave-to-class="opacity-0"
            >
            <span v-if="load && pageAllSelected && !allMatching && total > pageKeys.length" class="flex items-center gap-2">
              <!-- The sentence is context, the button is the action: on a narrow
                   screen only the action stays, so the line still fits. -->
              <span class="hidden sm:inline">{{ text.pageSelected.replace("{count}", String(pageKeys.length)) }}</span>
              <button
                type="button"
                class="rounded-control px-1.5 py-0.5 font-medium text-brand outline-none transition-colors duration-fast hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-ring"
                @click="emit('update:allMatching', true)"
              >
                {{ text.selectAllMatching.replace("{total}", String(total)) }}
              </button>
            </span>
            </Transition>
            <button
              type="button"
              class="rounded-control px-1.5 py-0.5 font-medium outline-none transition-colors duration-fast hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              @click="clearSelection"
            >
              {{ text.clearSelection }}
            </button>
            <slot name="bulk" :selected="selected" :all-matching="allMatching" :clear="clearSelection" />
          </span>
        </Transition>
      </div>
      </LpShift>
    </div>
  </LpShift>
  <LpScrollArea
    v-bind="scrollAttrs"
    :fade="false"
    class="min-h-0 flex-1 rounded-card border border-line bg-surface"
    :style="load && floor ? { minHeight: `${floor + 2}px` } : undefined"
    :bar-inset-top="barInsetTop"
  >
    <!-- The table-wide menu, which is what a right-click on empty header space
         reaches: rows and headers carry their own and take the event first, so
         this is the fallback rather than a competitor. -->
    <LpContextMenu :items="contextMenu" always>
    <table ref="tableEl" class="w-full border-collapse text-sm">
      <!-- The background belongs on `thead` itself, not only on its row:
           `border-collapse` collapses the borders, and with a sticky header the
           rows show through that seam — a band of body text rides across the
           header on every scroll. -->
      <thead
        ref="headEl"
        :class="stickyHeader ? 'sticky top-0 z-10 bg-surface-soft' : ''"
      >
        <tr class="border-b border-line bg-surface-soft">
          <th v-if="selectable" class="w-px p-0" :class="cellY">
            <div class="lp-tick lp-tick-open" :class="ticksShown ? '' : 'lp-tick-hidden'" :inert="!ticksShown">
              <LpCheckbox
                :model-value="allChecked"
                :indeterminate="someChecked"
                @update:model-value="toggleAll"
              />
            </div>
          </th>
          <th
            v-for="col in visibleColumns"
            :key="col.key"
            :style="col.width ? { width: col.width } : undefined"
            class="px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
            :class="[alignClass(col.align), cellY]"
            :aria-sort="
              activeSort?.key === col.key
                ? activeSort.dir === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            "
          >
            <!-- The menu wraps the button rather than the cell: a component
                 cannot sit between `<tr>` and `<th>` — the template compiler
                 drops it there, silently — so the trigger goes on the one
                 element inside the header that is already interactive.
                 Right-clicking names the directions instead of making you cycle
                 through them: getting back to unsorted from ascending is two
                 more clicks otherwise. -->
            <LpContextMenu v-if="col.sortable || col.filterable" :items="headerMenu(col)">
            <button
              type="button"
              class="group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              :class="[
                col.align === 'right' ? 'flex-row-reverse' : '',
                activeSort?.key === col.key ? 'text-ink' : '',
              ]"
              @click="toggleSort(col)"
            >
              {{ col.label }}
              <LpIcon
                v-if="col.sortable"
                :name="sortIcon(col)"
                :size="13"
                class="shrink-0 transition-[transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)]"
                :class="
                  activeSort?.key === col.key
                    ? 'opacity-100'
                    : 'opacity-40 group-hover/sort:opacity-70'
                "
              />
            </button>
            </LpContextMenu>
            <template v-else>{{ col.label }}</template>
            <LpPopover
              v-if="col.filterable"
              align="start"
              panel-class="w-72"
              :aria-label="text.filterColumn.replace('{column}', col.label)"
            >
              <template #trigger>
                <button
                  type="button"
                  class="ml-0.5 inline-grid size-5 place-items-center rounded align-middle outline-none transition-colors duration-fast hover:bg-surface-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                  :class="hiddenValues[col.key]?.size ? 'text-brand' : 'opacity-60'"
                  :aria-label="text.filterColumn.replace('{column}', col.label)"
                  :data-lp-filter="col.key"
                >
                  <LpIcon :name="hiddenValues[col.key]?.size ? 'lucide:filter-x' : 'lucide:filter'" :size="12" />
                </button>
              </template>
              <LpTableFilter
                :options="filterOptions(col)"
                :hidden="hiddenValues[col.key] ?? new Set()"
                :labels="filterLabels()"
                @update:hidden="(next) => setHidden(col.key, next)"
              />
            </LpPopover>
          </th>
        </tr>
      </thead>
      <!-- The keydown lives on the rows, not here: only a focused row should
           steer, and a stray key from a control inside a cell must not move the
           cursor. The container is bound only so the composable can find rows
           to focus. -->
      <!-- Rows fade and settle rather than snapping in and out. Filtering a
           list is a change the eye has to follow: rows vanishing between two
           frames read as the table being redrawn, and the one that stayed is
           impossible to keep track of. `move` is what carries the survivors to
           their new position instead of teleporting them. -->
      <!-- Animated only while the table reshuffles its own rows — see
           `withMotion`. -->
      <TransitionGroup
        tag="tbody"
        name="lp-row"
        :css="animating"
        :class="loading && displayRows.length ? 'opacity-60 transition-opacity' : 'transition-opacity'"
        :ref="(el: unknown) => roving.setContainer((el as { $el?: HTMLElement })?.$el ?? null)"
      >
        <tr v-if="displayRows.length === 0" key="lp-table-empty" class="lp-row-empty">
          <td :colspan="colSpan" class="px-4 py-10 text-center text-muted">
            <LpIcon
              :name="loading ? 'lucide:loader-circle' : failed ? 'lucide:circle-alert' : filteredOut ? 'lucide:filter-x' : emptyIcon"
              :size="22"
              class="mx-auto mb-2 opacity-60"
              :class="loading ? 'animate-spin' : ''"
            />
            <div>{{ loading ? text.loading : failed ? text.error : filteredOut ? text.noMatches : text.empty }}</div>
            <LpButton v-if="filteredOut" variant="outline" size="sm" class="mt-3" @click="clearAllFilters">
              {{ text.resetFilters }}
            </LpButton>
          </td>
        </tr>
        <!-- A plain <tr>, because TransitionGroup animates element children and
             nothing else. The right-click menu is the table's one menu, told
             which row the event came from — see `contextMenu`. -->
        <tr
          v-for="(row, index) in displayRows"
          :key="keyFor(row, index)"
          @contextmenu="onRowContextMenu(row)"
          class="group border-b border-line/60 outline-none transition-colors last:border-0 hover:bg-surface-soft/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[active]:bg-surface-soft/40"
          :class="selectedSet.has(keyFor(row, index)) ? 'bg-brand-soft/40' : ''"
          v-bind="roving.itemProps(String(keyFor(row, index)))"
          :data-paint-key="selectable ? String(keyFor(row, index)) : undefined"
          @click="onRowClick(row, keyFor(row, index))"
          @pointerdown="onRowPointerDown($event, keyFor(row, index))"
          @keydown="onRowKeydown"
        >
          <td
            v-if="selectable"
            class="w-px cursor-pointer p-0 select-none"
            :class="cellY"
            @click.stop
            @pointerdown.stop="paint.onPointerDown($event, keyFor(row, index))"
          >
            <div class="lp-tick lp-tick-open" :class="ticksShown ? '' : 'lp-tick-cue'">
              <LpCheckbox
                :model-value="selectedSet.has(keyFor(row, index))"
                @update:model-value="(v) => toggleRow(keyFor(row, index), v)"
              />
            </div>
          </td>
          <td
            v-for="(col, ci) in visibleColumns"
            :key="col.key"
            class="px-4 text-ink"
            :class="[alignClass(col.align), cellY, col.nowrap ? 'whitespace-nowrap' : '']"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </TransitionGroup>
    </table>
    </LpContextMenu>
  </LpScrollArea>
  <LpPagination
    v-if="load && total > pageSize"
    v-model:page="page"
    :total="total"
    :page-size="pageSize"
    :disabled="loading"
  />
  </div>
</template>

<style scoped>
/*
 * Rows arriving, leaving and moving as the filter changes.
 *
 * A row cannot be translated on its Y axis without the table reflowing around
 * it, so the entrance is opacity plus a small horizontal offset — enough to
 * read as movement, not enough to fight the column grid. `--ease-emphasized`
 * because this is interface responding to a click, not data being drawn.
 *
 * The leaving row is taken out of the flow, or the rows below it wait for the
 * fade before closing the gap and the whole list lurches at the end instead of
 * gliding.
 */
.lp-row-enter-active,
.lp-row-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-emphasized),
    transform var(--duration-fast) var(--ease-emphasized);
}

.lp-row-move {
  transition: transform var(--duration-medium) var(--ease-emphasized);
}

.lp-row-enter-from,
.lp-row-leave-to {
  opacity: 0;
  transform: translateX(-0.5rem);
}

/*
 * The empty-state row leaves at once, without the fade. It and the first real
 * rows would otherwise share the table for the length of the animation, and a
 * row of blank height sits above them — the table jumps once on every load.
 *
 * `position: absolute` is what a list would use here, but a positioned `<tr>`
 * drops out of the table layout entirely. Nothing sits below this row to be
 * dragged around, so simply not animating its exit costs nothing.
 */
.lp-row-empty.lp-row-leave-active {
  display: none;
}

/*
 * The leaving row stays in the flow. Taking it out with `position: absolute` is
 * the usual trick for a list, but a `<tr>` positioned that way loses the table's
 * column grid and collapses to its content width — the row visibly breaks apart
 * on its way out. The rows below close the gap through `lp-row-move` instead,
 * which is a moment slower and stays a table the whole time.
 */

/*
 * The tick column of a hold-to-select table keeps its width and only hides its
 * boxes until they mean something, which is the desktop pattern Material
 * describes: a row's box shows while the row is hovered, and every box shows
 * once anything is selected. An earlier version collapsed the column to nothing
 * and floated the hover box over the first cell, where it sat on the text.
 */
.lp-tick {
  display: flex;
  align-items: center;
  max-width: 0;
  padding-inline: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    max-width var(--duration-medium) var(--ease-emphasized),
    padding var(--duration-medium) var(--ease-emphasized),
    opacity var(--duration-fast) ease;
}

.lp-tick-open {
  max-width: 3.25rem;
  padding-inline: 1rem;
  opacity: 1;
}

.lp-tick-hidden,
.lp-tick-cue {
  opacity: 0;
}

tr:hover .lp-tick-cue,
.lp-tick-cue:focus-within {
  opacity: 1;
}

/* A filter that redraws the list is information, not decoration: with motion
   turned down the rows change without animating rather than not changing. */
/* Only where there is a hover to reveal it; a finger long-presses instead. */
@media (hover: none) {
  tr:hover .lp-tick-cue {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-row-enter-active,
  .lp-row-leave-active,
  .lp-row-move,
  .lp-tick {
    transition: none;
  }
}
</style>
