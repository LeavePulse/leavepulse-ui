<script setup lang="ts">
import { computed, ref } from "vue"
import { LpBadge, LpButton, LpCard, LpEmptyState, LpIcon, LpInput, LpStat, presets } from "../../src"
import ThumbView from "../playground/ThumbView.vue"
import { registry, sections } from "../playground/registry"
import { href, navigate, type Route } from "../playground/router"

// Cards are <a> elements with real hrefs so middle-click / cmd-click open a new
// tab and the status bar previews the target; a plain click is intercepted for
// a client-side navigation.
function go(e: MouseEvent, route: Route) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  navigate(route)
}

const emit = defineEmits<{ search: [] }>()

const showcasePages = [
  { id: "appshell", title: "App shell", icon: "lucide:panels-top-left", desc: "The full application frame: sidebar, header and one scroll region, with a burger drawer on a phone." },
  { id: "layout", title: "Layout canvas", icon: "lucide:layout-grid", desc: "Blocks you drag to split, tab and resize, with undo and redo." },
  { id: "showcase", title: "Landing showcase", icon: "lucide:sparkles", desc: "A landing page built only from kit components." },
  { id: "infra", title: "Infra canvas", icon: "lucide:network", desc: "A topology graph with swimlanes, node roles and live edges. Click a node." },
]

const query = ref("")
const needle = computed(() => query.value.trim().toLocaleLowerCase())
const found = computed(() =>
  sections
    .map((section) => ({
      ...section,
      entries: section.entries.filter(
        (e) => !needle.value || `${e.name} ${e.id} ${e.description}`.toLocaleLowerCase().includes(needle.value),
      ),
    }))
    .filter((section) => section.entries.length),
)

/** The first sentence of a description: the card's one line. */
function lead(text: string): string {
  const cut = text.search(/[.!?](\s|$)/)
  return (cut > 0 ? text.slice(0, cut + 1) : text).replace(/`/g, "")
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:px-8 sm:py-10">
    <header class="flex flex-col gap-6">
      <div class="flex max-w-2xl flex-col gap-3">
        <LpBadge tone="brand" class="self-start">Vue 3 · token-driven</LpBadge>
        <h1 class="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">LeavePulse UI</h1>
        <p class="text-base leading-relaxed text-muted">
          The kit behind the LeavePulse panel and launcher. Every demo here is the real component: tune the theme
          from the top-right and the whole site re-skins while you watch.
        </p>
        <div class="flex flex-wrap gap-2">
          <LpButton @click="emit('search')"><LpIcon name="lucide:search" :size="16" />Find a component</LpButton>
          <LpButton variant="ghost" :href="href({ kind: 'page', id: 'appshell' })" as="a" @click="go($event, { kind: 'page', id: 'appshell' })">
            See a whole app
          </LpButton>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LpCard><LpStat compact label="Component examples" :value="registry.filter(entry => !entry.related).length" icon="lucide:component" /></LpCard>
        <LpCard><LpStat compact label="Sections" :value="sections.length" icon="lucide:shapes" /></LpCard>
        <LpCard><LpStat compact label="Themes" :value="Object.keys(presets).length" icon="lucide:palette" /></LpCard>
        <LpCard><LpStat compact label="Showcase pages" :value="showcasePages.length" icon="lucide:layout-dashboard" /></LpCard>
      </div>
    </header>

    <div class="max-w-md">
      <LpInput v-model="query" icon="lucide:filter" placeholder="Filter by name or what it does…" clearable aria-label="Filter components" />
    </div>

    <section v-for="section in found" :id="section.id" :key="section.id" class="flex scroll-mt-20 flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="flex items-center gap-2 text-lg font-semibold text-ink">
          <LpIcon :name="section.icon" :size="18" class="text-brand" />
          {{ section.title }}
          <span class="text-sm font-normal text-muted tabular-nums">{{ section.entries.length }}</span>
        </h2>
        <p class="text-sm text-muted">{{ section.lead }}</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a
          v-for="entry in section.entries"
          :key="entry.id"
          :href="href({ kind: 'component', id: entry.id })"
          class="rounded-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="go($event, { kind: 'component', id: entry.id })"
        >
          <LpCard interactive :padded="false" class="flex h-full flex-col overflow-hidden">
            <ThumbView :entry="entry" :icon="section.icon" class="border-b border-line" />
            <div class="flex flex-1 flex-col gap-1 p-4">
              <span class="font-semibold text-ink">{{ entry.name }}</span>
              <span class="line-clamp-2 text-sm text-muted">{{ lead(entry.description) }}</span>
            </div>
          </LpCard>
        </a>
      </div>
    </section>

    <LpEmptyState v-if="!found.length" icon="lucide:search-x" title="Nothing matches" :description="`No component mentions “${query}”.`">
      <LpButton variant="soft" size="sm" @click="query = ''">Clear the filter</LpButton>
    </LpEmptyState>

    <section v-if="!needle" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="flex items-center gap-2 text-lg font-semibold text-ink">
          <LpIcon name="lucide:layout-dashboard" :size="18" class="text-brand" />Showcase
        </h2>
        <p class="text-sm text-muted">Whole screens put together from the kit.</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <a
          v-for="p in showcasePages"
          :key="p.id"
          :href="href({ kind: 'page', id: p.id })"
          class="rounded-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="go($event, { kind: 'page', id: p.id })"
        >
          <LpCard interactive class="flex h-full items-start gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
              <LpIcon :name="p.icon" :size="20" />
            </span>
            <span class="flex flex-col gap-1">
              <span class="font-semibold text-ink">{{ p.title }}</span>
              <span class="text-sm text-muted">{{ p.desc }}</span>
            </span>
          </LpCard>
        </a>
      </div>
    </section>
  </div>
</template>
