<script setup lang="ts">
// Loading placeholder. Sizing comes from the consumer's classes (w-/h-).
defineProps<{ rounded?: "control" | "card" | "pill" }>()
</script>

<template>
  <div
    aria-hidden="true"
    class="animate-pulse bg-surface-soft"
    :class="{
      'rounded-control': rounded === 'control' || !rounded,
      'rounded-card': rounded === 'card',
      'rounded-pill': rounded === 'pill',
    }"
  />
</template>
