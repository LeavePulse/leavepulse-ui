<script setup lang="ts">
import LpIcon from "./LpIcon.vue"

defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <div
      v-if="icon"
      class="flex size-12 items-center justify-center rounded-pill bg-surface-soft text-muted"
    >
      <LpIcon :name="icon" :size="22" />
    </div>
    <div class="flex flex-col gap-1">
      <p class="font-semibold text-ink">{{ title }}</p>
      <p v-if="description" class="max-w-sm text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="mt-1"><slot /></div>
  </div>
</template>
