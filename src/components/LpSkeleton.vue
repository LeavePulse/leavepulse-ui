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
 *
 * It does not show for its first moments. Most loads answer within a hundred
 * milliseconds or so, and a placeholder that appears for two frames before the
 * content replaces it reads as a flicker, not as loading: an app that blanked
 * its data on every tab switch blinked a skeleton on every click. So the
 * skeleton takes its space at once (nothing around it jumps) but stays
 * transparent for `--lp-skeleton-delay`, then fades in; a fast answer replaces
 * it before it was ever seen. `immediate` skips the wait, for a placeholder
 * that is the state itself rather than a stand-in for a request in flight.
 */
import { computed, useSlots } from "vue"

defineProps<{
  rounded?: "control" | "card" | "pill"
  /** Show at once instead of after the short wait that hides fast loads. */
  immediate?: boolean
}>()

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
      immediate ? 'lp-skeleton-immediate' : '',
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

/*
 * A block to pulse has to be visible first. The pulse only animates opacity,
 * so an item written as the docs above show it (a size, a radius, no colour)
 * was transparent and the loading state was blank. The default sits in
 * `@layer base`, as the kit's other defaults do (tokens.css, selection.css):
 * an unlayered rule outranks every Tailwind utility whatever its specificity,
 * so a consumer's own background (bg-surface-raised on a soft card) would
 * have lost to it.
 */
@layer base {
  .lp-skeleton-item {
    background-color: var(--color-surface-soft);
  }
}

/*
 * The wait before showing. It animates `filter`, not `opacity`: the pulse below
 * owns `opacity`, and two animations of one property on the same element
 * override each other, so the pulse would cancel the reveal on a bare block.
 * The space is held throughout; only the drawing waits.
 */
.lp-skeleton {
  animation: lp-skeleton-reveal var(--lp-skeleton-fade, 200ms) ease-out var(--lp-skeleton-delay, 250ms) both;
}

.lp-skeleton.lp-skeleton-item {
  animation:
    lp-skeleton-reveal var(--lp-skeleton-fade, 200ms) ease-out var(--lp-skeleton-delay, 250ms) both,
    lp-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.lp-skeleton.lp-skeleton-immediate {
  animation: none;
}

.lp-skeleton.lp-skeleton-item.lp-skeleton-immediate {
  animation: lp-skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes lp-skeleton-reveal {
  from {
    filter: opacity(0);
  }
  to {
    filter: none;
  }
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
  /* Repeats the descendant form: it outranks a bare class, and grouped items
     kept pulsing under reduced motion. */
  .lp-skeleton-item,
  .lp-skeleton .lp-skeleton-item {
    animation: none;
    opacity: 0.75;
  }

  /* No fade under reduced motion, but the wait stays: it is not motion, and
     without it the flicker it exists to prevent comes back. */
  .lp-skeleton,
  .lp-skeleton.lp-skeleton-item {
    animation: lp-skeleton-reveal 1ms linear var(--lp-skeleton-delay, 250ms) both;
  }

  .lp-skeleton.lp-skeleton-immediate,
  .lp-skeleton.lp-skeleton-item.lp-skeleton-immediate {
    animation: none;
  }
}
</style>
