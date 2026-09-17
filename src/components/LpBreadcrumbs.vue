<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import type { Component } from "vue"
import LpIcon from "./LpIcon.vue"
import { useMergedAttrs } from "../composables/useMergedClass"

export interface Crumb {
  label: string
  href?: string
  /** Destination for router links; passed straight to the `as` component. */
  to?: string | Record<string, unknown>
  /** Leading icon, for crumbs that carry a glyph (a home root, a section). */
  icon?: string
}

withDefaults(
  defineProps<{
    items: Crumb[]
    /**
     * Root element/component for linked crumbs. Defaults to a native <a>;
     * pass a router link component to keep client-side navigation.
     */
    as?: string | Component
  }>(),
  { as: "a" },
)
defineEmits<{ (e: "navigate", item: Crumb, index: number): void }>()

// The trail sets its own gap, which a dense header bar needs to reduce.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex items-center gap-1.5 text-sm",
)
</script>

<template>
  <nav
    :class="rootClass"
    v-bind="rest" aria-label="Breadcrumb">
    <template v-for="(item, i) in items" :key="i">
      <LpIcon
        v-if="i > 0"
        name="lucide:chevron-right"
        :size="14"
        class="text-muted"
      />
      <component
        :is="as"
        v-if="(item.href || item.to) && i < items.length - 1"
        :href="as === 'a' ? item.href : undefined"
        :to="as === 'a' ? undefined : item.to"
        class="inline-flex items-center gap-1.5 rounded-xs text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        @click="$emit('navigate', item, i)"
      >
        <LpIcon v-if="item.icon" :name="item.icon" :size="14" />
        {{ item.label }}
      </component>
      <span
        v-else
        class="inline-flex items-center gap-1.5"
        :class="i === items.length - 1 ? 'text-ink' : 'text-muted'"
      >
        <LpIcon v-if="item.icon" :name="item.icon" :size="14" />
        {{ item.label }}
      </span>
    </template>
  </nav>
</template>
