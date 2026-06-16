<script setup lang="ts">
/*
 * Demonstrates the public LayoutCanvas API the way the launcher will use it:
 * the consumer owns the controls (edit toggle, palette, save/load) and a block
 * registry (id → title/icon), the kit owns geometry, tabs, drag/resize.
 */
import { ref } from "vue"
import { defineBlocks, LayoutCanvas, useLayout } from "../../src"
import DemoBlock from "../DemoBlock.vue"

const STORE_KEY = "lp-layout-canvas"
const INITIAL = ["play", "metrics", "instances"]

// Consumer's block catalogue. The kit reads title/icon for the tab bars; the
// `accent` is demo-only metadata the #block slot uses when rendering content.
const catalogue = {
  play: { title: "Play", icon: "lucide:play", accent: "var(--color-action)" },
  metrics: { title: "Metrics", icon: "lucide:chart-no-axes-column", accent: "var(--color-brand)" },
  instances: { title: "Instances", icon: "lucide:box", accent: "var(--color-accent)" },
  news: { title: "News", icon: "lucide:newspaper", accent: "var(--color-brand)" },
  friends: { title: "Friends", icon: "lucide:users", accent: "var(--color-accent)" },
  logs: { title: "Logs", icon: "lucide:terminal", accent: "var(--color-muted)" },
} as const

const registry = defineBlocks(
  Object.fromEntries(
    Object.entries(catalogue).map(([id, m]) => [
      id,
      { component: DemoBlock, title: m.title, icon: m.icon },
    ]),
  ),
)
const palette = Object.entries(catalogue).map(([id, m]) => ({ id, ...m }))
const accentOf = (block: string) => catalogue[block as keyof typeof catalogue]?.accent
const titleOf = (block: string) => catalogue[block as keyof typeof catalogue]?.title ?? block

// One stateful controller owns the tree + undo/redo + persistence.
const { layout, count, canUndo, canRedo, add, undo, redo, reset, serialize, hydrate } =
  useLayout({ initial: INITIAL })
const edit = ref(true)

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(serialize()))
}
function load() {
  const raw = localStorage.getItem(STORE_KEY)
  if (raw) hydrate(JSON.parse(raw))
}
function clear() {
  localStorage.removeItem(STORE_KEY)
  reset()
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full flex-1">
    <!-- Consumer-owned config panel (launcher: a settings tab). -->
    <aside class="flex w-60 shrink-0 flex-col gap-5 border-r border-line bg-surface-raised p-4">
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] font-medium uppercase tracking-wider text-muted">Mode</span>
        <button
          class="flex-1 rounded-control border px-2 py-1.5 text-xs"
          :class="edit ? 'border-brand bg-brand/15 text-ink' : 'border-line bg-surface-soft text-muted'"
          @click="edit = true"
        >
          Edit
        </button>
        <button
          class="flex-1 rounded-control border px-2 py-1.5 text-xs"
          :class="!edit ? 'border-brand bg-brand/15 text-ink' : 'border-line bg-surface-soft text-muted'"
          @click="edit = false"
        >
          View
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-medium uppercase tracking-wider text-muted">Add block</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="b in palette"
            :key="b.id"
            class="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface-soft px-2.5 py-1 text-xs text-ink enabled:hover:border-brand disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!edit"
            @click="add(b.id)"
          >
            <span class="size-[7px] rounded-full" :style="{ background: b.accent }" />
            {{ b.title }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-medium uppercase tracking-wider text-muted">History</span>
        <div class="flex gap-1.5">
          <button
            class="flex-1 rounded-control border border-line bg-surface-soft px-2 py-1.5 text-xs text-ink enabled:hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!canUndo"
            @click="undo"
          >
            Undo
          </button>
          <button
            class="flex-1 rounded-control border border-line bg-surface-soft px-2 py-1.5 text-xs text-ink enabled:hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!canRedo"
            @click="redo"
          >
            Redo
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-[11px] font-medium uppercase tracking-wider text-muted">
          Layout · {{ count }} blocks
        </span>
        <div class="flex gap-1.5">
          <button class="flex-1 rounded-control border border-line bg-surface-soft px-2 py-1.5 text-xs text-ink hover:border-line-strong" @click="save">Save</button>
          <button class="flex-1 rounded-control border border-line bg-surface-soft px-2 py-1.5 text-xs text-ink hover:border-line-strong" @click="load">Load</button>
          <button class="flex-1 rounded-control border border-line bg-surface-soft px-2 py-1.5 text-xs text-muted hover:border-line-strong" @click="clear">Reset</button>
        </div>
      </div>

      <p class="m-0 text-[11px] leading-relaxed text-muted">
        Drag a cell's tab bar onto another cell: edges split, the
        <strong class="text-ink">center merges as tabs</strong>. Drag a divider
        to resize. Click a tab to switch; × closes it.
      </p>
    </aside>

    <!-- The kit component. Content supplied via #block, chrome via :registry. -->
    <div
      class="flex min-h-0 min-w-0 flex-1 p-4"
      :class="edit ? 'bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] bg-[length:22px_22px]' : ''"
    >
      <LayoutCanvas v-model="layout" :edit="edit" :registry="registry">
        <template #block="{ block }">
          <DemoBlock :title="titleOf(block)" :accent="accentOf(block)" />
        </template>
      </LayoutCanvas>
    </div>
  </div>
</template>
