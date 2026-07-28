<script setup lang="ts">
import { computed, ref, watchEffect } from "vue"
import {
  type ContextMenuItemDef,
  LpButton,
  LpContextMenu,
  LpEmptyState,
  LpIcon,
  LpScrollArea,
  LpToaster,
  presets,
  type RevealOrigin,
  useTheme,
  type PresetName,
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
const { apply, applyWithTransition } = useTheme()
const theme = ref<PresetName>("dark")

function buildTheme(): TokenSet {
  return presets[theme.value]
}

// First paint: apply instantly. Theme swaps go through setTheme so they can
// animate from the button.
apply(buildTheme())

// Theme switcher (LeaveHosting style): one icon button — left-click cycles to
// the next theme, right-click opens the full picker. The circular reveal grows
// from the button's centre so it reads the same regardless of how it's invoked.
const THEMES = ["dark", "light", "lime", "rose", "amber", "violet", "nord"] as const

const THEME_ICON: Record<PresetName, string> = {
  dark: "lucide:moon",
  light: "lucide:sun",
  lime: "lucide:sprout",
  leavepulse: "lucide:waves",
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
  if (name === theme.value) return
  theme.value = name
  applyWithTransition(buildTheme(), themeOrigin())
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

const chip = "rounded-control px-3 py-1.5 text-sm transition-colors"
const on = "bg-surface-soft text-ink"
</script>

<template>
  <div class="flex h-full flex-col">
    <nav class="flex items-center gap-3 border-b border-line bg-surface-raised px-4 py-2.5">
      <!-- A real link: middle-click / cmd-click open it in a new tab. -->
      <a :href="href({ kind: 'home' })" class="text-sm font-bold text-ink" @click="goHome">
        LeavePulse UI
      </a>
      <template v-if="crumb && !notFound">
        <span class="text-muted">/</span>
        <span class="text-sm text-ink">{{ crumb }}</span>
      </template>

      <div class="ml-auto flex items-center gap-2 text-xs text-muted">
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

    <LpToaster />
  </div>
</template>
