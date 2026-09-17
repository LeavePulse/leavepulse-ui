<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it a second
// time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import LpIcon from "./LpIcon.vue"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = defineProps<{
  icon?: string
  title: string
  description?: string
  /**
   * Tightens the block for empty states nested inside a card or a panel,
   * where the full-page padding would dwarf its container.
   */
  compact?: boolean
}>()

// The empty state pads itself generously, which is right on a page and wrong
// inside a small card — `class="py-2"` has to reach the root rather than lose
// a coin toss with stylesheet order.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "flex flex-col items-center px-6 text-center",
    props.compact ? "gap-2 py-6" : "gap-3 py-12",
  ].join(" "),
)
</script>

<template>
  <div
    :class="rootClass"
    v-bind="rest"
  >
    <div
      v-if="icon"
      class="flex items-center justify-center rounded-pill bg-surface-soft text-muted"
      :class="compact ? 'size-9' : 'size-12'"
    >
      <LpIcon :name="icon" :size="compact ? 16 : 22" />
    </div>
    <div class="flex flex-col gap-1">
      <p class="font-semibold text-ink" :class="compact ? 'text-sm' : ''">{{ title }}</p>
      <p v-if="description" class="max-w-sm text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="mt-1"><slot /></div>
  </div>
</template>
