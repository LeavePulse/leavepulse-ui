<script setup lang="ts">
/*
 * Loading placeholder, in two shapes.
 *
 * Bare, it is one pulsing block and the consumer's classes size it:
 *
 *   <LpSkeleton class="h-4 w-40" />
 *
 * Given content, it becomes a WRAPPER instead: it stops pulsing itself and
 * lends the pulse to any `.lp-skeleton-item` inside it, however deeply nested.
 *
 *   <LpSkeleton class="space-y-3">
 *     <div class="flex items-center gap-3">
 *       <div class="lp-skeleton-item size-10 rounded-pill" />
 *       <div class="lp-skeleton-item h-4 w-32" />
 *     </div>
 *   </LpSkeleton>
 *
 * The second form exists because a real skeleton is a LAYOUT, not a stack of
 * bars: a profile header is an avatar beside two lines of different widths
 * above a button. Expressed as one component per block, that is a dozen
 * <LpSkeleton> tags whose grid has to be rebuilt by hand and kept in step with
 * the markup it stands in for. As a wrapper, the skeleton can be the real
 * markup with its content swapped for plain divs — same flex, same gaps, same
 * responsive classes — so it keeps matching the thing it is standing in for.
 *
 * Consumers had already arrived at this and built it themselves; it belongs
 * here, where every app gets it.
 */
import { computed, useSlots } from "vue"

defineProps<{ rounded?: "control" | "card" | "pill" }>()

const slots = useSlots()

/* A wrapper must not pulse as a whole — the container would flash behind its
   own items. Only the bare form is a placeholder in its own right. */
const isBlock = computed(() => !slots.default)
</script>

<template>
  <div
    aria-hidden="true"
    class="lp-skeleton"
    :class="[
      // `rounded` describes the PLACEHOLDER's own shape, so it only applies to
      // the bare form. A wrapper is invisible, so rounding it would clip the
      // layout inside without anything being drawn to justify the corner.
      isBlock
        ? [
            'lp-skeleton-item bg-surface-soft',
            {
              'rounded-control': rounded === 'control' || !rounded,
              'rounded-card': rounded === 'card',
              'rounded-pill': rounded === 'pill',
            },
          ]
        : '',
    ]"
  >
    <slot />
  </div>
</template>

<style>
/*
 * Unscoped: the items are written by the CONSUMER, inside the slot, so they
 * carry no scope attribute of this component — a scoped rule could never reach
 * them. Namespaced instead, and only ever applied under `.lp-skeleton`.
 *
 * One shared animation name means every item on the page pulses in phase: CSS
 * animations are timed against the document, not against when each element
 * mounted, so a skeleton that fills in progressively stays in step with itself.
 */
.lp-skeleton-item {
  animation: lp-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Items nested anywhere inside a wrapper, at any depth. */
.lp-skeleton .lp-skeleton-item {
  animation: lp-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes lp-skeleton-pulse {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-skeleton-item {
    animation: none;
    opacity: 0.75;
  }
}
</style>
