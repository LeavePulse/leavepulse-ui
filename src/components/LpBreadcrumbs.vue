<script setup lang="ts">
import LpIcon from "./LpIcon.vue"

export interface Crumb {
  label: string
  href?: string
}

defineProps<{ items: Crumb[] }>()
defineEmits<{ (e: "navigate", item: Crumb, index: number): void }>()
</script>

<template>
  <nav class="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
    <template v-for="(item, i) in items" :key="i">
      <LpIcon
        v-if="i > 0"
        name="lucide:chevron-right"
        :size="14"
        class="text-muted"
      />
      <a
        v-if="item.href && i < items.length - 1"
        :href="item.href"
        class="rounded-xs text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        @click="$emit('navigate', item, i)"
      >
        {{ item.label }}
      </a>
      <span v-else :class="i === items.length - 1 ? 'text-ink' : 'text-muted'">
        {{ item.label }}
      </span>
    </template>
  </nav>
</template>
