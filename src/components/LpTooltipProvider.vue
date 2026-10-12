<script setup lang="ts">
/*
 * Shared timing for every LpTooltip below it: once one tip is showing, moving
 * to the next opens it without waiting the delay again. Mount once near the
 * app root; tooltips outside any provider keep working on their own.
 */
import { TooltipProvider } from "reka-ui"

withDefaults(
  defineProps<{
    /** Milliseconds before the first tip appears on hover. */
    delay?: number
    /** How long after a tip closes the next one still opens at once. */
    skipDelay?: number
  }>(),
  { delay: 200, skipDelay: 300 },
)
</script>

<template>
  <TooltipProvider :delay-duration="delay" :skip-delay-duration="skipDelay">
    <slot />
  </TooltipProvider>
</template>
