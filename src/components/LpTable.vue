<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import LpCheckbox from "./LpCheckbox.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"
import { useRovingFocus } from "../composables/useRovingFocus"

export interface TableColumn<Row> {
  key: string
  label: string
  align?: "left" | "right" | "center"
  width?: string
  /** Allow clicking the header to sort by this column. */
  sortable?: boolean
}

export interface SortState {
  key: string
  dir: "asc" | "desc"
}

type RowKey = string | number

const props = withDefaults(
  defineProps<{
    columns: TableColumn<T>[]
    rows: T[]
    /** Stable id per row — required for selection; falls back to index otherwise. */
    rowKey?: keyof T | ((row: T) => RowKey)
    emptyLabel?: string
    emptyIcon?: string
    /** Render a leading checkbox column; selection binds via v-model:selected. */
    selectable?: boolean
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
  }>(),
  {
    emptyLabel: "Nothing here yet",
    emptyIcon: "lucide:inbox",
    selectable: false,
    selected: () => [],
    sort: null,
  },
)

const emit = defineEmits<{
  (e: "update:selected", value: RowKey[]): void
  (e: "update:sort", value: SortState | null): void
  (e: "rowClick", row: T): void
}>()

function keyFor(row: T, index: number): RowKey {
  if (typeof props.rowKey === "function") return props.rowKey(row)
  if (props.rowKey) return row[props.rowKey] as RowKey
  return index
}

function alignClass(align?: "left" | "right" | "center"): string {
  if (align === "right") return "text-right"
  if (align === "center") return "text-center"
  return "text-left"
}

// Resolved right-click menu for a row, or [] when none — keeps the template
// branch simple and avoids calling rowMenu twice per row.
function menuFor(row: T): ContextMenuItemDef[] {
  return props.rowMenu?.(row) ?? []
}

// ── sorting ──────────────────────────────────────────────────
// Client-side sort is applied only when the parent doesn't drive `sort` via
// v-model (server-side). We compare by raw cell value with a stable-ish coerce.
const displayRows = computed<T[]>(() => {
  const s = props.sort
  if (!s) return props.rows
  const col = props.columns.find((c) => c.key === s.key)
  if (!col?.sortable) return props.rows
  const factor = s.dir === "asc" ? 1 : -1
  return [...props.rows].sort((a, b) => compare(a[s.key], b[s.key]) * factor)
})

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

function toggleSort(col: TableColumn<T>) {
  if (!col.sortable) return
  const s = props.sort
  // Cycle: none → asc → desc → none, scoped to the clicked column.
  let next: SortState | null
  if (!s || s.key !== col.key) next = { key: col.key, dir: "asc" }
  else if (s.dir === "asc") next = { key: col.key, dir: "desc" }
  else next = null
  emit("update:sort", next)
}

function sortIcon(col: TableColumn<T>): string {
  if (props.sort?.key !== col.key) return "lucide:chevrons-up-down"
  return props.sort.dir === "asc" ? "lucide:arrow-up" : "lucide:arrow-down"
}

// ── selection ────────────────────────────────────────────────
const selectedSet = computed(() => new Set(props.selected))
const allKeys = computed(() => props.rows.map((r, i) => keyFor(r, i)))
const allChecked = computed(
  () => allKeys.value.length > 0 && allKeys.value.every((k) => selectedSet.value.has(k)),
)
const someChecked = computed(
  () => !allChecked.value && allKeys.value.some((k) => selectedSet.value.has(k)),
)

function toggleAll(checked: boolean) {
  emit("update:selected", checked ? [...allKeys.value] : [])
}

function toggleRow(key: RowKey, checked: boolean) {
  const next = new Set(selectedSet.value)
  if (checked) next.add(key)
  else next.delete(key)
  emit("update:selected", [...next])
}

const colSpan = computed(() => props.columns.length + (props.selectable ? 1 : 0))

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
onBeforeUnmount(() => ro?.disconnect())

const barInsetTop = computed(() =>
  props.stickyHeader && headHeight.value ? `${headHeight.value}px` : undefined,
)
</script>

<template>
  <!-- No top fade: a sticky header sits in the masked band and would be dimmed
       by it. The bottom edge is left crisp with it for symmetry. -->
  <LpScrollArea
    :fade="false"
    class="rounded-card border border-line"
    :bar-inset-top="barInsetTop"
  >
    <table class="w-full border-collapse text-sm">
      <thead ref="headEl" :class="stickyHeader ? 'sticky top-0 z-10' : ''">
        <tr class="border-b border-line bg-surface-soft">
          <th v-if="selectable" class="w-px px-4 py-3">
            <LpCheckbox
              :model-value="allChecked"
              :indeterminate="someChecked"
              @update:model-value="toggleAll"
            />
          </th>
          <th
            v-for="col in columns"
            :key="col.key"
            :style="col.width ? { width: col.width } : undefined"
            class="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
            :class="alignClass(col.align)"
            :aria-sort="
              sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
            "
          >
            <button
              v-if="col.sortable"
              type="button"
              class="group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              :class="[
                col.align === 'right' ? 'flex-row-reverse' : '',
                sort?.key === col.key ? 'text-ink' : '',
              ]"
              @click="toggleSort(col)"
            >
              {{ col.label }}
              <LpIcon
                :name="sortIcon(col)"
                :size="13"
                class="shrink-0 transition-[transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)]"
                :class="sort?.key === col.key ? 'opacity-100' : 'opacity-40 group-hover/sort:opacity-70'"
              />
            </button>
            <template v-else>{{ col.label }}</template>
          </th>
        </tr>
      </thead>
      <!-- The keydown lives on the rows, not here: only a focused row should
           steer, and a stray key from a control inside a cell must not move the
           cursor. The container is bound only so the composable can find rows
           to focus. -->
      <tbody :ref="(el) => roving.setContainer(el as HTMLElement | null)">
        <tr v-if="displayRows.length === 0">
          <td :colspan="colSpan" class="px-4 py-10 text-center text-muted">
            <LpIcon :name="emptyIcon" :size="22" class="mx-auto mb-2 opacity-60" />
            <div>{{ emptyLabel }}</div>
          </td>
        </tr>
        <!-- Each row is wrapped in a right-click menu; with no rowMenu (or an
             empty result) LpContextMenu is a passthrough and the row keeps the
             browser's native menu. It renders via as-child, so the DOM stays a
             bare <tr> either way. -->
        <LpContextMenu
          v-for="(row, index) in displayRows"
          :key="keyFor(row, index)"
          :items="menuFor(row)"
        >
          <tr
            class="border-b border-line/60 outline-none transition-colors last:border-0 hover:bg-surface-soft/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[active]:bg-surface-soft/40"
            :class="selectedSet.has(keyFor(row, index)) ? 'bg-brand-soft/40' : ''"
            v-bind="roving.itemProps(String(keyFor(row, index)))"
            @click="emit('rowClick', row)"
            @keydown="onRowKeydown"
          >
            <td v-if="selectable" class="w-px px-4 py-3" @click.stop>
              <LpCheckbox
                :model-value="selectedSet.has(keyFor(row, index))"
                @update:model-value="(v) => toggleRow(keyFor(row, index), v)"
              />
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3 text-ink"
              :class="alignClass(col.align)"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </LpContextMenu>
      </tbody>
    </table>
  </LpScrollArea>
</template>
