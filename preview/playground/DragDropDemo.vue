<script setup lang="ts">
import { ref } from "vue"
import { LpAvatar, LpBadge, useDragDrop } from "../../src"

const root = ref<HTMLElement | null>(null)
const teams = ref<Record<string, string[]>>({
  Radiant: ["Ada", "Linus", "Grace"],
  Dire: ["Ken", "Barbara"],
  Bench: ["Alan", "Margaret"],
})
const limit = 3

const { dragging, over } = useDragDrop({
  root,
  canDrop: (_name, team) => team === "Bench" || teams.value[team]!.length < limit,
  onDrop: (name, team, from) => {
    if (from) teams.value[from] = teams.value[from]!.filter((n) => n !== name)
    teams.value[team] = [...teams.value[team]!, name]
  },
})
</script>

<template>
  <div ref="root" class="flex w-[40rem] max-w-full flex-col gap-3">
    <div class="grid gap-3 sm:grid-cols-3">
      <section
        v-for="(names, team) in teams"
        :key="team"
        :data-drop-zone="team"
        class="flex min-h-44 flex-col gap-2 rounded-card border border-line p-3 transition-colors data-[drop-over]:border-brand data-[drop-over]:bg-brand-soft/40"
      >
        <p class="flex items-center justify-between text-sm font-medium text-ink">
          {{ team }}
          <LpBadge size="sm" :tone="team !== 'Bench' && names.length >= limit ? 'success' : 'neutral'">
            {{ team === "Bench" ? names.length : `${names.length}/${limit}` }}
          </LpBadge>
        </p>
        <div
          v-for="name in names"
          :key="name"
          :data-drag-key="name"
          class="flex cursor-grab items-center gap-2 rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink data-[drag-source]:opacity-40"
        >
          <LpAvatar size="xs" :fallback="name.slice(0, 2)" />
          {{ name }}
        </div>
      </section>
    </div>
    <p class="text-xs text-muted">Dragging: {{ dragging ?? "nothing" }} · over: {{ over ?? "no zone" }}. A full team refuses a drop; Escape cancels.</p>
  </div>
</template>
