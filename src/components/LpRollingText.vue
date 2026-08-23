<script setup lang="ts">
/*
 * Text that CHANGES rather than being replaced.
 *
 * Swapping a label in place gives the reader nothing: they see the new value
 * and have no idea it used to be something else. Moving the old one out while
 * the new one arrives makes the change itself visible — which is the whole
 * point in a spot that updates while being watched: a donut's centre following
 * the hovered slice, a live counter's caption, a status line.
 *
 * Two motions, because they say different things:
 *
 *   "slide" — the old line leaves upward, the new one arrives from below (or
 *     the reverse, per `direction`). Reads as a reel advancing: same kind of
 *     thing, next item. The default.
 *   "flip"  — the box turns on its X axis, the old face rotating away and the
 *     new one turning in behind it. Reads as one object showing another side;
 *     heavier, so it suits a headline that changes rarely.
 *
 *   <LpRollingText :value="label" />
 *   <LpRollingText :value="status" mode="flip" />
 */
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    /** The text. A change to this is what triggers the transition. */
    value: string | number
    mode?: "slide" | "flip"
    /** Which way "slide" travels. `up` moves the old text up and out. */
    direction?: "up" | "down"
    duration?: number
    /**
     * Alignment inside the clipped box, for when the two values differ in
     * width — a value that grows shouldn't shove its neighbours.
     */
    align?: "start" | "center" | "end"
  }>(),
  { mode: "slide", direction: "up", duration: 320, align: "center" },
)

/* The key is what makes Vue treat a new value as a new element rather than a
   text patch — without it there is nothing to transition between. */
const key = computed(() => String(props.value))

const name = computed(() =>
  props.mode === "flip" ? "lp-roll-flip" : `lp-roll-${props.direction}`,
)

const justify = computed(
  () =>
    ({ start: "justify-start", center: "justify-center", end: "justify-end" })[props.align],
)

const style = computed(() => ({
  "--lp-roll-duration": `${props.duration}ms`,
  // The leaving copy is taken out of flow so both can occupy the same line;
  // without this the box would grow to hold two lines mid-transition.
  "--lp-roll-perspective": props.mode === "flip" ? "300px" : "none",
}))
</script>

<template>
  <span
    class="lp-roll relative inline-flex overflow-hidden align-bottom"
    :class="justify"
    :style="style"
  >
    <Transition :name="name">
      <span :key="key" class="lp-roll__item">
        <slot :value="value">{{ value }}</slot>
      </span>
    </Transition>
  </span>
</template>

<style>
/*
 * Unscoped on purpose: the transition classes are applied to the element Vue
 * clones during the leave phase, which a scoped attribute selector doesn't
 * reliably reach. Everything is namespaced under .lp-roll instead.
 */
.lp-roll {
  perspective: var(--lp-roll-perspective);
}

.lp-roll__item {
  display: inline-block;
  white-space: nowrap;
  backface-visibility: hidden;
}

/* The outgoing copy leaves the flow so the incoming one keeps the baseline. */
.lp-roll-up-leave-active,
.lp-roll-down-leave-active,
.lp-roll-flip-leave-active {
  position: absolute;
  inset: 0;
}

.lp-roll-up-enter-active,
.lp-roll-up-leave-active,
.lp-roll-down-enter-active,
.lp-roll-down-leave-active {
  transition:
    transform var(--lp-roll-duration) var(--ease-emphasized),
    opacity var(--lp-roll-duration) var(--ease-emphasized);
}

.lp-roll-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.lp-roll-up-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.lp-roll-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}
.lp-roll-down-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.lp-roll-flip-enter-active,
.lp-roll-flip-leave-active {
  transition:
    transform var(--lp-roll-duration) var(--ease-emphasized),
    opacity calc(var(--lp-roll-duration) * 0.6) linear;
  transform-origin: center center;
}

/* Quarter turns, not halves: the two faces meet edge-on at the midpoint, so
   the box reads as turning rather than as one label briefly vanishing. */
.lp-roll-flip-enter-from {
  transform: rotateX(-90deg);
  opacity: 0;
}
.lp-roll-flip-leave-to {
  transform: rotateX(90deg);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lp-roll-up-enter-active,
  .lp-roll-up-leave-active,
  .lp-roll-down-enter-active,
  .lp-roll-down-leave-active,
  .lp-roll-flip-enter-active,
  .lp-roll-flip-leave-active {
    transition: none;
  }
}
</style>
