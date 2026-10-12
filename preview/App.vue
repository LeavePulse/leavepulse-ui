<script setup lang="ts">
import { computed, ref, watchEffect } from "vue"
import {
  type ContextMenuItemDef,
  LpButton,
  type Command,
  LpCodeBlock,
  LpCommandPalette,
  LpConfirmHost,
  LpContextMenu,
  LpEmptyState,
  LpIcon,
  LpScrollArea,
  LpShortcutsDialog,
  LpToaster,
  presets,
  type RevealOrigin,
  useHotkeys,
  useTheme,
  type PresetName,
  type ShortcutGroup,
  type TokenSet,
} from "../src"
import ComponentPage from "./playground/ComponentPage.vue"
import { registry } from "./playground/registry"
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

// Themes are JSON now — the switcher applies a TokenSet via the engine.
// The preview is a consumer like any app: it starts from the saved choice
// (a theme, or "follow the OS"), falling back to Onyx on a first visit.
const kitTheme = useTheme()
kitTheme.init(presets.dark)
const theme = computed<PresetName>(
  () =>
    (Object.keys(presets) as PresetName[]).find((k) => presets[k].name === kitTheme.currentName.value) ??
    "dark",
)

function buildTheme(name: PresetName): TokenSet {
  return presets[name]
}

// Theme switcher (LeaveHosting style): one icon button — left-click cycles to
// the next theme, right-click opens the full picker. The circular reveal grows
// from the button's centre so it reads the same regardless of how it's invoked.
const THEMES = ["dark", "light", "lime", "rose", "amber", "violet", "nord"] as const

const THEME_ICON: Record<PresetName, string> = {
  dark: "lucide:moon",
  light: "lucide:sun",
  lime: "lucide:sprout",
  rose: "lucide:flower",
  amber: "lucide:flame",
  violet: "lucide:gem",
  nord: "lucide:snowflake",
}

const themeBtn = ref<HTMLButtonElement | null>(null)
function themeOrigin(): RevealOrigin | undefined {
  const el = themeBtn.value
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function setTheme(name: PresetName) {
  if (name === theme.value && !kitTheme.system.value) return
  kitTheme.setTheme(buildTheme(name), themeOrigin())
}

function cycleTheme() {
  const i = THEMES.indexOf(theme.value as (typeof THEMES)[number])
  setTheme(THEMES[(i + 1) % THEMES.length])
}

const themeItems = computed<ContextMenuItemDef[]>(() =>
  THEMES.map((name) => ({
    label: presets[name].name,
    icon: theme.value === name ? "lucide:check" : THEME_ICON[name],
    onSelect: () => setTheme(name),
  })),
)

// ⌘K / Ctrl-K opens the palette. The kit component binds the hotkey itself
// (`hotkey` defaults on), so this only has to supply the commands and the open
// state. Every route the preview has is reachable from here, which is the
// point: the component list is long enough that scanning it is the slow way.
const paletteOpen = ref(false)
// The CommandPalette page mounts its own example, which binds ⌘K too: both
// would toggle on one press and stack two dialogs. The example is what that
// page is about, so the site palette steps aside there.
const siteHotkey = computed(() => !(route.value.kind === "component" && route.value.id === "commandpalette"))

/*
 * The palette the way an app would use it: a history it keeps itself, the
 * description in the preview pane, every row a real link (so Tab offers "open
 * in new tab" and "copy link"), themes behind one row that drills into its
 * own list and stays open while you try them, and G-then-key jumps.
 */
const pageLink = (id: string) => href({ kind: "page", id })

/*
 * The preview pane for a component: its route, the first sentence as the lead,
 * the rest of the description below it, and the start of its live example in
 * a code block, so the palette answers "what is this and how is it used"
 * before the page is even open.
 */
const PREVIEW_LINES = 12
function componentPreview(id: string) {
  const entry = registry.find((e) => e.id === id.replace(/^component\//, ""))
  if (!entry) return null
  const text = entry.description.trim()
  const cut = text.search(/[.!?](\s|$)/)
  const lead = cut > 0 ? text.slice(0, cut + 1) : text
  const rest = cut > 0 ? text.slice(cut + 1).trim() : ""
  const lines = entry.template.trim().split("\n")
  const code = lines.slice(0, PREVIEW_LINES).join("\n") + (lines.length > PREVIEW_LINES ? "\n…" : "")
  return { entry, lead, rest, code, path: `/component/${entry.id}` }
}

const commands = computed<Command[]>(() => [
  ...registry.map((entry) => ({
    id: `component/${entry.id}`,
    label: entry.name,
    description: entry.description,
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
    id: "theme",
    label: "Theme",
    description: `Now: ${presets[theme.value].name}`,
    icon: "lucide:palette",
    group: "Preferences",
    keywords: ["theme", "dark", "light", ...THEMES],
    childPlaceholder: "Pick a theme…",
    children: THEMES.map((name) => ({
      id: `theme/${name}`,
      label: presets[name].name,
      icon: theme.value === name ? "lucide:check" : THEME_ICON[name],
      keepOpen: true,
      onSelect: () => setTheme(name),
    })),
  },
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

const chip = "rounded-control px-3 py-1.5 text-sm transition-colors"
const on = "bg-surface-soft text-ink"
</script>

<template>
  <div class="flex h-full flex-col">
    <nav class="flex items-center gap-3 border-b border-line bg-surface-raised px-4 py-2.5">
      <!-- A real link: middle-click / cmd-click open it in a new tab. -->
      <a :href="href({ kind: 'home' })" class="shrink-0 text-sm font-bold text-ink" @click="goHome">
        LeavePulse UI
      </a>
      <template v-if="crumb && !notFound">
        <span class="text-muted">/</span>
        <span class="min-w-0 truncate text-sm text-ink">{{ crumb }}</span>
      </template>

      <div class="ml-auto flex shrink-0 items-center gap-2 text-xs text-muted">
        <!-- The palette is the way around the site, and a phone has no Ctrl+K. -->
        <button
          type="button"
          :class="[chip, 'inline-flex items-center gap-1.5 hover:bg-surface-soft hover:text-ink']"
          aria-label="Search components, pages and themes"
          @click="paletteOpen = true"
        >
          <LpIcon name="lucide:search" :size="16" />
          <kbd class="hidden font-sans text-[11px] sm:inline">Ctrl K</kbd>
        </button>
        <!-- Left-click cycles themes; right-click opens the full picker. The
             circular reveal grows from the button (same as LeaveHosting). -->
        <LpContextMenu :items="themeItems">
          <button
            ref="themeBtn"
            type="button"
            :class="[chip, on, 'inline-flex items-center gap-1.5']"
            :aria-label="`Theme: ${presets[theme].name}`"
            title="Click to switch · right-click for all themes"
            @click="cycleTheme"
          >
            <LpIcon :name="THEME_ICON[theme]" :size="16" />
            <span>{{ presets[theme].name }}</span>
          </button>
        </LpContextMenu>
      </div>
    </nav>

    <!-- Layout page manages its own scrolling; others use a drawn overlay bar. -->
    <main class="flex min-h-0 flex-1">
      <Layout v-if="!notFound && pageId === 'layout'" class="w-full" />
      <InfraCanvas v-else-if="!notFound && pageId === 'infra'" class="w-full" />
      <LpScrollArea v-else class="min-h-0 flex-1">
        <LpEmptyState
          v-if="notFound"
          icon="lucide:compass"
          title="Nothing here"
          :description="`No demo at ${missingPath}.`"
        >
          <LpButton variant="soft" @click="navigate({ kind: 'home' })">Back to index</LpButton>
        </LpEmptyState>
        <ComponentPage v-else-if="componentEntry" :entry="componentEntry" class="w-full" />
        <Showcase v-else-if="pageId === 'showcase'" class="w-full" />
        <AppShellDemo v-else-if="pageId === 'appshell'" class="w-full" />
        <Home v-else class="w-full" />
      </LpScrollArea>
    </main>

    <LpCommandPalette
      v-model:open="paletteOpen"
      :hotkey="siteHotkey"
      :commands="commands"
      recent-key="lp-preview-palette-recent"
      preview-pane
      :group-limit="8"
      placeholder="Jump to a component, page or theme…"
    >
      <template #preview="{ command }">
        <div v-if="componentPreview(command.id)" class="flex flex-col gap-4">
          <template v-for="p in [componentPreview(command.id)!]" :key="p.entry.id">
            <header class="pv-in flex flex-col gap-1.5">
              <div class="flex items-center gap-2">
                <span class="grid size-7 shrink-0 place-items-center rounded-control bg-brand-soft text-brand">
                  <LpIcon name="lucide:box" :size="15" />
                </span>
                <h3 class="min-w-0 truncate text-base font-semibold text-ink">{{ p.entry.name }}</h3>
              </div>
              <code class="w-fit rounded-control bg-surface-soft px-1.5 py-0.5 font-mono text-[11px] text-muted">{{ p.path }}</code>
            </header>
            <p class="pv-in text-sm leading-relaxed text-ink" style="animation-delay: 45ms">{{ p.lead }}</p>
            <p v-if="p.rest" class="pv-in text-xs leading-relaxed text-muted" style="animation-delay: 90ms">{{ p.rest }}</p>
            <div class="pv-in flex flex-col gap-1.5" style="animation-delay: 135ms">
              <span class="text-[11px] font-medium tracking-wide text-muted uppercase">Example</span>
              <LpCodeBlock :model-value="p.code" lang="html" :copyable="false" class="text-[11px]" />
            </div>
          </template>
        </div>
        <template v-else>
          <div class="flex items-center gap-2 text-ink">
            <LpIcon v-if="command.icon" :name="command.icon" :size="16" class="shrink-0 text-muted" />
            <h3 class="text-base font-semibold">{{ command.label }}</h3>
          </div>
          <p v-if="command.preview" class="mt-2 text-sm text-muted">{{ command.preview }}</p>
        </template>
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
  </div>
</template>

<style scoped>
/* The pane's parts arrive one after another, as the kit's own pane does. */
.pv-in {
  animation: option-in var(--duration-medium) var(--ease-emphasized) both;
}
@media (prefers-reduced-motion: reduce) {
  .pv-in {
    animation: none;
  }
}
</style>
