<script setup lang="ts">
/*
 * The small x of the kit. On a panel it has a target of its own and a focus
 * ring; `inline`, inside a field, it sits flush and the field holds the focus.
 */
import LpIcon from "./LpIcon.vue"
import { CLOSE_ICON } from "./dropdown"

defineProps<{ label: string; inline?: boolean }>()
</script>

<template>
  <button
    type="button"
    class="lp-tap group flex shrink-0 items-center text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:text-ink"
    :class="inline ? undefined : 'rounded-inner p-1 focus-visible:ring-2 focus-visible:ring-ring'"
    :aria-label="label"
  >
    <LpIcon name="lucide:x" :size="16" :class="CLOSE_ICON" />
  </button>
</template>
