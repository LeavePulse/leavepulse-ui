<script setup lang="ts">
import { computed, ref } from "vue"
import { LpBadge, LpIcon, LpLink, LpPageScrollbar, LpTable, LpTooltip } from "../../src"
import type { TableColumn } from "../../src"

/*
 * A services list as an app draws one: sixty rows, each with three tooltips
 * (a status badge, an icon, a "+N" count) and a link. A filter outside the
 * table cuts it to ten rows and back, which is the swap measured in
 * tablePerf.pw.ts. `?via=filter` makes the same cut through the table's own
 * column filter instead, the path that turns the row motion on, and "Hide
 * core" is a small change through it.
 */
type Row = Record<string, unknown> & { id: number; name: string; kind: string; status: string; hosts: number }

const via = new URLSearchParams(location.search).get("via") ?? "rows"
const STATUSES = ["running", "degraded", "stopped"] as const
const all: Row[] = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  name: `service-${String(i + 1).padStart(2, "0")}`,
  kind: i % 6 === 0 ? "core" : "app",
  status: STATUSES[i % 3]!,
  hosts: 1 + (i % 4),
}))

const columns: TableColumn<Row>[] = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Kind", filterable: via === "filter" },
  { key: "status", label: "Status" },
  { key: "autopilot", label: "Autopilot" },
  { key: "hosts", label: "Hosts" },
]

const narrow = ref(false)
const filters = ref<Record<string, unknown[]>>({})
const rows = computed(() => (via === "rows" && narrow.value ? all.filter((row) => row.kind === "core") : all))

function toggle() {
  narrow.value = !narrow.value
  if (via === "filter") filters.value = narrow.value ? { kind: ["app"] } : {}
}
/* A small change through the same filter: the ten core rows leave, fifty stay. */
function hideCore() {
  filters.value = { kind: ["core"] }
}

const tone = (status: string) => (status === "running" ? "success" : status === "degraded" ? "warning" : "neutral")
</script>

<template>
  <div class="p-4">
    <button type="button" data-testid="toggle" @click="toggle">{{ narrow ? "Show all" : "Core only" }}</button>
    <button type="button" @click="hideCore">Hide core</button>
    <span role="status" aria-label="Shown">{{ narrow ? "core" : "all" }}</span>
    <LpTable v-model:filters="filters" :columns="columns" :rows="rows" row-key="id" aria-label="Services">
      <template #cell-name="{ row }">
        <LpLink :href="`#${row.name}`">{{ row.name }}</LpLink>
      </template>
      <template #cell-status="{ row }">
        <LpTooltip :content="`Status of ${row.name}: ${row.status}`">
          <span tabindex="0"><LpBadge :tone="tone(row.status)" size="sm" dot>{{ row.status }}</LpBadge></span>
        </LpTooltip>
      </template>
      <template #cell-autopilot="{ row }">
        <LpTooltip :content="`Autopilot on for ${row.name}`" label>
          <span tabindex="0" class="inline-flex"><LpIcon name="lucide:circle-alert" :size="16" /></span>
        </LpTooltip>
      </template>
      <template #cell-hosts="{ row }">
        <LpTooltip :content="`${row.hosts} more hosts`">
          <span tabindex="0">+{{ row.hosts }}</span>
        </LpTooltip>
      </template>
    </LpTable>
    <LpPageScrollbar />
  </div>
</template>
