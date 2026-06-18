<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { LpScrollArea, LpToaster, presets, useTheme, type PresetName, type TokenSet } from "../src"
import ComponentPage from "./playground/ComponentPage.vue"
import { registry } from "./playground/registry"
import Home from "./pages/Home.vue"
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
  return null
})

// Themes are JSON now — the switcher applies a TokenSet via the engine.
const { apply, applyWithTransition } = useTheme()
const theme = ref<PresetName>("dark")
const density = ref<"compact" | "default" | "comfortable">("default")

const densityScale = { compact: 0.85, default: 1, comfortable: 1.18 }

function buildTheme(): TokenSet {
  const base = presets[theme.value]
  const k = densityScale[density.value]
  // density is just a scaling of the base theme's control sizes / spacing
  return {
    ...base,
    density: {
      spacingUnit: Math.round(base.density.spacingUnit * k),
      controlSm: Math.round(base.density.controlSm * k),
      controlMd: Math.round(base.density.controlMd * k),
      controlLg: Math.round(base.density.controlLg * k),
    },
  }
}

// First paint + density changes: apply instantly (resizing controls shouldn't
// trigger a colour wipe). Watches density only — theme swaps go through
// pickTheme so they can animate from the click point.
apply(buildTheme())
watch(density, () => apply(buildTheme()))

// Theme button: circular reveal growing from the clicked chip.
function pickTheme(name: PresetName, event: MouseEvent) {
  if (name === theme.value) return
  theme.value = name
  applyWithTransition(buildTheme(), { x: event.clientX, y: event.clientY })
}

const chip = "rounded-control px-3 py-1.5 text-sm transition-colors"
const on = "bg-surface-soft text-ink"
const off = "text-muted hover:text-ink"
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
        <span>theme</span>
        <button
          v-for="t in (['dark', 'light', 'lime'] as const)"
          :key="t"
          :class="[chip, theme === t ? on : off]"
          @click="pickTheme(t, $event)"
        >
          {{ t }}
        </button>
        <span class="ml-2">density</span>
        <button
          v-for="d in (['compact', 'default', 'comfortable'] as const)"
          :key="d"
          :class="[chip, density === d ? on : off]"
          @click="density = d"
        >
          {{ d }}
        </button>
      </div>
    </nav>

    <!-- Layout page manages its own scrolling; others use a drawn overlay bar. -->
    <main class="flex min-h-0 flex-1">
      <Layout v-if="pageId === 'layout'" class="w-full" />
      <LpScrollArea v-else class="min-h-0 flex-1">
        <ComponentPage v-if="componentEntry" :entry="componentEntry" class="w-full" />
        <Showcase v-else-if="pageId === 'showcase'" class="w-full" />
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
