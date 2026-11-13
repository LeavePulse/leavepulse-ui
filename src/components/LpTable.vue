<script lang="ts">
// Attributes go to the scroll area, not the wrapper: a height or max-height set
// by the page has always landed there, and the sticky header depends on it.
export default { inheritAttrs: false }
</script>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useAttrs, useId, useSlots, watch } from "vue"
import { suppressPaletteDiscovery, usePaletteCommands, usePaletteScope } from "../composables/usePaletteCommands"
import { menuPaletteCommands } from "./commandPalette"
import LpDataList from "./LpDataList.vue"
import LpCheckbox from "./LpCheckbox.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpEditable from "./LpEditable.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpBadge from "./LpBadge.vue"
import LpIcon from "./LpIcon.vue"
import LpSkeleton from "./LpSkeleton.vue"
import LpPagination from "./LpPagination.vue"
import LpPopover from "./LpPopover.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import LpTableFilter, { type TableFilterOption } from "./LpTableFilter.vue"
import LpDropdownMenu from "./LpDropdownMenu.vue"
import LpSegmented from "./LpSegmented.vue"
import { useKitStorage } from "../composables/usePersisted"
import { useAsyncTask } from "../composables/useAsyncTask"
import { useTableFacets } from "./tableFacets"
import { useHotkeys } from "../composables/useHotkeys"
import { usePaintSelect } from "../composables/usePaintSelect"
import { useRovingFocus } from "../composables/useRovingFocus"
import { useLabels } from "../composables/useLpConfig"
import { useResizeObserver } from "../composables/useResizeObserver"
import {
  clampColumnWidth,
  groupRows,
  nextSorts,
  orderPinned,
  pinOffsets,
  presetHidden,
  rowChanges,
  rowWindow,
  sortByKeys,
  type ColumnPin,
  type ColumnPreset,
  type TableLayout,
} from "./tableFeatures"
import { devWarn } from "../composables/devWarn"
import { startPointerDrag } from "../composables/pointerDrag"
import { isHTMLElement, nodeWindow } from "../composables/useView"
import { prefersReducedMotion } from "../composables/easing"
import LpButton from "./LpButton.vue"
import { downloadFile, fileStem, toCsv, type CsvOptions } from "./exportData"
import {
  fromHiddenSets,
  mergeRestored,
  parseTableState,
  sameHidden,
  serializeTableState,
  summarizeShown,
  toHiddenSets,
  type TableFilters,
} from "./tableFilter"
import { resolveRowMenu, type TableRowMenuResult } from "./tableRowMenu"

/** How a column reads in a list line: alone, after its label, or not at all. */
export type TableListMode = boolean | "label"

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
  /**
   * The column's whole vocabulary, when it is known apart from the rows. The
   * funnel lists these first and then anything else the rows hold, so a value
   * is offered even while nothing on the page has it: the rows may already be
   * narrowed by the same column upstream (a control above the table, a server
   * query), and a funnel built only from what arrived could not widen it again.
   */
  filterValues?: readonly unknown[]
  /**
   * Show how many rows hold each value in the funnel (the default). Turn off
   * when the rows are already narrowed by this column before they reach the
   * table: the counts would then claim that the values filtered out upstream
   * hold no rows at all.
   */
  filterCounts?: boolean
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
  /**
   * How the column reads in a list line (the `list` layout, and a table drawn
   * as a list below `layoutBelow`), where there are no headers to name it.
   * `true` (default) puts the value alone in the line; `"label"` prefixes its
   * label, for a figure that means nothing on its own ("Cores 28"); `false`
   * leaves it out: an actions column (the row menu holds the same actions),
   * or a fact the line already says. A function decides per row, for a fact
   * worth a place only when it holds something ("needs attention", a stack
   * that is set): a cell slot cannot say "nothing" itself, since an empty
   * slot falls back to the raw value. Cards always show labels and are not
   * affected.
   */
  list?: TableListMode | ((row: Row) => TableListMode)
  /** Stick to this edge while the table scrolls sideways. Pinned columns move to that edge. */
  pin?: ColumnPin
  /** Bounds in px for `resizableColumns`. */
  minWidth?: number
  maxWidth?: number
  /** Set false to keep this column out of `resizableColumns`. */
  resizable?: boolean
  /**
   * The cell edits in place (LpEditable), and a save emits `cellEdit`. A cell
   * slot for the column wins: it draws the cell itself. Values are edited as
   * text; `parseEdit` turns the text back into the value the row holds.
   */
  editable?: boolean | ((row: Row) => boolean)
  /** A message rejects the text and keeps the cell open. */
  validateEdit?: (value: string, row: Row) => string | true | void
  parseEdit?: (value: string, row: Row) => unknown
}

/** A saved inline edit. The table holds no rows of its own to change: apply it to yours. */
export interface TableCellEdit<Row> {
  row: Row
  key: string
  value: unknown
  previous: unknown
}

/**
 * "Everything this query matches, except these": what a bulk action sends to
 * the server, in place of ids the client never loaded. See `selectionToken`.
 */
export interface TableSelectionToken {
  sorts: SortState[]
  hidden: Record<string, unknown[]>
  excluded: (string | number)[]
  total: number
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
  columnPresets: string
  resizeColumn: string
  expandRow: string
  collapseRow: string
  groupCount: string
  expandGroup: string
  collapseGroup: string
  layoutTable: string
  layoutCards: string
  layoutList: string
  layoutSwitch: string
  sortBy: string
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
  /** Every sort key in order, with `multiSort`. `sort` is the first of them. */
  sorts?: SortState[]
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
    /** Publish loaded rows and existing row actions to the enclosing command scope. */
    palette?: false | { id?: string; label?: string; labelKey?: keyof T }
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
    /**
     * The rows are on their way, for a table handed `rows` by a parent that
     * fetches them itself (with `load` the table knows on its own). An empty
     * table shows skeleton rows in the shape of its columns; a filled one dims
     * while the next rows come.
     */
    loading?: boolean
    /** How many skeleton rows stand in for the first page. */
    skeletonRows?: number
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
    /**
     * The header filters (v-model:filters): per column key, the values hidden.
     * When set, the parent owns them, so a control above the table that
     * filters the same column (see `useTableFilterChoice`) and the column's
     * funnel are one state: each shows what the other picked, and the table's
     * resets clear both. Left unset, the table keeps them itself. With
     * `persist`, remembered filters fill only the columns the parent leaves
     * unfiltered, and arrive through `update:filters`.
     */
    filters?: TableFilters
    /**
     * The rows are narrowed by filters outside the table (a search, a period).
     * An empty table then says nothing matches rather than that there is
     * nothing at all, and its reset button also emits `resetFilters`, for the
     * parent to clear its own.
     */
    filtered?: boolean
    /** Pin the header while the body scrolls. Pair with a height on the wrapper. */
    stickyHeader?: boolean
    /** Per-row right-click menu. Return [] (or omit the prop) to disable it for
     *  a row; the row then keeps the browser's native context menu. Return
     *  `{ title, subtitle?, image?, icon?, items }` to head the menu with the
     *  row's name, so it is clear which row the right-click hit. */
    rowMenu?: (row: T) => TableRowMenuResult
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
     * key (the kit's storage, see `usePersisted`). Only plain filter values (text, numbers) are kept.
     */
    persist?: string
    /**
     * With `load`: the user chose "select all N" beyond the loaded page
     * (v-model:allMatching). The keys in `selected` are then only the loaded
     * ones; acting on everything that matches is the consumer's to do.
     *
     * It holds only while every loaded row is ticked: a new page, sort or
     * filter brings unticked rows and clears it, so a bulk action never runs
     * on a set the user can no longer see.
     */
    allMatching?: boolean
    /**
     * Keep "select all N" across pages and sorts, and let the user untick rows
     * out of it: the selection is then the query and its exceptions, emitted
     * as `update:selectionToken` for a bulk action to send, with no need for
     * ids the client never loaded. `selected` stays the loaded keys. A change
     * of filter means a different set of rows, so it clears the selection.
     */
    selectionToken?: boolean
    /** Sort by several columns: Shift-click adds a column (v-model:sorts). */
    multiSort?: boolean
    /** Sort keys in order (v-model:sorts), with `multiSort`. Left unset the table keeps them. */
    sorts?: SortState[]
    /**
     * Drag a column's edge, or focus it and use the arrows, to set its width;
     * double-click clears it. Sets a fixed table layout once a width is set.
     */
    resizableColumns?: boolean
    /** Widths in px by column key (v-model:columnWidths). */
    columnWidths?: Record<string, number>
    /** Named sets of columns, offered in the table's menu. */
    columnPresets?: readonly ColumnPreset[]
    /** The chosen preset's id (v-model:columnPreset). */
    columnPreset?: string | null
    /**
     * Group rows under a heading: a column key or a function. Client side, so
     * with `load` it groups the loaded page. Groups follow the row order, so
     * sort by the same column to keep them put.
     */
    groupBy?: string | ((row: T) => unknown)
    groupLabel?: (value: unknown, rows: T[]) => string
    /** Collapsed group ids, `String(value)` (v-model:collapsedGroups). */
    collapsedGroups?: string[]
    /**
     * Rows open a panel beneath them, drawn by the `expanded` slot. A function
     * says which rows can. Ignored with `virtualRowHeight`.
     */
    expandable?: boolean | ((row: T) => boolean)
    /** Open row keys (v-model:expanded). */
    expanded?: RowKey[]
    /**
     * Draw only the rows in view, for thousands of them, at this height in px.
     * Give the table a `max-height`, or a limited parent: with room for every
     * row, every row is in view and all of them are drawn.
     *
     * The price of drawing a window:
     * - Every row, group heading included, must be exactly this tall: keep cells
     *   on one line (`nowrap`). A taller row drifts the scroll position.
     * - Row enter, leave and move animations are off.
     * - `expandable` is ignored: a panel has no fixed height.
     * - Arrow keys and typeahead reach the rows drawn, not the whole list.
     * - Sweeping ticks reaches the rows drawn; Ctrl+A and the header tick do
     *   cover all of them.
     * - Find in page sees the rows drawn.
     * `stickyHeader`, pins and the row menu work as usual.
     */
    virtualRowHeight?: number
    /** Rows drawn beyond each edge of the view. */
    virtualOverscan?: number
    /**
     * How the rows are drawn (v-model:layout): `table`, `cards` or `list`. Left
     * unset the table keeps the choice itself, remembered with `persist`.
     */
    layout?: TableLayout
    /**
     * The layouts the user can switch between, offered as a switch in the bar
     * above the rows. One layout, or none given, means no switch.
     */
    layouts?: readonly TableLayout[]
    /**
     * Below this width in px (the table's own, not the window's) a `table`
     * layout is drawn as a `list`: a phone gets one line per row instead of a
     * table that loses its columns to `hideBelow` or scrolls sideways.
     */
    layoutBelow?: number
    /**
     * `framed` (default) draws the rows on a surface with a border; `plain`
     * leaves the frame out, for a table that already sits in a card or a
     * section of its own.
     */
    variant?: "framed" | "plain"
    /** The narrowest a card may get in the `cards` layout; the grid fits as many as fit. */
    cardWidth?: string
  }>(),
  { palette: undefined,
    rows: () => [],
    pageSize: 25,
    skeletonRows: 5,
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
    filters: undefined,
    filtered: false,
    sorts: undefined,
    columnWidths: undefined,
    columnPreset: undefined,
    groupBy: undefined,
    collapsedGroups: undefined,
    expanded: undefined,
    virtualRowHeight: undefined,
    virtualOverscan: 6,
    layout: undefined,
    layouts: undefined,
    layoutBelow: undefined,
    variant: "framed",
    cardWidth: "16rem",
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
    rowsTotal: "Rows: {total}",
    selectedCount: "{count} selected",
    clearSelection: "Clear selection",
    pageSelected: "All {count} on this page are selected.",
    selectAllMatching: "Select all {total}",
    allMatchingSelected: "All {total} are selected.",
    columnPresets: "Column presets",
    resizeColumn: "Resize {column}",
    expandRow: "Expand row",
    collapseRow: "Collapse row",
    groupCount: "{label} ({count})",
    expandGroup: "Expand {label}",
    collapseGroup: "Collapse {label}",
    layoutTable: "Table",
    layoutCards: "Cards",
    layoutList: "List",
    layoutSwitch: "View",
    sortBy: "Sort",
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
  (e: "update:filters", value: TableFilters): void
  /** The empty table's reset was pressed: clear the filters kept outside it. */
  (e: "resetFilters"): void
  (e: "update:allMatching", value: boolean): void
  (e: "update:selectionToken", value: TableSelectionToken | null): void
  (e: "update:sorts", value: SortState[]): void
  (e: "update:columnWidths", value: Record<string, number>): void
  (e: "update:columnPreset", value: string | null): void
  (e: "update:collapsedGroups", value: string[]): void
  (e: "update:expanded", value: RowKey[]): void
  (e: "cellEdit", edit: TableCellEdit<T>): void
  (e: "rowClick", row: T): void
  (e: "update:layout", value: TableLayout): void
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

/*
 * The same menu on a button of the row's own, a "more" button in an actions
 * cell: cell slots get `openMenu` for its click. A dropdown per row stood up
 * the full reka menu stack in every row, closed — some twenty components a
 * row, which on a phone made a list of a few hundred rows take most of a
 * second to appear. Here the click becomes a right-click at the button's
 * corner, which the row remembers on its way up and the shared menu opens at.
 */
function openRowMenu(event: Event) {
  const button = event.currentTarget
  if (!isHTMLElement(button)) return
  const rect = button.getBoundingClientRect()
  const win = nodeWindow(button)
  button.dispatchEvent(
    new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left, clientY: rect.bottom }),
  )
}

// Row items first — they are what the pointer is actually on — then the
// table-wide ones under a rule, when the row has any of its own.
//
// `rowMenu` is asked once per right-click, here, and both the items and the
// heading are read off that one answer: a second call for the title could see
// a row that changed in between and head one row's actions with another's name.
const rowMenuFor = computed(() =>
  resolveRowMenu(menuRow.value ? props.rowMenu?.(menuRow.value) : undefined),
)

// The heading names the ROW, so it is only shown over the row's own actions: on
// a row without any, the menu is the table-wide one and a row title would claim
// those for the row.
const menuHead = computed(() => {
  const menu = rowMenuFor.value
  return menu.items.length && !paint.painting.value ? menu : undefined
})

const contextMenu = computed<ContextMenuItemDef[]>(() => {
  // A finger's long press opens this menu too; while it is selecting rows, no.
  if (paint.painting.value) return []
  const table = tableMenu()
  const row = rowMenuFor.value.items
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
const ownSorts = ref<SortState[]>([])
const activeSort = computed(() => {
  if (props.multiSort) return (props.sorts ?? ownSorts.value)[0] ?? null
  return props.sort !== undefined ? props.sort : ownSort.value
})
const sortList = computed<SortState[]>(() => {
  if (props.multiSort) return props.sorts ?? ownSorts.value
  return activeSort.value ? [activeSort.value] : []
})
const sortOf = (col: TableColumn<T>) => sortList.value.find((sort) => sort.key === col.key)

// ── server-backed rows ───────────────────────────────────────
const loaded = shallowRef<T[]>([])
const total = ref(0)
const facets = ref<Record<string, unknown[]>>({})
const failed = ref(false)
const page = ref(1)
const task = useAsyncTask<TablePage<T>>()
const busy = computed(() => props.loading || task.pending.value)

const sourceRows = computed<T[]>(() => (props.load ? loaded.value : props.rows))
const sourceIndex = computed(() => new Map(sourceRows.value.map((row, i) => [row, i])))

// New objects drop what position-keyed selection pointed at, without a word.
let warnedRowKey = false
watch(sourceRows, () => {
  if (warnedRowKey || props.rowKey || !props.selected.length) return
  warnedRowKey = true
  devWarn("LpTable: rows were replaced while some are selected, and without `rowKey` the selection now points at positions, not rows. Set `rowKey`.")
})

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
const ownHidden = ref<Record<string, Set<unknown>>>({})
let lastHidden: Record<string, Set<unknown>> = {}
/*
 * The parent's lists become sets once per real change: a parent handing back
 * an equal state as a new object (its v-model echo, a computed that rebuilt)
 * must not refetch a server page or replay the rows' motion.
 */
const hiddenValues = computed<Record<string, Set<unknown>>>(() => {
  const next = props.filters !== undefined ? toHiddenSets(props.filters) : ownHidden.value
  if (sameHidden(next, lastHidden)) return lastHidden
  lastHidden = next
  return next
})

function writeHidden(next: Record<string, Set<unknown>>) {
  if (sameHidden(next, hiddenValues.value)) return
  ownHidden.value = next
  emit("update:filters", fromHiddenSets(next))
}

/*
 * Rows animate only when the table itself reshuffles them — a header filter or
 * a sort, a change the eye should follow. A parent replacing `rows` wholesale
 * (the next page, a reload) swaps instantly: animated, the old page would fade
 * out beside the new one, and the table would show both lists for a moment.
 */
const animating = ref(false)
/* Longer than any row transition: a fallback off switch, not a measure of one. */
const MOTION_WINDOW_MS = 600
let motionTimer: ReturnType<typeof setTimeout> | undefined
function withMotion(change: () => void) {
  if (!props.load) {
    animating.value = true
    if (motionTimer) clearTimeout(motionTimer)
    motionTimer = setTimeout(() => (animating.value = false), MOTION_WINDOW_MS)
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
useResizeObserver(
  () => tableEl.value?.closest<HTMLElement>("[data-reka-scroll-area-viewport]") ?? tableEl.value?.parentElement,
  (_, el) => (tableWidth.value = el.clientWidth),
  { immediate: true },
)

const visibleColumns = computed(() =>
  props.columns.filter(
    (c) => !hiddenColumns.value.has(c.key) && !(c.hideBelow && tableWidth.value < c.hideBelow),
  ),
)

// Pinned columns at their edges; with no pins, the columns as given.
const shownColumns = computed(() => orderPinned(visibleColumns.value))

// ── column widths and pins ───────────────────────────────────
const RESIZE_STEP_PX = 16
/* Room counted for a column with no width of its own, once the layout is fixed. */
const UNSET_COLUMN_PX = 120
const TICK_COLUMN_WIDTH = "3.25rem"
const EXPAND_COLUMN_WIDTH = "2.5rem"

const ownWidths = ref<Record<string, number>>({})
const widths = computed(() => props.columnWidths ?? ownWidths.value)
const fixedLayout = computed(() => !!props.resizableColumns && Object.keys(widths.value).length > 0)
const tableStyle = computed(() => {
  if (!fixedLayout.value) return undefined
  const sum = shownColumns.value.reduce((room, col) => room + (widths.value[col.key] ?? UNSET_COLUMN_PX), 0)
  return { minWidth: `${sum}px` }
})

function writeWidths(next: Record<string, number>) {
  ownWidths.value = next
  emit("update:columnWidths", next)
}

const canResize = (col: TableColumn<T>) => !!props.resizableColumns && col.resizable !== false && !!col.label
/* Marks the header cells something measures, and only those. */
const measuredCol = (col: TableColumn<T>) => (props.resizableColumns || col.pin ? col.key : undefined)

function headerWidths(): Record<string, number> {
  const measured: Record<string, number> = {}
  for (const cell of frameEl.value?.querySelectorAll<HTMLElement>("th[data-lp-col]") ?? []) {
    measured[cell.dataset.lpCol!] = cell.offsetWidth
  }
  return measured
}

function setWidth(col: TableColumn<T>, width: number) {
  writeWidths({ ...widths.value, [col.key]: clampColumnWidth(width, col.minWidth, col.maxWidth) })
}

function clearWidth(col: TableColumn<T>) {
  const { [col.key]: _gone, ...rest } = widths.value
  writeWidths(rest)
}

/*
 * The first drag fixes the layout, which would hand the free room out anew, so
 * every column starts from the width it has on screen.
 */
function startResize(event: PointerEvent, col: TableColumn<T>) {
  const handle = event.currentTarget
  if (!isHTMLElement(handle) || event.button !== 0) return
  event.stopPropagation()
  const measured = headerWidths()
  if (!fixedLayout.value) writeWidths(measured)
  const from = measured[col.key] ?? handle.parentElement?.offsetWidth ?? 0
  const startX = event.clientX
  startPointerDrag(event, { move: (e) => setWidth(col, from + e.clientX - startX), end: () => {} })
}

function onResizeKey(event: KeyboardEvent, col: TableColumn<T>) {
  const step = event.key === "ArrowRight" ? RESIZE_STEP_PX : event.key === "ArrowLeft" ? -RESIZE_STEP_PX : 0
  if (!step) return
  event.preventDefault()
  event.stopPropagation()
  const measured = headerWidths()
  if (!fixedLayout.value) writeWidths(measured)
  setWidth(col, (widths.value[col.key] ?? measured[col.key] ?? UNSET_COLUMN_PX) + step)
}

const pinWidths = ref<Record<string, number>>({})
const pinOffset = computed(() => pinOffsets(shownColumns.value, pinWidths.value))
function measurePins() {
  if (shownColumns.value.some((col) => col.pin)) pinWidths.value = headerWidths()
}
watch([shownColumns, widths, tableWidth], measurePins, { flush: "post" })
onMounted(measurePins)

const PIN_HEAD = "sticky z-[11] bg-surface-soft"
const PIN_CELL = "sticky z-[1] bg-surface"
const pinStyle = (col: TableColumn<T>) => (col.pin ? { [col.pin]: `${pinOffset.value[col.key] ?? 0}px` } : undefined)

function headStyle(col: TableColumn<T>) {
  const width = (props.resizableColumns ? widths.value[col.key] : undefined)
  const size = width != null ? `${width}px` : col.width
  if (!size && !col.pin) return undefined
  return { ...(size ? { width: size } : {}), ...pinStyle(col) }
}

// ── column presets ───────────────────────────────────────────
const ownPreset = ref<string | null>(null)
const activePreset = computed(() => (props.columnPreset !== undefined ? props.columnPreset : ownPreset.value))

function showPreset(id: string | null | undefined) {
  const preset = props.columnPresets?.find((p) => p.id === id)
  if (!preset) return
  hiddenColumns.value = presetHidden(preset, props.columns)
  if (preset.widths && props.resizableColumns) writeWidths({ ...widths.value, ...preset.widths })
}

function choosePreset(id: string | null) {
  ownPreset.value = id
  emit("update:columnPreset", id)
  showPreset(id)
}
watch(() => props.columnPreset, showPreset, { immediate: true })

const facetColumns = computed(() => props.columns.filter((col) => col.filterable).map((col) => col.key))
const localFacets = useTableFacets({
  rows: () => props.load ? [] : props.rows,
  columns: () => facetColumns.value,
  hidden: () => hiddenValues.value,
})

function valuesOf(col: TableColumn<T>): unknown[] {
  const found = props.load
    ? facets.value[col.key] ?? [...new Set(sourceRows.value.map((row) => row[col.key]))]
    : localFacets.distinct(col.key)
  return col.filterValues ? [...new Set([...col.filterValues, ...found])] : found
}

function isValueHidden(key: string, value: unknown): boolean {
  return hiddenValues.value[key]?.has(value) ?? false
}

function showAllValues(key: string) {
  writeHidden({ ...hiddenValues.value, [key]: new Set() })
}

function setHidden(key: string, next: Set<unknown>) {
  writeHidden({ ...hiddenValues.value, [key]: next })
}

// Whoever changed the filters, the funnel or a control of the parent's, the
// rows they hide and reveal move the same way.
watch(hiddenValues, () => withMotion(() => {}))

function labelOf(col: TableColumn<T>, value: unknown): string {
  return col.valueLabel?.(value) ?? String(value ?? "—")
}

/*
 * What the filter of one column offers. Counts follow the OTHER filters, the
 * way a faceted search does: with "Status: open" set, the "Owner" filter
 * counts open rows, which is what the user is about to narrow further.
 */
const facetOptions = computed(() => new Map(props.columns.filter((col) => col.filterable).map((col) => {
  return [col.key, computed(() => {
    const counts = props.load || col.filterCounts === false ? undefined : localFacets.counts(col.key)
    return valuesOf(col).map((value) => ({
      value,
      label: labelOf(col, value),
      count: counts?.get(value) ?? (counts ? 0 : undefined),
    }))
  })]
})))

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
  writeHidden({})
}

function resetFilters() {
  clearAllFilters()
  emit("resetFilters")
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
  // The set on screen is no longer the preset's.
  if (activePreset.value != null) {
    ownPreset.value = null
    emit("update:columnPreset", null)
  }
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

function sortRows(rows: T[]): T[] {
  if (!sortList.value.length || props.load) return rows
  return sortByKeys(rows, sortList.value, props.columns)
}

const displayRows = computed<T[]>(() => sortRows(filteredRows.value))

function writeSorts(next: SortState[]) {
  withMotion(() => {
    ownSorts.value = next
    ownSort.value = next[0] ?? null
    if (props.multiSort) emit("update:sorts", next)
    emit("update:sort", next[0] ?? null)
  })
}

function toggleSort(col: TableColumn<T>, event?: MouseEvent) {
  if (!col.sortable) return
  // Cycle: none → asc → desc → none, scoped to the clicked column.
  // Kept locally as well as emitted: a parent that binds v-model overwrites
  // this on the way back, and one that does not still gets a table that sorts.
  writeSorts(nextSorts(sortList.value, col.key, !!(props.multiSort && event?.shiftKey)))
}

function sortIcon(col: TableColumn<T>): string {
  const s = sortOf(col)
  if (!s) return "lucide:chevrons-up-down"
  return s.dir === "asc" ? "lucide:arrow-up" : "lucide:arrow-down"
}

/* The key's place in a sort by several columns; nothing to say with just one. */
function sortPosition(col: TableColumn<T>): number | undefined {
  if (sortList.value.length < 2) return undefined
  const at = sortList.value.findIndex((sort) => sort.key === col.key)
  return at < 0 ? undefined : at + 1
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
const MENU_CLOSE_LIMIT_MS = 600
const FOCUS_RETURN_MS = 30
function openFilter(key: string) {
  const open = () => frameEl.value?.querySelector<HTMLElement>(`[data-lp-filter="${CSS.escape(key)}"]`)?.click()
  const started = performance.now()
  // The menu this was picked from, in the table's own document; a menu that
  // opens elsewhere in the meantime is no reason to wait.
  const closing = [...(frameEl.value?.ownerDocument ?? document).querySelectorAll("[data-reka-menu-content]")]
  const wait = () => {
    if (!closing.some((menu) => menu.isConnected) || performance.now() - started > MENU_CLOSE_LIMIT_MS) setTimeout(open, FOCUS_RETURN_MS)
    else requestAnimationFrame(wait)
  }
  requestAnimationFrame(wait)
}

function headerMenu(col: TableColumn<T>): ContextMenuItemDef[] {
  const s = activeSort.value
  const set = (next: SortState | null) => () => writeSorts(next ? [next] : [])

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
  const presets: ContextMenuItemDef[] = props.columnPresets?.length
    ? [{
        label: text.value.columnPresets,
        icon: "lucide:layout-template",
        children: props.columnPresets.map((preset) => ({
          label: preset.label,
          checked: activePreset.value === preset.id,
          onSelect: () => choosePreset(preset.id),
        })),
      }]
    : []
  return [
    ...exportItem,
    ...presets,
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
  if (props.multiSort) query.sorts = sortList.value
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

// A new sort, filter or page size starts from the first page: page 4 of a
// different question, or of a different cut of the rows, is a page of nothing
// in particular.
watch([sortList, hiddenValues, () => props.pageSize], () => {
  if (!props.load) return
  if (page.value !== 1) page.value = 1
  else fetchPage(props.debounce)
})
watch(page, () => fetchPage())

// ── remembered state ─────────────────────────────────────────
// Read after mount, not during setup: a server render knows nothing of this
// browser's storage, and restoring earlier would make the first client render
// disagree with it.
const store = useKitStorage()
const storageKey = computed(() => (props.persist ? `lp-table:${props.persist}` : ""))
const restored = ref(false)
onMounted(() => {
  if (storageKey.value) {
    const state = parseTableState(store.get(storageKey.value), props.columns.map((c) => c.key))
    if (state) {
      if (state.sort !== undefined) {
        ownSort.value = state.sort
        ownSorts.value = state.sort ? [state.sort] : []
        emit("update:sort", state.sort)
      }
      if (state.hidden) writeHidden(mergeRestored(hiddenValues.value, state.hidden))
      if (state.columns) hiddenColumns.value = new Set(state.columns)
    }
    // Kept beside the table state rather than in it: the layout is a choice
    // about how to look, and an older table state must not lose its sort and
    // filters to a field it never had.
    const layout = store.get(`${storageKey.value}:layout`)
    if ((layout === "table" || layout === "cards" || layout === "list") && (!props.layouts || props.layouts.includes(layout))) {
      ownLayout.value = layout
      if (props.layout !== undefined && props.layout !== layout) emit("update:layout", layout)
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
  store.set(storageKey.value, state)
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
    downloadFile(`${fileStem(options.filename ?? props.exportFilename, "table")}.csv`, csv, "text/csv;charset=utf-8", tableEl.value?.ownerDocument)
  }
  return csv
}

defineExpose({ reload: () => fetchPage(), exportCsv })

// ── selection ────────────────────────────────────────────────
const selectedSet = computed(() => new Set(props.selected))
/*
 * With `selectionToken`, "all N" is the query and its exceptions rather than
 * keys: the rows the client never loaded have no key to hold.
 */
const excluded = ref<Set<RowKey>>(new Set())
const tokenActive = computed(() => !!props.selectionToken && !!props.load && props.allMatching)
const isSelected = (key: RowKey) => (tokenActive.value ? !excluded.value.has(key) : selectedSet.value.has(key))
// "All" is what the user can see: rows a header filter hides are left alone.
const allKeys = computed(() => filteredRows.value.map((r, i) => keyFor(r, i)))
const allChecked = computed(
  () => allKeys.value.length > 0 && allKeys.value.every(isSelected),
)
const someChecked = computed(
  () => !allChecked.value && allKeys.value.some(isSelected),
)

function toggleAll(checked: boolean) {
  if (tokenActive.value) {
    if (checked) excluded.value = new Set()
    else clearSelection()
    return
  }
  const next = new Set(selectedSet.value)
  for (const key of allKeys.value) {
    if (checked) next.add(key)
    else next.delete(key)
  }
  emit("update:selected", [...next])
}

function toggleRow(key: RowKey, checked: boolean) {
  if (tokenActive.value) {
    const out = new Set(excluded.value)
    if (checked) out.delete(key)
    else out.add(key)
    if (out.size >= total.value) clearSelection()
    else excluded.value = out
    return
  }
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
  enabled: () => !!props.selectable && !tokenActive.value,
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
  excluded.value = new Set()
}

watch([tokenActive, sortList, excluded, total], () => {
  if (!tokenActive.value) {
    if (excluded.value.size) excluded.value = new Set()
    emit("update:selectionToken", null)
    return
  }
  emit("update:selectionToken", {
    sorts: sortList.value,
    hidden: Object.fromEntries(
      Object.entries(hiddenValues.value).filter(([, set]) => set.size).map(([key, set]) => [key, [...set]]),
    ),
    excluded: [...excluded.value],
    total: total.value,
  })
})
// Another filter is another set of rows: what was selected no longer describes it.
watch(hiddenValues, () => {
  if (tokenActive.value) clearSelection()
})

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
  if (holdMode.value && props.selected.length) toggleRow(key, !isSelected(key))
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
  if (!all && props.allMatching && !props.selectionToken) emit("update:allMatching", false)
})
/*
 * One status line that rolls between its states ("60 rows", "3 selected",
 * "All 40 are selected") instead of swapping text in a frame; the controls
 * beside it fade in and out, and the group eases its width so they slide.
 */
const statusText = computed(() => {
  if (!(props.selectable && props.selected.length)) return countText.value
  if (tokenActive.value && excluded.value.size) {
    return text.value.selectedCount.replace("{count}", String(total.value - excluded.value.size))
  }
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
const slots = useSlots()
const showBar = computed(
  () =>
    props.summary ||
    props.exportable ||
    !!slots.toolbar ||
    layoutChoices.value.length > 0 ||
    (!!props.selectable && props.selected.length > 0) ||
    activeFilters.value.length > 0,
)
const filteredOut = computed(() => {
  if (busy.value || failed.value || displayRows.value.length) return false
  if (props.filtered) return true
  if (props.load) return Object.values(hiddenValues.value).some((set) => set.size)
  return props.rows.length > 0
})

const cellY = computed(() => (props.density === "compact" ? "py-1.5" : "py-3"))

// ── layouts ──────────────────────────────────────────────────
//
// One set of rows and tools, drawn three ways. Everything above this line
// (sort, filters, selection, the menu, export, the palette) reads
// `displayRows` and knows nothing of how they are drawn, so a card grid or a
// list gets all of it for free instead of every page building its own.
const ownLayout = ref<TableLayout>("table")
const chosenLayout = computed<TableLayout>(() => props.layout ?? ownLayout.value)

// The table's own width, not the window's: the same table sits in a wide page
// and in a narrow side panel.
const frameWidth = ref(Number.POSITIVE_INFINITY)
useResizeObserver(frameEl, (_, el) => (frameWidth.value = el.clientWidth), { immediate: true })

const activeLayout = computed<TableLayout>(() =>
  chosenLayout.value === "table" && props.layoutBelow && frameWidth.value < props.layoutBelow
    ? "list"
    : chosenLayout.value,
)
// While the width forces a list the switch would change nothing on screen, so
// it steps aside until there is room for the choice again.
const forcedList = computed(() => chosenLayout.value === "table" && activeLayout.value === "list")
const layoutChoices = computed(() =>
  props.layouts && props.layouts.length > 1 && !forcedList.value ? props.layouts : [],
)
const LAYOUT_ICONS: Record<TableLayout, string> = {
  table: "lucide:table-2",
  cards: "lucide:layout-grid",
  list: "lucide:list",
}
const layoutOptions = computed(() =>
  layoutChoices.value.map((value) => {
    const label = text.value[`layout${value[0]!.toUpperCase()}${value.slice(1)}`] ?? value
    return { value, icon: LAYOUT_ICONS[value], ariaLabel: label }
  }),
)

function chooseLayout(next: string) {
  const layout = next as TableLayout
  if (layout === chosenLayout.value) return
  ownLayout.value = layout
  emit("update:layout", layout)
}

// Without a header the sort and the column filters need a home: the bar.
const headerless = computed(() => activeLayout.value !== "table")
const sortableColumns = computed(() => props.columns.filter((col) => col.sortable && col.label))
const filterableColumns = computed(() => props.columns.filter((col) => col.filterable && col.label))

function sortMenu(): ContextMenuItemDef[] {
  const current = activeSort.value
  const dir = current?.dir ?? "asc"
  return [
    // The columns, the one sorted by ticked; picking one keeps the direction.
    ...sortableColumns.value.map((col): ContextMenuItemDef => ({
      label: col.label,
      selected: current?.key === col.key,
      onSelect: () => writeSorts([{ key: col.key, dir }]),
    })),
    {
      label: text.value.sortAsc,
      icon: "lucide:arrow-up",
      separatorBefore: true,
      disabled: !current,
      selected: current?.dir === "asc",
      onSelect: () => current && writeSorts([{ key: current.key, dir: "asc" }]),
    },
    {
      label: text.value.sortDesc,
      icon: "lucide:arrow-down",
      disabled: !current,
      selected: current?.dir === "desc",
      onSelect: () => current && writeSorts([{ key: current.key, dir: "desc" }]),
    },
    { label: text.value.sortClear, icon: "lucide:x", separatorBefore: true, disabled: !current, onSelect: () => writeSorts([]) },
  ]
}

const sortSummary = computed(() => {
  const current = activeSort.value
  const col = current && props.columns.find((c) => c.key === current.key)
  return col ? col.label : text.value.sortBy
})

// A card shows the columns the user keeps, not the ones a narrow table drops:
// the card has its own room, and `hideBelow` was a decision about a row.
const cardColumns = computed(() =>
  orderPinned(props.columns.filter((col) => !hiddenColumns.value.has(col.key))),
)
const titleColumn = computed(() => cardColumns.value[0])
const fieldColumns = computed(() => cardColumns.value.slice(1).filter((col) => col.label))
const lineColumns = computed(() => fieldColumns.value.filter((col) => col.list !== false))
function lineMode(col: TableColumn<T>, row: T): TableListMode {
  return (typeof col.list === "function" ? col.list(row) : col.list) ?? true
}

watch(chosenLayout, (layout) => {
  if (storageKey.value && restored.value) store.set(`${storageKey.value}:layout`, layout)
})

/*
 * Skeleton bars of uneven width, the way real cells are: a column of identical
 * bars reads as a striped background rather than as rows of text. Fixed per
 * cell rather than random, so a re-render does not reshuffle them.
 */
const SKELETON_WIDTHS = [72, 48, 88, 60, 40, 80, 56]
function skeletonWidth(row: number, col: number): string {
  return `${SKELETON_WIDTHS[(row * 3 + col * 2) % SKELETON_WIDTHS.length]}%`
}

// ── expansion, groups and the rows drawn ─────────────────────
const VIEWPORT = "[data-reka-scroll-area-viewport]"
const expansionOn = computed(() => !!props.expandable && !props.virtualRowHeight)
const ownExpanded = ref<RowKey[]>([])
const expandedKeys = computed(() => new Set(props.expanded ?? ownExpanded.value))
const canExpand = (row: T) => (typeof props.expandable === "function" ? props.expandable(row) : !!props.expandable)

function toggleExpanded(key: RowKey) {
  const next = new Set(expandedKeys.value)
  if (!next.delete(key)) next.add(key)
  ownExpanded.value = [...next]
  emit("update:expanded", ownExpanded.value)
}

const ownCollapsed = ref<string[]>([])
const collapsedSet = computed(() => new Set(props.collapsedGroups ?? ownCollapsed.value))

function toggleGroup(id: string) {
  const next = new Set(collapsedSet.value)
  if (!next.delete(id)) next.add(id)
  ownCollapsed.value = [...next]
  emit("update:collapsedGroups", ownCollapsed.value)
}

type ViewEntry =
  | { kind: "row"; id: string; row: T; index: number }
  | { kind: "detail"; id: string; row: T; index: number }
  | { kind: "group"; id: string; group: string; value: unknown; rows: T[]; label: string; collapsed: boolean }

function groupValue(row: T): unknown {
  return typeof props.groupBy === "function" ? props.groupBy(row) : row[props.groupBy as keyof T]
}

const allEntries = computed<ViewEntry[]>(() => {
  const rows = displayRows.value
  const indexes = props.groupBy !== undefined ? new Map(rows.map((row, i) => [row, i])) : null
  const entries: ViewEntry[] = []
  const pushRow = (row: T, index: number) => {
    const key = keyFor(row, index)
    entries.push({ kind: "row", id: String(key), row, index })
    if (expansionOn.value && expandedKeys.value.has(key) && canExpand(row)) {
      entries.push({ kind: "detail", id: `lp-detail:${key}`, row, index })
    }
  }
  if (!indexes) {
    rows.forEach((row, index) => pushRow(row, index))
    return entries
  }
  for (const group of groupRows(rows, groupValue)) {
    const collapsed = collapsedSet.value.has(group.id)
    const name = props.groupLabel?.(group.value, group.rows) ?? group.id
    const label = text.value.groupCount.replace("{label}", name).replace("{count}", String(group.rows.length))
    entries.push({ kind: "group", id: `lp-group:${group.id}`, group: group.id, value: group.value, rows: group.rows, label, collapsed })
    if (!collapsed) for (const row of group.rows) pushRow(row, indexes.get(row) ?? 0)
  }
  return entries
})

const viewportEl = shallowRef<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)
const onViewportScroll = () => (scrollTop.value = viewportEl.value?.scrollTop ?? 0)
onMounted(() => {
  if (props.virtualRowHeight) viewportEl.value = frameEl.value?.querySelector<HTMLElement>(VIEWPORT) ?? null
})
watch(viewportEl, (el, _, onCleanup) => {
  if (!el) return
  el.addEventListener("scroll", onViewportScroll, { passive: true })
  onCleanup(() => el.removeEventListener("scroll", onViewportScroll))
})
useResizeObserver(viewportEl, (_, el) => (viewportHeight.value = el.clientHeight), { immediate: true })

const rowWindowed = computed(() =>
  props.virtualRowHeight && !headerless.value
    ? rowWindow(scrollTop.value, viewportHeight.value, props.virtualRowHeight, allEntries.value.length, props.virtualOverscan)
    : null,
)
const viewEntries = computed(() =>
  rowWindowed.value ? allEntries.value.slice(rowWindowed.value.start, rowWindowed.value.end) : allEntries.value,
)
/* The row's place among all of them, for assistive tech: the header is row 1. */
const rowOffset = (entry: ViewEntry) => (rowWindowed.value?.start ?? 0) + viewEntries.value.indexOf(entry) + 2
const rowStyle = computed(() => (props.virtualRowHeight ? { height: `${props.virtualRowHeight}px` } : undefined))

function isEditable(col: TableColumn<T>, row: T): boolean {
  return typeof col.editable === "function" ? col.editable(row) : !!col.editable
}

function saveCell(col: TableColumn<T>, row: T, value: string) {
  const parsed = col.parseEdit ? col.parseEdit(value, row) : value
  emit("cellEdit", { row, key: col.key, value: parsed, previous: row[col.key] })
}

const colSpan = computed(
  () => visibleColumns.value.length + (props.selectable ? 1 : 0) + (expansionOn.value ? 1 : 0),
)

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
  viewEntries.value.flatMap((entry) =>
    entry.kind === "row" ? [{ id: entry.id, label: String(entry.row[props.columns[0]?.key ?? ""] ?? "") }] : [],
  ),
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

/*
 * A change that brings in, takes out or reorders many rows at once — a filter
 * lifted from ten rows back to sixty, a page of new rows, a sort of a long
 * list — is not animated row by row. Each row eased on its own reads as noise
 * at that size, and following them is costly: TransitionGroup measures every
 * row before and after (a forced layout of all the new rows inside the click),
 * then sets an enter or move transition on each. The rows land at once and the
 * body eases in as one instead, a single opacity animation on the compositor.
 * A few rows leaving, arriving or moving (a filter that hides some, a row
 * deleted) keep their own motion, which is what lets the eye follow them.
 *
 * Counted by rowChanges: the rows that arrive, leave or change their order;
 * the ones that only slide aside to close a gap do not count.
 */
const ROW_MOTION_LIMIT = 12
const rowsEl = shallowRef<HTMLElement | null>(null)
function setRowsEl(el: unknown) {
  const node = (el as { $el?: HTMLElement } | null)?.$el ?? null
  rowsEl.value = node
  roving.setContainer(node)
}
const motionIds = computed(() => (headerless.value ? allEntries.value : viewEntries.value).map((entry) => entry.id))
/* The rows on screen, written after each render: what the next change is measured against. */
let shownIds: readonly string[] = []
const bigSwap = computed(() => rowChanges(shownIds, motionIds.value) > ROW_MOTION_LIMIT)
let settleFlip = false
watch(
  motionIds,
  (ids) => {
    const eased = bigSwap.value && shownIds.length > 0 && ids.length > 0
    shownIds = ids
    const body = rowsEl.value
    if (!eased || !body || props.virtualRowHeight || prefersReducedMotion(nodeWindow(body))) return
    // Two names for one animation: switching between them restarts it without
    // the reflow that taking a class off and putting it back would need.
    settleFlip = !settleFlip
    body.dataset.lpSettle = settleFlip ? "a" : "b"
  },
  { flush: "post", immediate: true },
)

function onRowKeydown(event: KeyboardEvent) {
  // Space ticks rather than activates when the table is selectable — the
  // standard split for a multi-select list.
  if (event.key === " " && props.selectable && roving.activeId.value) {
    event.preventDefault()
    const key = roving.activeId.value
    const row = rowByKey.value.get(key)
    if (row) {
      const rowKey = keyFor(row, displayRows.value.indexOf(row))
      toggleRow(rowKey, !isSelected(rowKey))
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
useResizeObserver(
  () => (props.stickyHeader ? headEl.value : null),
  (_, el) => (headHeight.value = (el as HTMLElement).offsetHeight),
  { immediate: true },
)
watch(
  () => props.stickyHeader,
  (sticky) => {
    if (!sticky) headHeight.value = 0
  },
)
onBeforeUnmount(() => {
  if (motionTimer) clearTimeout(motionTimer)
})

const barInsetTop = computed(() =>
  props.stickyHeader && headHeight.value ? `${headHeight.value}px` : undefined,
)

const paletteScope = usePaletteScope()
const paletteId = useId()
suppressPaletteDiscovery()
usePaletteCommands(() => {
  if (props.palette === false) return []
  const name = props.palette?.label ?? attrs["aria-label"] as string | undefined
  if (!name) return []
  const id = `${paletteScope?.id}/${props.palette?.id ?? paletteId}`
  return [{
    id, label: name, icon: "lucide:table", children: [
      ...menuPaletteCommands(tableMenu(), `${id}/table`),
      ...displayRows.value.map((row, index) => {
        const menu = resolveRowMenu(props.rowMenu?.(row))
        const rowId = `${id}/row/${keyFor(row, index)}`
        const labelKey = props.palette && props.palette.labelKey || props.columns[0]?.key
        return {
          id: rowId, label: menu.title ?? String(labelKey ? row[labelKey] ?? keyFor(row, index) : keyFor(row, index)),
          description: menu.subtitle, icon: menu.icon ?? "lucide:rows-3", image: menu.image,
          onSelect: () => emit("rowClick", row), actions: menuPaletteCommands(menu.items, rowId),
          previewComponent: { setup: () => () => h(LpDataList, { items: props.columns.map(column => ({
            label: column.label, value: typeof row[column.key] === "object" ? null : String(row[column.key] ?? ""),
          })) }) },
        }
      }),
    ],
  }]
}, { automatic: true })
</script>

<template>
  <!-- No top fade: a sticky header sits in the masked band and would be dimmed
       by it. The bottom edge is left crisp with it for symmetry. -->
  <div ref="frameEl" class="flex flex-col gap-3" :class="rootClass">
  <!-- What the table is showing right now: the filters in force, each one
       a chip that clears it, the row count, and what is selected with room
       for the consumer's bulk actions. Eased in and out (LpShift), so the
       table below glides rather than jumps when the first filter is set. -->
  <!-- The gap below the bar lives inside the eased box (pb-3), cancelled
       outside it (-mb-3): an empty box must not leave the root's gap behind. -->
  <LpShift class="-mb-3">
    <!-- One line above the table: the page's own controls (#toolbar), the
         filters in force, then the status and Export at the end. Export used
         to sit on a line of its own and the page's search and filters on a
         third, so every table opened with two bands of mostly empty space. -->
    <div v-if="showBar" class="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2 pb-3 text-xs">
      <div v-if="$slots.toolbar" class="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <slot name="toolbar" />
      </div>
      <!-- Without a header the sort and the column funnels live here: the same
           menu and the same filter, reached from the bar instead. -->
      <div v-if="headerless && (sortableColumns.length || filterableColumns.length)" class="flex flex-wrap items-center gap-1 text-sm">
        <LpDropdownMenu v-if="sortableColumns.length" :items="sortMenu()">
          <template #trigger>
            <LpButton variant="ghost" size="sm" :aria-label="text.sortBy">
              <LpIcon
                :name="activeSort ? (activeSort.dir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down') : 'lucide:arrow-up-down'"
                :size="14"
              />
              {{ sortSummary }}
            </LpButton>
          </template>
        </LpDropdownMenu>
        <LpPopover
          v-for="col in filterableColumns"
          :key="col.key"
          align="start"
          panel-class="w-72"
          :aria-label="text.filterColumn.replace('{column}', col.label)"
        >
          <template #trigger>
            <LpButton
              variant="ghost"
              size="sm"
              :class="hiddenValues[col.key]?.size ? 'text-brand' : ''"
              :aria-label="text.filterColumn.replace('{column}', col.label)"
              :data-lp-filter="col.key"
            >
              <LpIcon :name="hiddenValues[col.key]?.size ? 'lucide:filter-x' : 'lucide:filter'" :size="14" />
              {{ col.label }}
            </LpButton>
          </template>
          <LpTableFilter
            :options="facetOptions.get(col.key)?.value ?? []"
            :hidden="hiddenValues[col.key] ?? new Set()"
            :labels="filterLabels()"
            @update:hidden="(next) => setHidden(col.key, next)"
          />
        </LpPopover>
      </div>
      <div v-if="activeFilters.length" class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        <LpBadge
          v-for="f in activeFilters"
          :key="f.col.key"
          tone="brand"
          removable
          :remove-label="text.clearFilter.replace('{column}', f.col.label)"
          class="max-w-72 animate-[chip-in_var(--duration-fast)_var(--ease-emphasized)] font-normal text-ink motion-reduce:animate-none"
          @remove="showAllValues(f.col.key)"
        >
          <span class="truncate"><span class="text-muted">{{ f.col.label }}:</span> {{ f.text }}</span>
        </LpBadge>
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
        <LpSegmented
          v-if="layoutOptions.length"
          :model-value="chosenLayout"
          :options="layoutOptions"
          size="sm"
          :aria-label="text.layoutSwitch"
          @update:model-value="chooseLayout"
        />
        <LpButton v-if="exportable" variant="ghost" size="sm" @click="exportCsv()">
          <LpIcon name="lucide:download" :size="14" />
          {{ text.exportCsv }}
        </LpButton>
      </div>
      </LpShift>
    </div>
  </LpShift>
  <!-- The frame eases to its new height as rows come and go. A leaving row
       stays in the flow while it fades (a positioned <tr> loses the column
       grid), so when it is finally removed the table lost its height in one
       frame: the rows slid aside smoothly and the box under them snapped.
       Always on rather than only while `animating`: LpShift starts over when
       it is switched on, so the change that switched it on was never eased.
       Rows the parent replaces wholesale still swap at once; only the frame
       eases. A virtual table owns its own height and stays out. -->
  <!-- flex-auto, not flex-1: a zero basis overrides the height LpShift sets
       while it eases, and the box jumped to its new size regardless. -->
  <LpShift :disabled="!!virtualRowHeight" class="flex min-h-0 flex-auto flex-col">
  <LpScrollArea
    v-bind="scrollAttrs"
    :fade="false"
    v-if="!headerless"
    class="min-h-0 flex-1"
    :class="variant === 'framed' ? 'rounded-card border border-line bg-surface' : ''"
    :style="load && floor ? { minHeight: `${floor + 2}px` } : undefined"
    :bar-inset-top="barInsetTop"
  >
    <!-- The table-wide menu, which is what a right-click on empty header space
         reaches: rows and headers carry their own and take the event first, so
         this is the fallback rather than a competitor. -->
    <LpContextMenu
      :items="contextMenu"
      always
      :no-hint="!rowMenu"
      :title="menuHead?.title"
      :subtitle="menuHead?.subtitle"
      :title-icon="menuHead?.icon"
      :title-image="menuHead?.image"
    >
    <table
      ref="tableEl"
      class="w-full border-collapse text-sm"
      :class="fixedLayout ? 'table-fixed' : ''"
      :style="tableStyle"
      :aria-rowcount="virtualRowHeight ? allEntries.length + 1 : undefined"
    >
      <!-- The background belongs on `thead` itself, not only on its row:
           `border-collapse` collapses the borders, and with a sticky header the
           rows show through that seam — a band of body text rides across the
           header on every scroll. -->
      <thead
        ref="headEl"
        :class="stickyHeader ? 'sticky top-0 z-10 bg-surface-soft' : ''"
      >
        <tr class="border-b border-line bg-surface-soft">
          <th v-if="expansionOn" class="w-px p-0" :style="fixedLayout ? { width: EXPAND_COLUMN_WIDTH } : undefined" :class="cellY" />
          <th
            v-if="selectable"
            class="w-px p-0"
            :class="cellY"
            :style="fixedLayout ? { width: ticksShown ? TICK_COLUMN_WIDTH : '0' } : undefined"
          >
            <div class="lp-tick lp-tick-open" :class="ticksShown ? '' : 'lp-tick-hidden'" :inert="!ticksShown">
              <LpCheckbox
                :model-value="allChecked"
                :indeterminate="someChecked"
                @update:model-value="toggleAll"
              />
            </div>
          </th>
          <th
            v-for="col in shownColumns"
            :key="col.key"
            :style="headStyle(col)"
            class="px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
            :class="[alignClass(col.align), cellY, col.pin ? PIN_HEAD : '', canResize(col) && !col.pin ? 'relative' : '']"
            :data-lp-col="measuredCol(col)"
            :aria-sort="
              sortOf(col)
                ? sortOf(col)!.dir === 'asc'
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
              class="group/sort -mx-1 inline-flex items-center gap-1 rounded-small px-1 uppercase outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              :class="[
                col.align === 'right' ? 'flex-row-reverse' : '',
                sortOf(col) ? 'text-ink' : '',
              ]"
              @click="toggleSort(col, $event)"
            >
              {{ col.label }}
              <LpIcon
                v-if="col.sortable"
                :name="sortIcon(col)"
                :size="13"
                class="shrink-0 transition-[transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)]"
                :class="
                  sortOf(col)
                    ? 'opacity-100'
                    : 'opacity-40 group-hover/sort:opacity-70'
                "
              />
              <span v-if="sortPosition(col)" class="tabular-nums text-brand">{{ sortPosition(col) }}</span>
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
                  class="ml-0.5 inline-grid size-5 place-items-center rounded-small align-middle outline-none transition-colors duration-fast hover:bg-surface-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                  :class="hiddenValues[col.key]?.size ? 'text-brand' : 'opacity-60'"
                  :aria-label="text.filterColumn.replace('{column}', col.label)"
                  :data-lp-filter="col.key"
                >
                  <LpIcon :name="hiddenValues[col.key]?.size ? 'lucide:filter-x' : 'lucide:filter'" :size="12" />
                </button>
              </template>
              <LpTableFilter
                :options="facetOptions.get(col.key)?.value ?? []"
                :hidden="hiddenValues[col.key] ?? new Set()"
                :labels="filterLabels()"
                @update:hidden="(next) => setHidden(col.key, next)"
              />
            </LpPopover>
            <span
              v-if="canResize(col)"
              role="separator"
              aria-orientation="vertical"
              tabindex="0"
              :aria-label="text.resizeColumn.replace('{column}', col.label)"
              :aria-valuenow="widths[col.key]"
              class="absolute inset-y-0 right-0 w-1.5 cursor-col-resize touch-none outline-none transition-colors duration-fast hover:bg-brand focus-visible:bg-brand"
              :data-lp-resize="col.key"
              @pointerdown="startResize($event, col)"
              @click.stop
              @dblclick.stop="clearWidth(col)"
              @keydown="onResizeKey($event, col)"
            />
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
        :css="animating && !virtualRowHeight && !bigSwap"
        :move-class="bigSwap ? 'lp-row-still' : undefined"
        :class="busy && displayRows.length ? 'opacity-60 transition-opacity' : 'transition-opacity'"
        :aria-busy="busy || undefined"
        :ref="setRowsEl"
      >
        <!-- The first page on its way: rows in the shape of the columns rather
             than a spinner in an empty box, so the table already has its height
             and its columns when the data lands, and nothing below it moves.
             The bars share LpSkeleton's pulse; the cells keep the real padding
             and alignment. -->
        <template v-if="displayRows.length === 0 && busy">
          <tr
            v-for="n in skeletonRows"
            :key="`lp-table-skeleton-${n}`"
            class="lp-row-empty border-b border-line/60 last:border-0"
          >
            <td v-if="expansionOn" class="w-px p-0" :class="cellY" />
            <td v-if="selectable" class="w-px p-0" :class="cellY" />
            <td
              v-for="(col, ci) in shownColumns"
              :key="col.key"
              class="px-4"
              :class="[alignClass(col.align), cellY]"
            >
              <LpSkeleton
                class="inline-block h-3 align-middle"
                :style="{ width: skeletonWidth(n, ci) }"
              />
              <span v-if="n === 1 && ci === 0" class="sr-only">{{ text.loading }}</span>
            </td>
          </tr>
        </template>
        <tr v-else-if="displayRows.length === 0" key="lp-table-empty" class="lp-row-empty">
          <td :colspan="colSpan" class="p-0">
            <LpEmptyState
              compact
              :icon="failed ? 'lucide:circle-alert' : filteredOut ? 'lucide:filter-x' : emptyIcon"
              :title="failed ? text.error : filteredOut ? text.noMatches : text.empty"
            >
              <LpButton v-if="filteredOut" variant="outline" size="sm" @click="resetFilters">
                {{ text.resetFilters }}
              </LpButton>
            </LpEmptyState>
          </td>
        </tr>
        <!-- A plain <tr>, because TransitionGroup animates element children and
             nothing else. The right-click menu is the table's one menu, told
             which row the event came from — see `contextMenu`. -->
        <tr v-if="rowWindowed?.before" key="lp-virtual-before" aria-hidden="true">
          <td :colspan="colSpan" class="p-0" :style="{ height: `${rowWindowed.before}px` }" />
        </tr>
        <!-- One keyed fragment per entry: TransitionGroup reads through it to
             the row, so the rows animate as they always did. -->
        <template v-for="entry in viewEntries" :key="entry.id">
          <tr v-if="entry.kind === 'group'" class="border-b border-line/60 bg-surface-soft/60" :style="rowStyle">
            <td :colspan="colSpan" class="px-4 text-xs font-medium text-muted" :class="cellY">
              <slot name="group" :value="entry.value" :rows="entry.rows" :label="entry.label" :collapsed="entry.collapsed" :toggle="() => toggleGroup(entry.group)">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-small outline-none transition-colors duration-fast hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                  :aria-expanded="!entry.collapsed"
                  :aria-label="(entry.collapsed ? text.expandGroup : text.collapseGroup).replace('{label}', entry.label)"
                  @click="toggleGroup(entry.group)"
                >
                  <LpIcon name="lucide:chevron-right" :size="14" class="transition-transform duration-fast motion-reduce:transition-none" :class="entry.collapsed ? '' : 'rotate-90'" />
                  {{ entry.label }}
                </button>
              </slot>
            </td>
          </tr>
          <tr v-else-if="entry.kind === 'detail'" class="border-b border-line/60 last:border-0" data-lp-row-detail>
            <td :colspan="colSpan" class="px-4 py-3">
              <slot name="expanded" :row="entry.row" :close="() => toggleExpanded(keyFor(entry.row, entry.index))" />
            </td>
          </tr>
          <!-- A plain <tr>, because TransitionGroup animates element children and
               nothing else. The right-click menu is the table's one menu, told
               which row the event came from — see `contextMenu`. -->
          <tr
            v-else
            @contextmenu="onRowContextMenu(entry.row)"
            class="group border-b border-line/60 outline-none transition-colors last:border-0 hover:bg-surface-soft/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[active]:bg-surface-soft/40"
            :class="isSelected(keyFor(entry.row, entry.index)) ? 'bg-brand-soft/40' : ''"
            :style="rowStyle"
            :aria-rowindex="virtualRowHeight ? rowOffset(entry) : undefined"
            v-bind="roving.itemProps(String(keyFor(entry.row, entry.index)))"
            :data-paint-key="selectable ? String(keyFor(entry.row, entry.index)) : undefined"
            :data-lp-context-row="rowMenu ? '' : undefined"
            @click="onRowClick(entry.row, keyFor(entry.row, entry.index))"
            @pointerdown="onRowPointerDown($event, keyFor(entry.row, entry.index))"
            @keydown="onRowKeydown"
          >
            <td v-if="expansionOn" class="w-px p-0 text-center" :class="cellY" @click.stop @keydown.stop>
              <button
                v-if="canExpand(entry.row)"
                type="button"
                class="inline-grid size-6 place-items-center rounded-small text-muted outline-none transition-colors duration-fast hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
                :aria-expanded="expandedKeys.has(keyFor(entry.row, entry.index))"
                :aria-label="expandedKeys.has(keyFor(entry.row, entry.index)) ? text.collapseRow : text.expandRow"
                @click="toggleExpanded(keyFor(entry.row, entry.index))"
              >
                <LpIcon name="lucide:chevron-right" :size="14" class="transition-transform duration-fast motion-reduce:transition-none" :class="expandedKeys.has(keyFor(entry.row, entry.index)) ? 'rotate-90' : ''" />
              </button>
            </td>
            <td
              v-if="selectable"
              class="w-px cursor-pointer p-0 select-none"
              :class="cellY"
              @click.stop
              @pointerdown.stop="paint.onPointerDown($event, keyFor(entry.row, entry.index))"
            >
              <div class="lp-tick lp-tick-open" :class="ticksShown ? '' : 'lp-tick-cue'">
                <LpCheckbox
                  :model-value="isSelected(keyFor(entry.row, entry.index))"
                  @update:model-value="(v) => toggleRow(keyFor(entry.row, entry.index), v)"
                />
              </div>
            </td>
            <td
              v-for="col in shownColumns"
              :key="col.key"
              class="px-4 text-ink"
              :class="[alignClass(col.align), cellY, col.nowrap ? 'whitespace-nowrap' : '', col.pin ? PIN_CELL : '']"
              :style="pinStyle(col)"
            >
              <slot :name="`cell-${col.key}`" :row="entry.row" :value="entry.row[col.key]" :open-menu="openRowMenu">
                <!-- The field is its own world: its clicks and keys are not the row's. -->
                <span v-if="isEditable(col, entry.row)" class="inline-block" @click.stop @pointerdown.stop @keydown.stop>
                  <LpEditable
                    :model-value="String(entry.row[col.key] ?? '')"
                    :label="col.label"
                    size="sm"
                    :validate="(value) => col.validateEdit?.(value, entry.row)"
                    :save="(value) => saveCell(col, entry.row, value)"
                  />
                </span>
                <template v-else>{{ entry.row[col.key] }}</template>
              </slot>
            </td>
          </tr>
        </template>
        <tr v-if="rowWindowed?.after" key="lp-virtual-after" aria-hidden="true">
          <td :colspan="colSpan" class="p-0" :style="{ height: `${rowWindowed.after}px` }" />
        </tr>
      </TransitionGroup>
    </table>
    </LpContextMenu>
  </LpScrollArea>
  <!-- Cards and list: the same rows, menu, selection and keyboard, drawn
       without a header. The one menu wraps the lot, as it does the table. -->
  <LpContextMenu
    v-else
    :items="contextMenu"
    always
    :no-hint="!rowMenu"
    :title="menuHead?.title"
    :subtitle="menuHead?.subtitle"
    :title-icon="menuHead?.icon"
    :title-image="menuHead?.image"
  >
    <TransitionGroup
      :key="activeLayout"
      tag="div"
      name="lp-row"
      :css="animating && !bigSwap"
      :move-class="bigSwap ? 'lp-row-still' : undefined"
      v-bind="scrollAttrs"
      class="min-h-0 transition-opacity"
      :class="[
        busy && displayRows.length ? 'opacity-60' : '',
        activeLayout === 'cards'
          ? 'grid gap-3'
          : variant === 'framed' ? 'overflow-hidden rounded-card border border-line bg-surface' : '',
      ]"
      :style="activeLayout === 'cards' ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardWidth}, 100%), 1fr))` } : undefined"
      :aria-busy="busy || undefined"
      :ref="setRowsEl"
    >
      <template v-if="displayRows.length === 0 && busy">
        <div
          v-for="n in skeletonRows"
          :key="`lp-table-skeleton-${n}`"
          class="lp-row-empty"
          :class="activeLayout === 'cards' ? 'flex flex-col gap-3 rounded-card border border-line bg-surface p-4' : ['flex flex-col gap-2 border-b border-line/60 px-4 last:border-0', cellY]"
        >
          <LpSkeleton class="h-3.5" :style="{ width: skeletonWidth(n, 0) }" />
          <LpSkeleton class="h-3" :style="{ width: skeletonWidth(n, 1) }" />
          <LpSkeleton v-if="activeLayout === 'cards'" class="h-3" :style="{ width: skeletonWidth(n, 2) }" />
          <span v-if="n === 1" class="sr-only">{{ text.loading }}</span>
        </div>
      </template>
      <div
        v-else-if="displayRows.length === 0"
        key="lp-table-empty"
        class="lp-row-empty"
        :class="activeLayout === 'cards' ? 'col-span-full rounded-card border border-line bg-surface' : ''"
      >
        <LpEmptyState
          compact
          :icon="failed ? 'lucide:circle-alert' : filteredOut ? 'lucide:filter-x' : emptyIcon"
          :title="failed ? text.error : filteredOut ? text.noMatches : text.empty"
        >
          <LpButton v-if="filteredOut" variant="outline" size="sm" @click="resetFilters">
            {{ text.resetFilters }}
          </LpButton>
        </LpEmptyState>
      </div>
      <template v-for="entry in allEntries" :key="entry.id">
        <div
          v-if="entry.kind === 'group'"
          class="text-xs font-medium text-muted"
          :class="activeLayout === 'cards' ? 'col-span-full pt-2' : ['border-b border-line/60 bg-surface-soft/60 px-4', cellY]"
        >
          <slot name="group" :value="entry.value" :rows="entry.rows" :label="entry.label" :collapsed="entry.collapsed" :toggle="() => toggleGroup(entry.group)">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-small outline-none transition-colors duration-fast hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              :aria-expanded="!entry.collapsed"
              :aria-label="(entry.collapsed ? text.expandGroup : text.collapseGroup).replace('{label}', entry.label)"
              @click="toggleGroup(entry.group)"
            >
              <LpIcon name="lucide:chevron-right" :size="14" class="transition-transform duration-fast motion-reduce:transition-none" :class="entry.collapsed ? '' : 'rotate-90'" />
              {{ entry.label }}
            </button>
          </slot>
        </div>
        <div
          v-else-if="entry.kind === 'detail'"
          class="px-4 py-3"
          :class="activeLayout === 'cards' ? 'col-span-full' : 'border-b border-line/60 last:border-0'"
          data-lp-row-detail
        >
          <slot name="expanded" :row="entry.row" :close="() => toggleExpanded(keyFor(entry.row, entry.index))" />
        </div>
        <div
          v-else
          class="lp-item group relative outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="[
            activeLayout === 'cards'
              ? ['flex min-w-0 flex-col overflow-hidden rounded-card border bg-surface hover:border-line-strong focus-visible:ring-offset-0', isSelected(keyFor(entry.row, entry.index)) ? 'border-brand bg-brand-soft/30' : 'border-line']
              : ['flex min-w-0 items-center gap-3 border-b border-line/60 px-4 last:border-0 hover:bg-surface-soft/60 focus-visible:ring-inset data-[active]:bg-surface-soft/40', cellY, isSelected(keyFor(entry.row, entry.index)) ? 'bg-brand-soft/40' : ''],
          ]"
          v-bind="roving.itemProps(String(keyFor(entry.row, entry.index)))"
          :data-paint-key="selectable ? String(keyFor(entry.row, entry.index)) : undefined"
          :data-lp-context-row="rowMenu ? '' : undefined"
          @contextmenu="onRowContextMenu(entry.row)"
          @click="onRowClick(entry.row, keyFor(entry.row, entry.index))"
          @pointerdown="onRowPointerDown($event, keyFor(entry.row, entry.index))"
          @keydown="onRowKeydown"
        >
          <div
            v-if="selectable"
            class="cursor-pointer select-none"
            :class="activeLayout === 'cards' ? 'absolute top-2 right-2 z-[1]' : ['shrink-0 transition-[margin] duration-medium ease-[var(--ease-emphasized)] motion-reduce:transition-none', ticksShown ? '' : '-mr-3']"
            @click.stop
            @pointerdown.stop="paint.onPointerDown($event, keyFor(entry.row, entry.index))"
          >
            <div
              class="lp-tick"
              :class="activeLayout === 'cards' ? 'lp-tick-card' : ticksShown ? 'lp-tick-line' : ''"
              :data-cue="activeLayout === 'cards' && !ticksShown ? '' : undefined"
              :inert="activeLayout !== 'cards' && !ticksShown"
            >
              <LpCheckbox
                :model-value="isSelected(keyFor(entry.row, entry.index))"
                @update:model-value="(v) => toggleRow(keyFor(entry.row, entry.index), v)"
              />
            </div>
          </div>
          <!-- `#card` draws the inside of a card; the frame, selection, focus
               and menu stay the table's, so every card answers alike. Without
               it the card is built from the columns and their cell slots: the
               first column names the row, the rest are its facts. -->
          <slot
            v-if="activeLayout === 'cards'"
            name="card"
            :row="entry.row"
            :selected="isSelected(keyFor(entry.row, entry.index))"
            :toggle="() => toggleRow(keyFor(entry.row, entry.index), !isSelected(keyFor(entry.row, entry.index)))"
            :open-menu="openRowMenu"
          >
            <div class="flex min-w-0 flex-col gap-2 p-4">
              <div v-if="titleColumn" class="min-w-0 truncate pr-6 font-medium text-ink">
                <slot :name="`cell-${titleColumn.key}`" :row="entry.row" :value="entry.row[titleColumn.key]" :open-menu="openRowMenu">{{ entry.row[titleColumn.key] }}</slot>
              </div>
              <dl v-if="fieldColumns.length" class="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 text-sm">
                <template v-for="col in fieldColumns" :key="col.key">
                  <dt class="text-xs text-muted">{{ col.label }}</dt>
                  <dd class="min-w-0 truncate text-ink">
                    <slot :name="`cell-${col.key}`" :row="entry.row" :value="entry.row[col.key]" :open-menu="openRowMenu">{{ entry.row[col.key] }}</slot>
                  </dd>
                </template>
              </dl>
            </div>
          </slot>
          <!-- `#line` is to a list line what `#card` is to a card: the inside
               only. Without it the line is built from the columns: the first
               names the row, the rest follow it in one muted line, which
               reads well for words and badly for meters or several badges. -->
          <div v-else class="min-w-0 flex-1">
            <slot
              name="line"
              :row="entry.row"
              :selected="isSelected(keyFor(entry.row, entry.index))"
              :toggle="() => toggleRow(keyFor(entry.row, entry.index), !isSelected(keyFor(entry.row, entry.index)))"
              :open-menu="openRowMenu"
            >
              <div v-if="titleColumn" class="min-w-0 truncate font-medium text-ink">
                <slot :name="`cell-${titleColumn.key}`" :row="entry.row" :value="entry.row[titleColumn.key]" :open-menu="openRowMenu">{{ entry.row[titleColumn.key] }}</slot>
              </div>
              <!-- Separators belong between the facts that are there: a cell
                   that drew nothing takes no dot, and the dot that would open
                   a wrapped line is clipped off (the inner row starts one
                   separator to the left of the clip box). -->
              <div v-if="lineColumns.length" class="lp-line min-w-0 overflow-hidden text-xs text-muted">
                <div class="lp-line-row flex flex-wrap items-center gap-y-0.5">
                  <template v-for="col in lineColumns" :key="col.key">
                  <span v-if="lineMode(col, entry.row) !== false" class="lp-line-field min-w-0 truncate" :title="col.label">
                    <span v-if="lineMode(col, entry.row) === 'label'" class="lp-line-label">{{ `${col.label} ` }}</span>
                    <span class="lp-line-value"><slot :name="`cell-${col.key}`" :row="entry.row" :value="entry.row[col.key]" :open-menu="openRowMenu">{{ entry.row[col.key] }}</slot></span>
                  </span>
                  </template>
                </div>
              </div>
            </slot>
          </div>
          <!-- The table's chevron, in a line and a card too: without it an
               expandable row drew its detail panel but nothing opened it. -->
          <button
            v-if="expansionOn && canExpand(entry.row)"
            type="button"
            class="inline-grid size-6 shrink-0 place-items-center rounded-small text-muted outline-none transition-colors duration-fast hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            :class="activeLayout === 'cards' ? 'absolute right-2 bottom-2' : ''"
            :aria-expanded="expandedKeys.has(keyFor(entry.row, entry.index))"
            :aria-label="expandedKeys.has(keyFor(entry.row, entry.index)) ? text.collapseRow : text.expandRow"
            @click.stop="toggleExpanded(keyFor(entry.row, entry.index))"
            @pointerdown.stop
          >
            <LpIcon name="lucide:chevron-right" :size="14" class="transition-transform duration-fast motion-reduce:transition-none" :class="expandedKeys.has(keyFor(entry.row, entry.index)) ? 'rotate-90' : ''" />
          </button>
        </div>
      </template>
    </TransitionGroup>
  </LpContextMenu>
  </LpShift>
  <LpPagination
    v-if="load && total > pageSize"
    v-model:page="page"
    :total="total"
    :page-size="pageSize"
    :disabled="busy"
  />
  </div>
</template>

<style scoped>
/*
 * A list line's facts, one dot between each two that are there. Every field
 * carries its own dot before it; the row sits one dot to the left inside a
 * box that clips, so the dot opening the line, or any wrapped line, falls
 * outside and only the dots between facts are seen. A cell whose slot drew
 * nothing (a v-if that failed, an empty value) is left out, dot and all.
 */
.lp-line {
  --lp-line-sep: 1rem;
}

.lp-line-row {
  margin-left: calc(-1 * var(--lp-line-sep));
}

/* The dot lives in the field's own left padding, so whatever the cell draws,
   a word or a block of two lines, starts after it and never in the clipped
   strip. */
.lp-line-field {
  position: relative;
  padding-left: var(--lp-line-sep);
}

.lp-line-field::before {
  content: "·" / "";
  position: absolute;
  left: 0;
  width: var(--lp-line-sep);
  text-align: center;
}

.lp-line-field:has(> .lp-line-value:empty) {
  display: none;
}

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

/*
 * A change too big to animate row by row (see ROW_MOTION_LIMIT): the rows
 * land at once and the body comes up from half-faded as one. `lp-row-still`
 * is the move class then, and has no transition on purpose: TransitionGroup
 * checks the move class for one before it measures the rows, and skips the
 * measuring when there is none.
 */
[data-lp-settle="a"] {
  animation: lp-rows-settle-a var(--duration-fast) var(--ease-emphasized);
}
[data-lp-settle="b"] {
  animation: lp-rows-settle-b var(--duration-fast) var(--ease-emphasized);
}
@keyframes lp-rows-settle-a {
  from {
    opacity: 0.4;
  }
}
@keyframes lp-rows-settle-b {
  from {
    opacity: 0.4;
  }
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

  /* Nor is there anything for the column's width to hold until then: on a
     touch screen it stays closed until a long press starts selecting, and
     eases open like the rest of the column. */
  .lp-tick-hidden,
  .lp-tick-cue {
    max-width: 0;
    padding-inline: 0;
  }
}

/*
 * A list line's tick opens from nothing, as the table's column does, so lines
 * do not carry an empty gap until selection starts.
 */
.lp-tick-line {
  max-width: 2rem;
  opacity: 1;
}

/*
 * A card's tick sits in its corner at its own size, with no column to hold
 * open; a cue shows it only while
 * the card is pointed at or holds focus, the same rule as a row's.
 */
.lp-tick-card {
  max-width: none;
  padding-inline: 0;
  opacity: 1;
}

.lp-tick[data-cue] {
  opacity: 0;
}

.lp-item:hover .lp-tick[data-cue],
.lp-tick[data-cue]:focus-within {
  opacity: 1;
}

@media (hover: none) {
  .lp-item:hover .lp-tick[data-cue] {
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
  [data-lp-settle] {
    animation: none;
  }
}
</style>
