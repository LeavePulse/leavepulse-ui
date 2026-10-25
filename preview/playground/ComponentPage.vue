<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { LpBadge, LpButton, LpCodeBlock, LpIcon, LpSegmented, LpTabs } from "../../src"
import ApiTables from "./ApiTables.vue"
import CodeEditor from "./CodeEditor.vue"
import LivePreview from "./LivePreview.vue"
import { meta } from "./meta"
import PropsPlayground from "./PropsPlayground.vue"
import { sectionOf, type ComponentEntry } from "./registry"
import { href, navigate } from "./router"

const props = defineProps<{ entry: ComponentEntry }>()

const code = ref(props.entry.template)
const scopeState = ref(props.entry.state?.() ?? {})
const tab = ref("example")

const section = computed(() => sectionOf.get(props.entry.id))

// The kit components this entry is about: the ones in its scope that have API
// data. The one whose name matches the entry leads; the rest follow.
const documented = computed(() => {
  const key = props.entry.id.replace(/-/g, "").toLowerCase()
  const names = Object.keys(props.entry.components).filter((n) => n in meta)
  const lead = names.find((n) => n.slice(2).toLowerCase() === key) ?? names.find((n) => n.slice(2).toLowerCase().startsWith(key))
  return lead ? [lead, ...names.filter((n) => n !== lead)] : names
})
const apiOf = ref("")

watch(
  () => props.entry.id,
  () => {
    code.value = props.entry.template
    scopeState.value = props.entry.state?.() ?? {}
    tab.value = "example"
    apiOf.value = documented.value[0] ?? ""
  },
  { immediate: true },
)

const lead = computed(() => documented.value[0])
const importLine = computed(() =>
  documented.value.length ? `import { ${documented.value.slice(0, 4).join(", ")} } from "@leavepulse/ui"` : "",
)

const tabs = computed(() => [
  { value: "example", label: "Example", icon: "lucide:play" },
  ...(lead.value ? [{ value: "playground", label: "Playground", icon: "lucide:sliders-horizontal" }] : []),
  ...(documented.value.length ? [{ value: "api", label: "API", icon: "lucide:braces" }] : []),
])

const neighbours = computed(() => {
  const list = section.value?.entries ?? []
  const i = list.findIndex((e) => e.id === props.entry.id)
  return { prev: list[i - 1], next: list[i + 1] }
})

function go(e: MouseEvent, id: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  navigate({ kind: "component", id })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 px-4 py-6 sm:p-8">
    <header class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <LpBadge v-if="section" tone="outline"><LpIcon :name="section.icon" :size="12" />{{ section.title }}</LpBadge>
        <LpBadge v-for="name in documented" :key="name" tone="neutral" class="font-mono">{{ name }}</LpBadge>
      </div>
      <h1 class="text-3xl font-semibold tracking-tight text-ink">{{ entry.name }}</h1>
      <p class="max-w-3xl text-sm leading-relaxed text-muted">{{ entry.description }}</p>
      <LpCodeBlock v-if="importLine" :model-value="importLine" lang="ts" copyable class="max-w-3xl" />
    </header>

    <LpTabs v-model="tab" :items="tabs">
      <template #panel="{ value }">
        <div v-if="value === 'example'" class="flex flex-col gap-4 pt-4">
          <LivePreview :key="entry.id" :template="code" :components="entry.components" :state="scopeState" />
          <div class="flex flex-col gap-2">
            <span class="text-[11px] font-medium tracking-wider text-muted uppercase">Example: edit it live</span>
            <CodeEditor v-model="code" />
          </div>
        </div>
        <div v-else-if="value === 'playground' && lead" class="pt-4">
          <PropsPlayground
            :key="lead"
            :name="lead"
            :component="entry.components[lead]!"
            :meta="meta[lead]!.props"
            :slots="meta[lead]!.slots.map((s) => s.name)"
          />
        </div>
        <div v-else-if="value === 'api'" class="flex flex-col gap-4 pt-4">
          <LpSegmented
            v-if="documented.length > 1"
            v-model="apiOf"
            size="sm"
            :options="documented.map((n) => ({ value: n, label: n }))"
            class="self-start"
          />
          <ApiTables :name="apiOf || documented[0]!" />
        </div>
      </template>
    </LpTabs>

    <nav v-if="neighbours.prev || neighbours.next" class="grid grid-cols-2 gap-3 border-t border-line pt-6">
      <a
        v-if="neighbours.prev"
        :href="href({ kind: 'component', id: neighbours.prev.id })"
        class="group flex flex-col gap-1 rounded-card border border-line p-4 transition-colors hover:bg-surface-soft"
        @click="go($event, neighbours.prev.id)"
      >
        <span class="flex items-center gap-1 text-xs text-muted"><LpIcon name="lucide:arrow-left" :size="12" />Previous</span>
        <span class="font-medium text-ink">{{ neighbours.prev.name }}</span>
      </a>
      <span v-else />
      <a
        v-if="neighbours.next"
        :href="href({ kind: 'component', id: neighbours.next.id })"
        class="group flex flex-col items-end gap-1 rounded-card border border-line p-4 text-right transition-colors hover:bg-surface-soft"
        @click="go($event, neighbours.next.id)"
      >
        <span class="flex items-center gap-1 text-xs text-muted">Next<LpIcon name="lucide:arrow-right" :size="12" /></span>
        <span class="font-medium text-ink">{{ neighbours.next.name }}</span>
      </a>
    </nav>
    <LpButton v-else variant="ghost" class="self-start" @click="navigate({ kind: 'home' })">Back to the overview</LpButton>
  </div>
</template>
