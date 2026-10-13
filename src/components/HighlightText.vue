<script setup lang="ts">
/*
 * Text that may arrive already split into matched and unmatched runs (the
 * palette preview slot's `highlight(text)`), drawn with the same <mark> the
 * palette's rows use. A plain string is drawn as is.
 */
import type { HighlightPart } from "./commandSearch"

defineProps<{ text: string | HighlightPart[] }>()
</script>

<template>
  <template v-if="typeof text === 'string'">{{ text }}</template>
  <template v-else>
    <template v-for="(part, index) in text" :key="index">
      <mark v-if="part.hit" class="lp-highlight">{{ part.text }}</mark>
      <template v-else>{{ part.text }}</template>
    </template>
  </template>
</template>

<style>
.lp-highlight {
  border-radius: 2px;
  background: color-mix(in srgb, var(--color-brand) 25%, transparent);
  color: var(--color-ink);
}
</style>
