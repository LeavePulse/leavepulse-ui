<script setup lang="ts" generic="T extends Record<string, unknown>">
import LpIcon from "./LpIcon.vue"

export interface TableColumn<Row> {
  key: string
  label: string
  align?: "left" | "right" | "center"
  width?: string
}

withDefaults(
  defineProps<{
    columns: TableColumn<T>[]
    rows: T[]
    rowKey?: keyof T | ((row: T) => string | number)
    emptyLabel?: string
    emptyIcon?: string
  }>(),
  { emptyLabel: "Nothing here yet", emptyIcon: "lucide:inbox" },
)

function keyFor(
  row: T,
  index: number,
  rowKey?: keyof T | ((row: T) => string | number),
): string | number {
  if (typeof rowKey === "function") return rowKey(row)
  if (rowKey) return row[rowKey] as string | number
  return index
}

function alignClass(align?: "left" | "right" | "center"): string {
  if (align === "right") return "text-right"
  if (align === "center") return "text-center"
  return "text-left"
}
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-line">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="border-b border-line bg-surface-soft">
          <th
            v-for="col in columns"
            :key="col.key"
            :style="col.width ? { width: col.width } : undefined"
            :class="[
              'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted',
              alignClass(col.align),
            ]"
          >
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td :colspan="columns.length" class="px-4 py-10 text-center text-muted">
            <LpIcon :name="emptyIcon" :size="22" class="mx-auto mb-2 opacity-60" />
            <div>{{ emptyLabel }}</div>
          </td>
        </tr>
        <tr
          v-for="(row, index) in rows"
          :key="keyFor(row, index, rowKey)"
          class="border-b border-line/60 last:border-0 transition-colors hover:bg-surface-soft/60"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            :class="['px-4 py-3 text-ink', alignClass(col.align)]"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
