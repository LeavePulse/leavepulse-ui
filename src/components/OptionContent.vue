<script setup lang="ts">
import type { LpOptionBase } from "./options"
import LpIcon from "./LpIcon.vue"

defineProps<{ option: LpOptionBase<string | number> }>()
</script>

<template>
  <span class="flex min-w-0 items-center gap-2.5">
    <img v-if="option.image" :src="option.image" alt="" class="size-6 shrink-0 rounded-full object-cover" />
    <LpIcon v-else-if="option.icon" :name="option.icon" :size="16" class="shrink-0 text-muted" />
    <span class="flex min-w-0 flex-col">
      <span class="truncate">{{ option.label ?? option.value }}</span>
      <span v-if="option.description" class="truncate text-xs text-muted">{{ option.description }}</span>
    </span>
  </span>
</template>
