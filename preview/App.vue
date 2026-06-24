<script setup lang="ts">
import { computed, ref } from "vue"
import {
  type ContextMenuItemDef,
  LpContextMenu,
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
import AppShellDemo from "./pages/AppShellDemo.vue"
import Home from "./pages/Home.vue"
import InfraCanvas from "./pages/InfraCanvas.vue"
import Layout from "./pages/Layout.vue"
import Showcase from "./pages/Showcase.vue"

// Routes: "home" | "component:<id>" | "page:<id>"
const route = ref("home")

const componentEntry = computed(() =>
  route.value.startsWith("component:")
    ? registry.find((c) => c.id === route.value.slice("component:".length))
    : undefined,
)
const pageId = computed(() =>
  route.value.startsWith("page:") ? route.value.slice("page:".length) : undefined,
)
const crumb = computed(() => {
  if (componentEntry.value) return componentEntry.value.name
  if (pageId.value === "layout") return "Layout canvas"
  if (pageId.value === "showcase") return "Landing showcase"
  if (pageId.value === "infra") return "Infra canvas"
  if (pageId.value === "appshell") return "App shell"
  return null
})

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
      <button class="text-sm font-bold text-ink" @click="route = 'home'">
        LeavePulse UI
      </button>
      <template v-if="crumb">
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
      <Layout v-if="pageId === 'layout'" class="w-full" />
      <InfraCanvas v-else-if="pageId === 'infra'" class="w-full" />
      <LpScrollArea v-else class="min-h-0 flex-1">
        <ComponentPage v-if="componentEntry" :entry="componentEntry" class="w-full" />
        <Showcase v-else-if="pageId === 'showcase'" class="w-full" />
        <AppShellDemo v-else-if="pageId === 'appshell'" class="w-full" />
        <Home
          v-else
          class="w-full"
          @open-component="(id) => (route = `component:${id}`)"
          @open-page="(id) => (route = `page:${id}`)"
        />
      </LpScrollArea>
    </main>

    <LpToaster />
  </div>
</template>
