<script setup lang="ts">
/*
 * Demonstrates the public LayoutCanvas API the way the launcher will use it:
 * the consumer owns the controls (edit toggle, palette, save/load) and the
 * block content (#block slot), the kit owns geometry + drag/resize.
 */
import { ref } from "vue"
import { LayoutCanvas, useLayout } from "../../src"
import DemoBlock from "../DemoBlock.vue"

const STORE_KEY = "lp-layout-canvas"
const INITIAL = ["play", "metrics", "instances"]

// Consumer's block catalogue (in the launcher: Play, Metrics, …).
const palette = [
  { id: "play", title: "Play", accent: "var(--color-action)" },
  { id: "metrics", title: "Metrics", accent: "var(--color-brand)" },
  { id: "instances", title: "Instances", accent: "var(--color-accent)" },
  { id: "news", title: "News", accent: "var(--color-brand)" },
  { id: "friends", title: "Friends", accent: "var(--color-accent)" },
  { id: "logs", title: "Logs", accent: "var(--color-muted)" },
]
const titleOf = (block: string) => palette.find((b) => b.id === block)?.title ?? block
const accentOf = (block: string) => palette.find((b) => b.id === block)?.accent

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
        Drag a block header onto another block's edge to split. Drag a divider
        to resize. × on a header removes it.
      </p>
    </aside>

    <!-- The kit component. Content supplied via #block. -->
    <div
      class="flex min-h-0 min-w-0 flex-1 p-4"
      :class="edit ? 'bg-[radial-gradient(circle_at_1px_1px,var(--color-line)_1px,transparent_0)] bg-[length:22px_22px]' : ''"
    >
      <LayoutCanvas v-model="layout" :edit="edit">
        <template #block="{ block, edit: inEdit, remove }">
          <DemoBlock
            :title="titleOf(block)"
            :accent="accentOf(block)"
            :draggable-head="inEdit"
            :removable="inEdit"
            @remove="remove"
          />
        </template>
      </LayoutCanvas>
    </div>
  </div>
</template>
