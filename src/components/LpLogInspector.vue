<script setup lang="ts">
/*
 * One log entry read closely: a structured payload as a tree, a stack trace with
 * its frames set apart from the error above them. LpLogViewer shows it under
 * the stream for the selected line (`inspector`); on its own it takes the
 * message, or `value` for a payload the app already has parsed.
 */
import { computed, ref, watch } from "vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"
import { useLabels } from "../composables/useLpConfig"
import { jsonRows, stackLines, structuredPayload } from "./logTools"

export interface LogInspectorLabels {
  [key: string]: string
  title: string
  filterFields: string
  noFields: string
  expand: string
  collapse: string
}

const props = defineProps<{
  /** The entry's text. Its JSON, if it holds any, becomes the tree. */
  message?: string
  /** A parsed payload, instead of reading one from `message`. */
  value?: object
  labels?: Partial<LogInspectorLabels>
}>()

const text = useLabels<LogInspectorLabels>(
  "logInspector",
  { title: "Log entry", filterFields: "Filter fields", noFields: "No fields match", expand: "Expand {field}", collapse: "Collapse {field}" },
  () => props.labels,
)

const filter = ref("")
const collapsed = ref(new Set<string>())
const payload = computed(() => props.value ?? (props.message ? structuredPayload(props.message) : null))
const rows = computed(() => (payload.value ? jsonRows(payload.value, collapsed.value, filter.value) : []))
const stack = computed(() => (props.message ? stackLines(props.message) : null))

// Another entry is another document: what was folded here means nothing there.
watch(payload, () => {
  collapsed.value = new Set()
})

function toggle(path: string) {
  const next = new Set(collapsed.value)
  if (!next.delete(path)) next.add(path)
  collapsed.value = next
}

const VALUE_TONE = { string: "text-success", number: "text-accent", boolean: "text-brand", null: "text-muted", object: "text-muted", array: "text-muted" }
/* Each level of the tree steps in by this much, in rem. */
const INDENT_REM = 1
</script>

<template>
  <section :aria-label="text.title" class="font-mono text-xs leading-5">
    <template v-if="payload">
      <LpInput v-model="filter" type="search" size="sm" icon="lucide:filter" clearable class="mb-2 font-sans" :aria-label="text.filterFields" :placeholder="text.filterFields" />
      <p v-if="!rows.length" class="py-1 font-sans text-muted">{{ text.noFields }}</p>
      <ul v-else class="min-w-0">
        <li v-for="row in rows" :key="row.path" class="flex items-start gap-1" :style="{ paddingLeft: `${row.depth * INDENT_REM}rem` }">
          <button
            v-if="row.expandable"
            type="button"
            class="mt-0.5 shrink-0 rounded-xs text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
            :aria-expanded="!collapsed.has(row.path)"
            :aria-label="(collapsed.has(row.path) ? text.expand : text.collapse).replace('{field}', row.label)"
            @click="toggle(row.path)"
          >
            <LpIcon :name="collapsed.has(row.path) ? 'lucide:chevron-right' : 'lucide:chevron-down'" :size="12" />
          </button>
          <span v-else class="w-3 shrink-0" aria-hidden="true" />
          <span class="shrink-0 text-muted-strong">{{ row.label }}:</span>
          <span class="min-w-0 whitespace-pre-wrap break-words" :class="VALUE_TONE[row.kind]">{{ row.value }}</span>
        </li>
      </ul>
    </template>
    <pre v-else-if="stack" class="overflow-x-auto"><template v-for="(line, i) in stack" :key="i"><span :class="line.frame ? 'text-muted' : 'text-ink'">{{ line.text }}</span>{{ "\n" }}</template></pre>
    <p v-else class="whitespace-pre-wrap break-words text-ink">{{ message }}</p>
  </section>
</template>
