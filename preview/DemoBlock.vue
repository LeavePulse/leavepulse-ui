<script setup lang="ts">
/*
 * Demo block content. Chrome (tab bar, title, close, drag handle) is now drawn
 * by the canvas's tab bar via the registry — a block is just content.
 */
defineProps<{
  title: string
  accent?: string
}>()
</script>

<template>
  <div class="flex h-full w-full flex-col gap-2.5 overflow-auto bg-surface-raised p-3.5">
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full" :style="{ background: accent ?? 'var(--color-brand)' }" />
      <span class="text-[13px] font-semibold text-ink">{{ title }}</span>
    </div>
    <div class="h-12 rounded-md bg-surface-soft" />
    <div class="h-3.5 rounded-md bg-surface-soft" />
    <div class="h-3.5 w-3/5 rounded-md bg-surface-soft" />
  </div>
</template>
