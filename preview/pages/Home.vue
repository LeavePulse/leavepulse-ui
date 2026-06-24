<script setup lang="ts">
import { LpBadge, LpCard } from "../../src"
import { registry } from "../playground/registry"

defineEmits<{
  (e: "open-component", id: string): void
  (e: "open-page", id: string): void
}>()

const showcasePages = [
  {
    id: "appshell",
    title: "App shell",
    desc: "Full application frame — sidebar rail + header + single scroll region, responsive burger drawer, derived page title.",
  },
  {
    id: "layout",
    title: "Layout canvas",
    desc: "Drag-to-compose blocks — split, tabs (center-drop), resize, undo/redo via useLayout().",
  },
  {
    id: "showcase",
    title: "Landing showcase",
    desc: "A landing slice built from kit components — try the lime theme.",
  },
  {
    id: "infra",
    title: "Infra canvas",
    desc: "LeaveInfra topology graph — project swimlanes, node roles, wg/cloudflared edges, desired-vs-observed. Click a node.",
  },
]

const heading = "text-sm font-semibold uppercase tracking-wider text-muted"
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-10 p-10">
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold text-ink">LeavePulse UI</h1>
      <p class="text-sm text-muted">
        Token-driven Vue component kit. Switch the theme (top-right) to see
        everything re-skin live.
      </p>
    </div>

    <!-- Block 1: components (live example + editable code on click) -->
    <section class="flex flex-col gap-4">
      <h2 :class="heading">Components</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="c in registry"
          :key="c.id"
          type="button"
          class="rounded-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="$emit('open-component', c.id)"
        >
          <LpCard interactive class="flex h-full flex-col gap-2">
            <span class="font-semibold text-ink">{{ c.name }}</span>
            <span class="text-sm text-muted">{{ c.description }}</span>
          </LpCard>
        </button>
      </div>
    </section>

    <!-- Block 2: showcase preview pages -->
    <section class="flex flex-col gap-4">
      <h2 :class="heading">Showcase</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          v-for="p in showcasePages"
          :key="p.id"
          type="button"
          class="rounded-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @click="$emit('open-page', p.id)"
        >
          <LpCard interactive class="flex h-full flex-col gap-2">
            <span class="font-semibold text-ink">{{ p.title }}</span>
            <span class="flex-1 text-sm text-muted">{{ p.desc }}</span>
            <LpBadge tone="brand">Open</LpBadge>
          </LpCard>
        </button>
      </div>
    </section>
  </div>
</template>
