<script setup lang="ts">
/*
 * Props, events and slots of a component, straight from its types. The doc
 * comment on a prop is its description, so the table says what the source
 * says and nothing goes stale.
 */
import { computed } from "vue"
import { LpBadge, LpEmptyState, LpSection, LpTable } from "../../src"
import { meta } from "./meta"

const props = defineProps<{ name: string }>()

const api = computed(() => meta[props.name])
const clean = (type: string) => type.replace(/\s*\|\s*undefined/g, "")

const PROP_COLUMNS = [
  { key: "name", label: "Prop", width: "300px" },
  { key: "type", label: "Type" },
  { key: "default", label: "Default", width: "130px" },
]
const EVENT_COLUMNS = [
  { key: "name", label: "Name", width: "180px" },
  { key: "type", label: "Payload" },
]
</script>

<template>
  <div v-if="api" class="flex flex-col gap-6">
    <section class="flex flex-col gap-2">
      <LpSection :title="`Props · ${api.props.length}`" level="sm" as="h3" />
      <LpTable v-if="api.props.length" :columns="PROP_COLUMNS" :rows="api.props" row-key="name" density="compact">
        <template #cell-name="{ row }">
          <span class="flex flex-col gap-1">
            <span class="flex items-center gap-1.5 font-mono text-xs text-ink">{{ row.name }}<LpBadge v-if="row.required" tone="danger" size="sm">required</LpBadge></span>
            <span v-if="row.description" class="text-xs text-muted">{{ row.description }}</span>
          </span>
        </template>
        <template #cell-type="{ row }"><code class="font-mono text-xs break-words text-brand">{{ clean(String(row.type)) }}</code></template>
        <template #cell-default="{ row }"><code class="font-mono text-xs text-muted">{{ row.default ?? "—" }}</code></template>
      </LpTable>
    </section>
    <section v-if="api.events.length" class="flex flex-col gap-2">
      <LpSection :title="`Events · ${api.events.length}`" level="sm" as="h3" />
      <LpTable :columns="EVENT_COLUMNS" :rows="api.events" row-key="name" density="compact">
        <template #cell-name="{ row }"><span class="font-mono text-xs text-ink">{{ row.name }}</span></template>
        <template #cell-type="{ row }"><code class="font-mono text-xs break-words text-brand">{{ row.type }}</code></template>
      </LpTable>
    </section>
    <section v-if="api.slots.length" class="flex flex-col gap-2">
      <LpSection :title="`Slots · ${api.slots.length}`" level="sm" as="h3" />
      <LpTable :columns="EVENT_COLUMNS" :rows="api.slots" row-key="name" density="compact">
        <template #cell-name="{ row }"><span class="font-mono text-xs text-ink">{{ row.name }}</span></template>
        <template #cell-type="{ row }"><code class="font-mono text-xs break-words text-brand">{{ row.type }}</code></template>
      </LpTable>
    </section>
  </div>
  <LpEmptyState v-else icon="lucide:file-question" title="No API data" description="Run npm run gen:meta to read it from the component's types." />
</template>
