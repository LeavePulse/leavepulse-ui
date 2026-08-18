<script setup lang="ts">
import LpIcon from "./LpIcon.vue"

defineProps<{
  icon?: string
  title: string
  description?: string
  /**
   * Tightens the block for empty states nested inside a card or a panel,
   * where the full-page padding would dwarf its container.
   */
  compact?: boolean
}>()
</script>

<template>
  <div
    class="flex flex-col items-center px-6 text-center"
    :class="compact ? 'gap-2 py-6' : 'gap-3 py-12'"
  >
    <div
      v-if="icon"
      class="flex items-center justify-center rounded-pill bg-surface-soft text-muted"
      :class="compact ? 'size-9' : 'size-12'"
    >
      <LpIcon :name="icon" :size="compact ? 16 : 22" />
    </div>
    <div class="flex flex-col gap-1">
      <p class="font-semibold text-ink" :class="compact ? 'text-sm' : ''">{{ title }}</p>
      <p v-if="description" class="max-w-sm text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="mt-1"><slot /></div>
  </div>
</template>
