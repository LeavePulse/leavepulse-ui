<script setup lang="ts">
// Horizontal/vertical rule, optionally with a centered label.
defineProps<{ vertical?: boolean; label?: string }>()
</script>

<template>
  <div
    v-if="vertical"
    class="mx-1 w-px shrink-0 self-stretch bg-line"
    role="separator"
    aria-orientation="vertical"
  />
  <div v-else class="flex items-center gap-3" role="separator">
    <span class="h-px flex-1 bg-line" />
    <span v-if="label || $slots.default" class="text-xs text-muted">
      <slot>{{ label }}</slot>
    </span>
    <span v-if="label || $slots.default" class="h-px flex-1 bg-line" />
  </div>
</template>
