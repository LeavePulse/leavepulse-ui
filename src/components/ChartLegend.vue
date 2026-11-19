<script setup lang="ts">
/*
 * LpChart's legend: one button per series, which also hides and shows it.
 * A series on the right axis carries a mark saying so.
 */
import LegendSwatch from "./LegendSwatch.vue"

defineProps<{
  series: readonly { id: string; name: string; color: string; axis: "left" | "right" }[]
  hidden: ReadonlySet<string>
  /** Mark the series measured on the right axis. */
  rightAxis: boolean
  rightAxisLabel: string
}>()

const emit = defineEmits<{ (e: "toggle", id: string): void }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    <button
      v-for="s in series"
      :key="s.id"
      type="button"
      class="group flex cursor-pointer items-center gap-1.5 rounded-inner text-xs outline-none transition-opacity duration-fast focus-visible:ring-2 focus-visible:ring-ring"
      :class="hidden.has(s.id) ? 'opacity-40' : ''"
      :aria-pressed="!hidden.has(s.id)"
      @click="emit('toggle', s.id)"
    >
      <LegendSwatch :color="s.color" />
      <span class="text-muted-strong group-hover:text-ink">{{ s.name }}</span>
      <span
        v-if="rightAxis && s.axis === 'right'"
        class="text-[10px] text-muted"
        :title="rightAxisLabel"
      >
        ↗
      </span>
    </button>
  </div>
</template>
