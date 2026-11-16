<script setup lang="ts">
/* The kit's mention chip: the label saved with the mention, tinted like a link. */
defineProps<{ kind: string; id: string; label: string }>()
</script>

<template>
  <span class="rounded-md bg-brand-soft px-1 py-px font-medium text-brand">{{ kind === "channel" ? "#" : "@" }}{{ label }}</span>
</template>
