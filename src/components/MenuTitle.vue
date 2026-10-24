<script setup lang="ts">
/*
 * The heading row of a menu: what the menu acts on, so a right-click on one of
 * many look-alike rows says which one it caught before anything is chosen.
 * Not an item: it takes no focus or highlight, and long names truncate rather
 * than widening the panel. Internal: LpContextMenu and LpDropdownMenu render it
 * from their `title` props.
 */
import LpIcon from "./LpIcon.vue"

defineProps<{
  title: string
  subtitle?: string
  icon?: string
  image?: string
}>()
</script>

<template>
  <div class="flex max-w-72 min-w-0 items-center gap-2 px-2.5 pt-1.5 pb-2" aria-hidden="true">
    <img v-if="image" :src="image" alt="" class="size-7 shrink-0 rounded-inner object-cover" />
    <span
      v-else-if="icon"
      class="grid size-7 shrink-0 place-items-center rounded-inner bg-surface-soft text-muted"
    >
      <LpIcon :name="icon" :size="15" />
    </span>
    <span class="flex min-w-0 flex-col">
      <span class="truncate text-sm font-medium text-ink">{{ title }}</span>
      <span v-if="subtitle" class="truncate text-xs text-muted">{{ subtitle }}</span>
    </span>
  </div>
  <div class="mb-1 h-px bg-line" role="presentation" />
</template>
