<script setup lang="ts">
import { computed, ref, watchEffect } from "vue"
import {
  LpAppShell,
  LpButton,
  type Command,
  LpCommandPalette,
  LpCommandScope,
  LpConfirmHost,
  LpEmptyState,
  LpIcon,
  LpKeys,
  LpPaletteHeader,
  LpPalettePreview,
  LpPaletteStats,
  LpShortcutsDialog,
  LpToaster,
  presets,
  useThemeStudio,
  LpThemeSwitcher,
  useHotkeys,
  type PresetName,
  type ShortcutGroup,
  type SidebarSection,
} from "../src"
import ComponentPage from "./playground/ComponentPage.vue"
import ThumbView from "./playground/ThumbView.vue"
import { registry, sectionOf, sections } from "./playground/registry"
import { href, navigate, useRoute } from "./playground/router"
import AppShellDemo from "./pages/AppShellDemo.vue"
import Home from "./pages/Home.vue"
import InfraCanvas from "./pages/InfraCanvas.vue"
import Layout from "./pages/Layout.vue"
import Showcase from "./pages/Showcase.vue"

// Real URLs (/component/<id>, /page/<id>) so Back/Forward and reload work.
const route = useRoute()

const componentEntry = computed(() => {
  const r = route.value
  // Bind to a local first: the narrowing wouldn't survive into the find callback.
  return r.kind === "component" ? registry.find((c) => c.id === r.id) : undefined
})
const pageId = computed(() => (route.value.kind === "page" ? route.value.id : undefined))

const PAGE_TITLES: Record<string, string> = {
  layout: "Layout canvas",
  showcase: "Landing showcase",
  infra: "Infra canvas",
  appshell: "App shell",
}

const crumb = computed(() => {
  if (componentEntry.value) return componentEntry.value.name
  return pageId.value ? (PAGE_TITLES[pageId.value] ?? pageId.value) : null
})

// A hand-typed or stale URL should say so rather than silently showing Home.
const notFound = computed(
  () =>
    (route.value.kind === "component" && !componentEntry.value) ||
    (route.value.kind === "page" && !(pageId.value! in PAGE_TITLES)),
)

/** The unmatched path, for the not-found copy. */
const missingPath = computed(() =>
  route.value.kind === "home" ? "/" : `/${route.value.kind}/${route.value.id}`,
)

// Keep the tab title in step with the route — it's what Back/Forward history
// entries are labelled with.
watchEffect(() => {
  document.title = crumb.value ? `${crumb.value} · LeavePulse UI` : "LeavePulse UI"
})

function goHome(e: MouseEvent) {
  // Let the browser handle modified clicks (new tab / new window).
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  navigate({ kind: "home" })
}

// The site theme is the kit's own studio: the header's switcher cycles it on
// a click and opens it on a right-click. The command scope exposes the same studio.
const studio = useThemeStudio()
const THEMES = Object.keys(presets) as PresetName[]

/*
 * The site is laid out by the kit's own shell: the sections of the registry
 * are the sidebar's groups, pages and the overview sit around them, and the
 * current URL is the active item.
 */
const navSections = computed<SidebarSection[]>(() => [
  { items: [{ id: href({ kind: "home" }), label: "Overview", icon: "lucide:house", href: href({ kind: "home" }) }] },
  ...sections.map((section) => ({
    title: section.title,
    collapsible: true,
    items: section.entries.map((entry) => {
      const link = href({ kind: "component", id: entry.id })
      return { id: link, label: entry.name, href: link }
    }),
  })),
  {
    title: "Pages",
    collapsible: true,
    items: Object.entries(PAGE_TITLES).map(([id, title]) => ({ id: pageLink(id), label: title, icon: "lucide:layout-dashboard", href: pageLink(id) })),
  },
])
const activeNav = computed(() => href(route.value))
const sectionTitle = computed(() => (componentEntry.value ? sectionOf.get(componentEntry.value.id)?.title : pageId.value ? "Pages" : null))
const fullBleed = computed(() => !notFound.value && (pageId.value === "layout" || pageId.value === "infra"))

// ⌘K / Ctrl-K opens the palette. The kit component binds the hotkey itself
// (`hotkey` defaults on), so this only has to supply the commands and the open
// state. Every route the preview has is reachable from here, which is the
// point: the component list is long enough that scanning it is the slow way.
const paletteOpen = ref(false)
// The CommandPalette page mounts its own example, which binds ⌘K too: both
// would toggle on one press and stack two dialogs. The example is what that
// page is about, so the site palette steps aside there.
const siteHotkey = computed(() => !(route.value.kind === "component" && ["commandpalette", "context-palette"].includes(route.value.id)))

/*
 * The palette the way an app would use it: a history it keeps itself, the
 * description in the preview pane, built from the kit's preview blocks and
 * folding away for the rows `hasPreview` turns down (the theme root and the
 * shortcuts row), every row a real link (so Tab offers "open
 * in new tab" and "copy link"), themes behind one row that drills into its
 * own list and stays open while you try them, and G-then-key jumps.
 */
const pageLink = (id: string) => href({ kind: "page", id })

/*
 * The preview pane for a component: the component itself, live, the way its
 * card on the overview shows it, then its route, the first sentence as the
 * lead and the rest of the description, with `code` in it set as code, so
 * the palette answers "what does it look like and what is it for" before the
 * page is open. The start of the example's source used to stand here: a block
 * of markup said less than the thing it draws.
 */
type Prose = { text: string; code: boolean }[]
const prose = (text: string): Prose =>
  text.split(/`([^`]+)`/).map((part, i) => ({ text: part, code: i % 2 === 1 })).filter((part) => part.text)
function componentPreview(id: string) {
  const entry = registry.find((e) => e.id === id.replace(/^component\//, ""))
  if (!entry) return null
  const text = entry.description.trim()
  const cut = text.search(/[.!?](\s|$)/)
  const lead = (cut > 0 ? text.slice(0, cut + 1) : text).replace(/`/g, "")
  const rest = prose(cut > 0 ? text.slice(cut + 1).trim() : "")
  return { entry, lead, rest, path: `/component/${entry.id}` }
}

const commands = computed<Command[]>(() => [
  ...registry.map((entry) => ({
    id: `component/${entry.id}`,
    label: entry.name,
    description: entry.description.replace(/`/g, ""),
    preview: entry.description,
    icon: "lucide:box",
    group: "Components",
    // The description is prose, so searching it alone misses the id a consumer
    // actually types ("otp", "toc"). Match that too.
    keywords: [entry.id],
    href: href({ kind: "component", id: entry.id }),
    onSelect: () => navigate({ kind: "component", id: entry.id }),
  })),
  ...Object.entries(PAGE_TITLES).map(([id, title]) => ({
    id: `page/${id}`,
    label: title,
    icon: "lucide:layout-dashboard",
    group: "Pages",
    keywords: [id],
    shortcut: GOTO.find((g) => g.page === id)?.combo,
    href: pageLink(id),
    onSelect: () => navigate({ kind: "page", id }),
  })),
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    icon: "lucide:keyboard",
    group: "Preferences",
    shortcut: "F1",
    onSelect: () => (shortcutsOpen.value = true),
  },
])

const GOTO = [
  { key: "h", combo: "G H", label: "Home", go: () => navigate({ kind: "home" }), page: "" },
  { key: "s", combo: "G S", label: "Landing showcase", go: () => navigate({ kind: "page", id: "showcase" }), page: "showcase" },
  { key: "l", combo: "G L", label: "Layout canvas", go: () => navigate({ kind: "page", id: "layout" }), page: "layout" },
  { key: "i", combo: "G I", label: "Infra canvas", go: () => navigate({ kind: "page", id: "infra" }), page: "infra" },
  { key: "a", combo: "G A", label: "App shell", go: () => navigate({ kind: "page", id: "appshell" }), page: "appshell" },
]
useHotkeys(
  GOTO.map((g) => ({
    sequence: `g ${g.key}`,
    help: { group: "Go to", label: g.label },
    handler: g.go,
  })),
)

// F1 opens the site's key reference, which lists what is bound right now. The
// ShortcutsDialog page mounts its own F1 example, so the site steps aside there.
const shortcutsOpen = ref(false)
const siteShortcutsKey = computed(() =>
  route.value.kind === "component" && route.value.id === "shortcuts-dialog" ? undefined : "F1",
)
const SITE_KEYS: ShortcutGroup[] = [
  {
    title: "Palette",
    entries: [
      { combo: "Ctrl+K", label: "Open the palette" },
      { combo: "Tab", label: "Actions for the highlighted row" },
      { combo: "Ctrl+Enter", label: "Open the highlighted row in a new tab" },
    ],
  },
]

</script>

<template>
  <LpCommandScope id="preview" label="LeavePulse UI" :discover="false" :theme="studio">
  <LpAppShell :model-value="activeNav" :sections="navSections" :full-bleed="fullBleed" :auto-collapse-after="16">
    <template #logo>
      <a :href="href({ kind: 'home' })" class="flex items-center gap-2 font-semibold text-ink" @click="goHome">
        <span class="grid size-7 place-items-center rounded-control bg-brand text-ink-inverse">
          <LpIcon name="lucide:component" :size="16" />
        </span>
        LeavePulse UI
      </a>
    </template>

    <template #header-title>
      <div class="flex min-w-0 items-center gap-2 text-sm">
        <span v-if="sectionTitle" class="shrink-0 text-muted">{{ sectionTitle }}</span>
        <LpIcon v-if="sectionTitle && crumb" name="lucide:chevron-right" :size="14" class="shrink-0 text-muted" />
        <h1 class="min-w-0 truncate font-semibold text-ink">{{ notFound ? "Nothing here" : crumb ?? "Overview" }}</h1>
      </div>
    </template>

    <template #header-actions>
      <!-- The palette is the way around the site, and a phone has no Ctrl+K. -->
      <LpButton variant="ghost" size="sm" aria-label="Search components, pages and themes" @click="paletteOpen = true">
        <LpIcon name="lucide:search" :size="16" />
        <span class="max-sm:hidden">Search</span>
        <LpKeys combo="Ctrl+K" class="max-sm:hidden" />
      </LpButton>
      <LpThemeSwitcher studio variant="pill" :system="{ light: 'Light', dark: 'Dark' }" />
    </template>

    <Layout v-if="!notFound && pageId === 'layout'" class="h-full w-full" />
    <InfraCanvas v-else-if="!notFound && pageId === 'infra'" class="h-full w-full" />
    <LpEmptyState
      v-else-if="notFound"
      icon="lucide:compass"
      title="Nothing here"
      :description="`No demo at ${missingPath}.`"
    >
      <LpButton variant="soft" @click="navigate({ kind: 'home' })">Back to the overview</LpButton>
    </LpEmptyState>
    <ComponentPage v-else-if="componentEntry" :entry="componentEntry" class="w-full" />
    <Showcase v-else-if="pageId === 'showcase'" class="w-full" />
    <AppShellDemo v-else-if="pageId === 'appshell'" class="w-full" />
    <Home v-else class="w-full" @search="paletteOpen = true" />

    <template #overlays>

    <LpCommandPalette
      v-model:open="paletteOpen"
      :hotkey="siteHotkey"
      :commands="commands"
      recent-key="lp-preview-palette-recent"
      preview-pane
      :has-preview="(c) => !c.children && c.id !== 'shortcuts'"
      :group-limit="8"
      placeholder="Jump to a component, page or theme…"
    >
      <template #preview="{ command, highlight }">
        <!-- Built from the kit's preview blocks: the same header, facts,
             swatches and keycaps an app would use, staggered in by
             LpPalettePreview. `highlight` marks the typed words the same
             way the rows do. -->
        <LpPalettePreview v-if="componentPreview(command.id)">
          <template v-for="p in [componentPreview(command.id)!]" :key="p.entry.id">
            <div class="overflow-hidden rounded-card border border-line">
              <ThumbView :entry="p.entry" :icon="sectionOf.get(p.entry.id)?.icon" />
            </div>
            <LpPaletteHeader eyebrow="Component" :title="highlight(p.entry.name)" icon="lucide:box" :subtitle="p.path" :lead="highlight(p.lead)" />
            <p v-if="p.rest.length" class="text-xs leading-relaxed text-muted">
              <template v-for="(part, i) in p.rest" :key="i">
                <code v-if="part.code" class="rounded-sm bg-surface-soft px-1 py-px font-mono text-[11px] text-ink">{{ part.text }}</code>
                <template v-else>{{ part.text }}</template>
              </template>
            </p>
            <LpKeys combo="Enter" label="opens its page" />
          </template>
        </LpPalettePreview>
        <LpPalettePreview v-else-if="command.id.startsWith('page/')">
          <LpPaletteHeader eyebrow="Page" :title="highlight(command.label)" :icon="command.icon" />
          <LpPaletteStats
            :items="[
              { label: 'Components', value: registry.length },
              { label: 'Themes', value: THEMES.length },
            ]"
          />
          <LpKeys v-if="command.shortcut" :combo="command.shortcut" label="from anywhere on the site" />
        </LpPalettePreview>
      </template>
    </LpCommandPalette>
    <LpShortcutsDialog
      v-model:open="shortcutsOpen"
      :hotkey="siteShortcutsKey"
      :groups="SITE_KEYS"
      live
      description="What the keyboard does on this site, including the keys bound on the page you are on."
    />

    <LpToaster />
    <LpConfirmHost />
    </template>
  </LpAppShell>
  </LpCommandScope>
</template>

