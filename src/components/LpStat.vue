<script setup lang="ts">
// Stat tile: dot + caps label, big mono value, subtitle. A product pattern,
// fully token-driven — re-skins with the active theme.
import LpIcon from "./LpIcon.vue"

defineProps<{
  label: string
  value: string
  hint?: string
  icon?: string
  online?: boolean
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span v-if="online" class="size-1.5 rounded-full bg-action" />
      <LpIcon v-if="icon" :name="icon" :size="14" class="text-muted" />
      <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {{ label }}
      </span>
    </div>
    <span class="font-mono text-3xl font-medium tracking-tight text-ink">
      {{ value }}
    </span>
    <span v-if="hint" class="text-sm text-muted">{{ hint }}</span>
  </div>
</template>
