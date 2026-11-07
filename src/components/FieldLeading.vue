<script setup lang="ts">
/*
 * A field's leading icon: `icon` draws it, the field's own `leading` slot
 * (handed on as this one's default) replaces it. Shared by LpInput and
 * LpNumberField, so the two fields put the same thing in the same place.
 * Renders nothing with neither.
 */
import LpIcon from "./LpIcon.vue"

defineProps<{ icon?: string }>()
</script>

<template>
  <span v-if="$slots.default || icon" class="flex shrink-0 items-center text-muted">
    <slot><LpIcon :name="icon!" :size="16" /></slot>
  </span>
</template>
