<script setup lang="ts">
import { computed, ref } from "vue"
import { LpTable } from "../../src"
import type { SortState, TableCellEdit, TableColumn, TablePage, TableQuery, TableSelectionToken } from "../../src"

type Row = Record<string, unknown> & { id: number; name: string; site: string; load: number }

const part = new URLSearchParams(location.search).get("part")

const base: Row[] = [
  { id: 1, name: "alpha", site: "b", load: 2 },
  { id: 2, name: "beta", site: "a", load: 2 },
  { id: 3, name: "gamma", site: "b", load: 1 },
]
const columns: TableColumn<Row>[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "site", label: "Site", sortable: true },
  { key: "load", label: "Load", sortable: true },
]

const shrinkFilters = ref<Record<string, unknown[]>>({})
const filterColumns: TableColumn<Row>[] = columns.map((col) => (col.key === "site" ? { ...col, filterable: true } : col))

const sorts = ref<SortState[]>([])
const sortsText = computed(() => sorts.value.map((s) => `${s.key}:${s.dir}`).join(","))

const widths = ref<Record<string, number>>({})

const wide = Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, label: `Col ${i}`, width: "200px", nowrap: true }))
const pinned: TableColumn<Row>[] = [
  { key: "name", label: "Name", pin: "left", width: "120px" },
  ...wide,
  { key: "id", label: "Id", pin: "right", width: "80px" },
]

const wideRows = base.map((row) => ({ ...row, ...Object.fromEntries(wide.map((col) => [col.key, "a long value that will not wrap"])) }))

const many: Row[] = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `row ${i}`, site: "x", load: i }))

const edits = ref<TableCellEdit<Row>[]>([])
const editable = ref(base.map((row) => ({ ...row })))
const editColumns: TableColumn<Row>[] = [
  {
    key: "name",
    label: "Name",
    editable: true,
    validateEdit: (value) => (value.length > 1 ? true : "Too short"),
  },
  { key: "load", label: "Load", editable: (row) => row.id !== 1, parseEdit: (value) => Number(value) },
]
function onEdit(edit: TableCellEdit<Row>) {
  edits.value.push(edit)
  edit.row[edit.key] = edit.value
}

const preset = ref<string | null>("short")
const presets = [
  { id: "short", label: "Short", columns: ["name"] },
  { id: "all", label: "Everything", columns: ["name", "site", "load"] },
]

const PAGE = 2
const remote = Array.from({ length: 6 }, (_, i) => ({ id: i, name: `srv ${i}`, site: "x", load: i }))
const load = (query: TableQuery): TablePage<Row> => ({
  rows: remote.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
  total: remote.length,
})
const selected = ref<(string | number)[]>([])

const layout = ref<"table" | "cards" | "list">("cards")
const layoutColumns: TableColumn<Row>[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "site", label: "Site", sortable: true, filterable: true },
  { key: "load", label: "Load", sortable: true },
]
const layoutPicks = ref<(string | number)[]>([])
const clicked = ref("")
const rowMenu = (row: Row) => [{ label: `Open ${row.name}`, onSelect: () => (clicked.value = `menu:${row.name}`) }]
const all = ref(false)
const token = ref<TableSelectionToken | null>(null)
</script>

<template>
  <main class="mx-auto flex max-w-xl flex-col gap-4 p-6">
    <template v-if="part === 'sort'">
      <LpTable v-model:sorts="sorts" :columns="columns" :rows="base" row-key="id" multi-sort aria-label="Sorted" />
      <output aria-label="Sorts">{{ sortsText }}</output>
    </template>
    <template v-else-if="part === 'resize'">
      <LpTable v-model:column-widths="widths" :columns="columns" :rows="base" row-key="id" resizable-columns aria-label="Resized" />
      <output aria-label="Widths">{{ JSON.stringify(widths) }}</output>
    </template>
    <LpTable v-else-if="part === 'pin'" :columns="pinned" :rows="wideRows" row-key="id" aria-label="Pinned" />
    <LpTable v-else-if="part === 'group'" :columns="columns" :rows="base" row-key="id" group-by="site" aria-label="Grouped" />
    <div v-else-if="part === 'shrink'">
      <button type="button" @click="shrinkFilters = { site: ['b'] }">Hide site b</button>
      <LpTable v-model:filters="shrinkFilters" :columns="filterColumns" :rows="base" row-key="id" aria-label="Shrinking" />
    </div>
    <LpTable v-else-if="part === 'toolbar'" :columns="columns" :rows="base" row-key="id" exportable summary aria-label="With toolbar">
      <template #toolbar><input aria-label="Page search" placeholder="search"></template>
    </LpTable>
    <LpTable v-else-if="part === 'expand'" :columns="columns" :rows="base" row-key="id" :expandable="(row) => row.id !== 2" aria-label="Expanding">
      <template #expanded="{ row }"><p>Details of {{ row.name }}</p></template>
    </LpTable>
    <LpTable
      v-else-if="part === 'virtual'"
      :columns="columns"
      :rows="many"
      row-key="id"
      :virtual-row-height="44"
      sticky-header
      style="max-height: 300px"
      aria-label="Virtual"
    />
    <template v-else-if="part === 'edit'">
      <LpTable :columns="editColumns" :rows="editable" row-key="id" aria-label="Editing" @cell-edit="onEdit" />
      <output aria-label="Edits">{{ edits.map((e) => `${e.key}:${e.previous}>${e.value}`).join(",") }}</output>
    </template>
    <template v-else-if="part === 'presets'">
      <LpTable v-model:column-preset="preset" :columns="columns" :rows="base" row-key="id" :column-presets="presets" aria-label="Presets" />
      <output aria-label="Preset">{{ preset }}</output>
    </template>
    <template v-else-if="part === 'layouts'">
      <LpTable
        v-model:layout="layout"
        v-model:selected="layoutPicks"
        :columns="layoutColumns"
        :rows="base"
        row-key="id"
        :layouts="['table', 'cards', 'list']"
        :row-menu="rowMenu"
        selectable
        persist="layouts-test"
        aria-label="Layouts"
        @row-click="(row) => (clicked = `click:${row.name}`)"
      >
        <template #cell-load="{ value }"><b>load {{ value }}</b></template>
      </LpTable>
      <output aria-label="Layout">{{ layout }}</output>
      <output aria-label="Clicked">{{ clicked }}</output>
      <output aria-label="Picked">{{ layoutPicks.join(",") }}</output>
    </template>
    <div v-else-if="part === 'narrow'" style="width: 360px">
      <LpTable :columns="layoutColumns" :rows="base" row-key="id" :layout-below="480" aria-label="Narrow" />
    </div>
    <template v-else-if="part === 'hold-list'">
      <LpTable v-model:selected="layoutPicks" :columns="layoutColumns" :rows="base" row-key="id" layout="list" selectable="hold" aria-label="Hold list" />
      <output aria-label="Picked">{{ layoutPicks.join(",") }}</output>
    </template>
    <template v-else-if="part === 'own-card'">
      <LpTable :columns="layoutColumns" :rows="base" row-key="id" layout="cards" :row-menu="rowMenu" aria-label="Own cards" @row-click="(row) => (clicked = `click:${row.name}`)">
        <template #card="{ row }"><div class="own-card" style="background: rgb(1, 2, 3); height: 40px">{{ row.name }} on {{ row.site }}</div></template>
      </LpTable>
      <output aria-label="Clicked">{{ clicked }}</output>
    </template>
    <LpTable v-else-if="part === 'plain'" :columns="layoutColumns" :rows="base" row-key="id" variant="plain" aria-label="Plain" />
    <template v-else-if="part === 'token'">
      <LpTable
        v-model:selected="selected"
        v-model:all-matching="all"
        :columns="columns"
        :load="load"
        :page-size="PAGE"
        :debounce="0"
        row-key="id"
        selectable
        selection-token
        aria-label="Token"
        @update:selection-token="token = $event"
      />
      <output aria-label="Token">{{ token ? `${token.total}-${token.excluded.join("|")}` : "none" }}</output>
    </template>
  </main>
</template>
