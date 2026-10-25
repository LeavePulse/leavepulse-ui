<script lang="ts">
export interface TableFilterOption {
  value: unknown
  label: string
  /** Rows holding the value; omitted when unknown (a server-backed table). */
  count?: number
}

export interface TableFilterLabels {
  search: string
  all: string
  none: string
  invert: string
  only: string
  onlyShown: string
  addShown: string
  noValues: string
}
</script>

<script setup lang="ts">
/*
 * The value filter of one LpTable column, opened from the funnel in its
 * header. Built for columns with many values: a search narrows the LIST
 * without touching what is ticked, "Only" next to a value shows just that one
 * in a click, and after a search the matches can be taken as a whole.
 */
import { computed, ref } from "vue"
import LpCheckbox from "./LpCheckbox.vue"
import LpInput from "./LpInput.vue"
import LpShift from "./LpShift.vue"
import { usePaintSelect } from "../composables/usePaintSelect"
import { hideAllValues, invertHidden, matchesQuery, onlyValues, unhideValues } from "./tableFilter"

const props = defineProps<{
  options: TableFilterOption[]
  hidden: ReadonlySet<unknown>
  labels: TableFilterLabels
}>()

const emit = defineEmits<{ (e: "update:hidden", value: Set<unknown>): void }>()

/** Past this many values a list is easier searched than scanned. */
const SEARCH_FROM = 8

const query = ref("")
const values = computed(() => props.options.map((o) => o.value))
const shown = computed(() => props.options.filter((o) => matchesQuery(o.label, query.value)))

function set(next: Set<unknown>) {
  emit("update:hidden", next)
}

function toggle(value: unknown) {
  const next = new Set(props.hidden)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  set(next)
}

const list = ref<HTMLElement | null>(null)

/*
 * Press a value's tick and sweep down the list to tick or clear the run, the
 * same way rows of the table are painted. The selection here is the values
 * shown, so painting writes back the complement as the hidden set.
 */
const byKey = computed(() => new Map(props.options.map((o) => [String(o.value), o.value])))
const paint = usePaintSelect<unknown>({
  root: list,
  selection: () => values.value.filter((v) => !props.hidden.has(v)),
  set: (shownValues) => {
    const keep = new Set(shownValues)
    set(new Set(values.value.filter((v) => !keep.has(v))))
  },
  resolve: (raw) => (byKey.value.has(raw) ? byKey.value.get(raw) : undefined),
})

/* Up and down walk the ticks, so a long list is not a long run of Tab. */
function onListKeydown(event: KeyboardEvent) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
  const boxes = [...(list.value?.querySelectorAll<HTMLElement>("[role=checkbox]") ?? [])]
  const at = boxes.indexOf(document.activeElement as HTMLElement)
  const next = boxes[at + (event.key === "ArrowDown" ? 1 : -1)]
  if (!next) return
  event.preventDefault()
  next.focus()
}

const action =
  "rounded-control px-1.5 py-0.5 text-xs font-medium text-muted outline-none transition-colors duration-fast hover:bg-surface-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
</script>

<template>
  <div class="flex flex-col gap-2">
    <LpInput
      v-if="options.length >= SEARCH_FROM"
      v-model="query"
      size="sm"
      icon="lucide:search"
      clearable
      :placeholder="labels.search"
      :aria-label="labels.search"
    />

    <div class="flex flex-wrap items-center gap-1">
      <template v-if="query">
        <button
          type="button"
          :class="action"
          :disabled="!shown.length"
          @click="set(onlyValues(values, shown.map((o) => o.value)))"
        >
          {{ labels.onlyShown.replace("{count}", String(shown.length)) }}
        </button>
        <button
          type="button"
          :class="action"
          :disabled="!shown.length"
          @click="set(unhideValues(hidden, shown.map((o) => o.value)))"
        >
          {{ labels.addShown.replace("{count}", String(shown.length)) }}
        </button>
      </template>
      <template v-else>
        <button type="button" :class="action" :disabled="!hidden.size" @click="set(new Set())">
          {{ labels.all }}
        </button>
        <button
          type="button"
          :class="action"
          :disabled="hidden.size === options.length"
          @click="set(hideAllValues(values))"
        >
          {{ labels.none }}
        </button>
        <button type="button" :class="action" @click="set(invertHidden(values, hidden))">
          {{ labels.invert }}
        </button>
      </template>
    </div>

    <LpShift>
      <div
        ref="list"
        class="-mx-1 flex max-h-64 flex-col overflow-y-auto overscroll-contain"
        @keydown="onListKeydown"
      >
        <div
          v-for="option in shown"
          :key="String(option.value)"
          class="group/opt flex items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-fast select-none hover:bg-surface-soft"
          :data-paint-key="String(option.value)"
        >
          <LpCheckbox
            :model-value="!hidden.has(option.value)"
            class="min-w-0 flex-1"
            @pointerdown="paint.onPointerDown($event, option.value)"
            @update:model-value="toggle(option.value)"
          >
            <span class="truncate">{{ option.label }}</span>
          </LpCheckbox>
          <span v-if="option.count !== undefined" class="text-xs text-muted tabular-nums">{{ option.count }}</span>
          <button
            type="button"
            class="rounded-control px-1.5 py-0.5 text-xs font-medium text-brand opacity-0 outline-none transition-opacity duration-fast group-hover/opt:opacity-100 hover:bg-brand-soft focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            @click="set(onlyValues(values, [option.value]))"
          >
            {{ labels.only }}
          </button>
        </div>
        <p v-if="!shown.length" class="px-1.5 py-2 text-xs text-muted">{{ labels.noValues }}</p>
      </div>
    </LpShift>
  </div>
</template>
