<script setup lang="ts">
/*
 * LpLogViewer's bar above the stream: the search box with its match count and
 * steps, the level chips and, with `tools`, the pattern toggle, folding,
 * copy, download and the source chips. The viewer holds every state; the bar
 * edits it through its models.
 */
import { ref } from "vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"
import { logLevelLook } from "./logFormat"
import type { LogLevel, LogViewerLabels } from "./logViewerTypes"

defineProps<{
  text: LogViewerLabels
  /** The term in effect, which the match count is about. */
  term: string
  matchLabel: string
  hasMatches: boolean
  presentLevels: LogLevel[]
  levelCounts: Map<LogLevel, number>
  presentSources: string[]
  tools: boolean
}>()

const query = defineModel<string>("query", { required: true })
const levels = defineModel<LogLevel[]>("levels", { required: true })
const sources = defineModel<string[]>("sources", { required: true })
const regex = defineModel<boolean>("regex", { required: true })
const grouped = defineModel<boolean>("grouped", { required: true })

const emit = defineEmits<{
  (e: "step", direction: 1 | -1): void
  (e: "copy"): void
  (e: "download"): void
}>()

const searchEl = ref<InstanceType<typeof LpInput> | null>(null)

function onSearchKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === "Enter") {
    event.preventDefault()
    emit("step", event.shiftKey ? -1 : 1)
  } else if (event.key === "Escape" && query.value) {
    event.preventDefault()
    event.stopPropagation()
    query.value = ""
  }
}

function toggleSource(source: string) {
  sources.value = sources.value.includes(source)
    ? sources.value.filter((s) => s !== source)
    : [...sources.value, source]
}

function toggleLevel(level: LogLevel) {
  levels.value = levels.value.includes(level)
    ? levels.value.filter((l) => l !== level)
    : [...levels.value, level]
}

defineExpose({ focus: () => searchEl.value?.focus() })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5 font-sans">
    <LpInput
      ref="searchEl"
      v-model="query"
      type="search"
      size="sm"
      icon="lucide:search"
      clearable
      class="min-w-48 flex-1"
      :aria-label="text.search"
      :placeholder="text.search"
      :labels="{ clear: text.clearSearch }"
      @keydown="onSearchKeydown"
    >
      <template #trailing>
        <span v-if="term" class="shrink-0 text-[11px] tabular-nums text-muted" aria-live="polite">{{ matchLabel }}</span>
      </template>
    </LpInput>

    <div class="flex items-center">
      <button
        type="button"
        class="rounded-xs p-1 text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        :aria-label="text.previousMatch"
        :disabled="!hasMatches"
        @click="emit('step', -1)"
      >
        <LpIcon name="lucide:chevron-up" :size="14" />
      </button>
      <button
        type="button"
        class="rounded-xs p-1 text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        :aria-label="text.nextMatch"
        :disabled="!hasMatches"
        @click="emit('step', 1)"
      >
        <LpIcon name="lucide:chevron-down" :size="14" />
      </button>
    </div>
    <div
      v-if="presentLevels.length > 1"
      role="group"
      :aria-label="text.levels"
      class="flex flex-wrap items-center gap-1"
    >
      <button
        v-for="level in presentLevels"
        :key="level"
        type="button"
        class="flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        :class="levels.includes(level) ? 'border-line-strong bg-surface-soft text-ink' : 'border-line text-muted hover:text-ink'"
        :aria-pressed="levels.includes(level)"
        @click="toggleLevel(level)"
      >
        <span class="size-1.5 rounded-full" :class="logLevelLook(level).rail" aria-hidden="true" />
        {{ level }}
        <span class="font-normal tabular-nums text-muted">{{ levelCounts.get(level) }}</span>
      </button>
    </div>
    <template v-if="tools">
      <button
        type="button"
        class="rounded-xs px-1.5 py-0.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="regex ? 'bg-surface-soft text-ink' : 'text-muted hover:text-ink'"
        :aria-label="text.regex"
        :aria-pressed="regex"
        @click="regex = !regex"
      >.*</button>
      <button
        type="button"
        class="rounded-xs p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="grouped ? 'bg-surface-soft text-ink' : 'text-muted hover:text-ink'"
        :aria-label="text.groupRepeats"
        :aria-pressed="grouped"
        @click="grouped = !grouped"
      >
        <LpIcon name="lucide:layers" :size="14" />
      </button>
      <button type="button" class="rounded-xs p-1 text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring" :aria-label="text.copySelection" @click="emit('copy')">
        <LpIcon name="lucide:copy" :size="14" />
      </button>
      <button type="button" class="rounded-xs p-1 text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring" :aria-label="text.download" @click="emit('download')">
        <LpIcon name="lucide:download" :size="14" />
      </button>
      <div v-if="presentSources.length > 1" role="group" :aria-label="text.sources" class="flex flex-wrap items-center gap-1">
        <button
          v-for="source in presentSources"
          :key="source"
          type="button"
          class="rounded-pill border px-2 py-0.5 text-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          :class="sources.includes(source) ? 'border-line-strong bg-surface-soft text-ink' : 'border-line text-muted hover:text-ink'"
          :aria-pressed="sources.includes(source)"
          @click="toggleSource(source)"
        >{{ source }}</button>
      </div>
    </template>
  </div>
</template>
