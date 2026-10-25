<script lang="ts">
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * LpRevealOnScroll — content that arrives when it is first scrolled into view.
 *
 *   <LpRevealOnScroll preset="rise" :stagger="60">
 *     <LpCard v-for="item in items" :key="item.id">…</LpCard>
 *   </LpRevealOnScroll>
 *
 * useReveal answers "has this been seen yet"; this is the entrance itself for
 * content that has no animation of its own — a section of a landing page, a
 * block of cards, a settings group further down a long page. Components that
 * already animate their own arrival (charts, progress, number flows) gate it
 * on useReveal themselves and need no wrapper.
 *
 * `stagger` animates the direct children one after another instead of the
 * block as a whole — the wrapper is then just their parent, so put it where a
 * grid or flex container would be and give it that layout through `class`.
 *
 * Plays once: content that scrolls away and back has already arrived. Reduced
 * motion shows everything at once. Animations run through the Web Animations
 * API on transform/opacity/filter only, so they never trigger layout.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { easingToken, prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useReveal } from "../composables/useReveal"
import { revealFrom, revealTo, staggerDelay, type RevealDirection, type RevealPreset } from "./reveal"

const props = withDefaults(
  defineProps<{
    /** How the content appears. `rise` suits most blocks; `fade` is the quietest. */
    preset?: RevealPreset
    /** The way the content travels for `rise` and `blur`: `up` comes from below. */
    direction?: RevealDirection
    /** Travel distance in px. */
    distance?: number
    /** Milliseconds to wait after the block is seen. */
    delay?: number
    /** Milliseconds per entrance. */
    duration?: number
    /**
     * Milliseconds between consecutive direct children. 0 animates the block
     * as one piece. The steps stop growing after ten children, so long lists
     * still finish quickly.
     */
    stagger?: number
    /** Show at once, without waiting or animating — for content already known to be on screen. */
    immediate?: boolean
    /** Fraction of the block that must be visible before it plays. */
    threshold?: number
    /** Element to render as. */
    as?: string
  }>(),
  {
    preset: "rise",
    direction: "up",
    distance: 16,
    delay: 0,
    duration: 520,
    stagger: 0,
    immediate: false,
    threshold: 0.15,
    as: "div",
  },
)

const { el, revealed } = useReveal({ immediate: () => props.immediate, threshold: props.threshold })
const host = ref<HTMLElement | null>(null)
watch(host, (node) => (el.value = node))

const { class: classes, attrs: rest } = useMergedAttrs(() => undefined)

// Hidden only until the observer fires; `played` then keeps it visible for
// good, even if the props change afterwards.
const played = ref(false)
const hidden = computed(() => !played.value && !revealed.value)

const running: Animation[] = []

function play(node: HTMLElement) {
  if (props.immediate || prefersReducedMotion() || typeof node.animate !== "function") return
  const from = revealFrom(props.preset, props.direction, props.distance)
  const frames = [from, revealTo(from)]
  const easing = easingToken("ease-emphasized")
  // `backwards` holds each target in its hidden state through its delay, so a
  // staggered child does not flash in before its turn.
  const targets = props.stagger > 0 ? Array.from(node.children) : [node]
  targets.forEach((target, index) => {
    running.push(
      target.animate(frames, {
        duration: props.duration,
        delay: props.stagger > 0 ? staggerDelay(index, props.delay, props.stagger) : props.delay,
        easing,
        fill: "backwards",
      }),
    )
  })
}

watch(
  revealed,
  (seen) => {
    if (!seen || played.value) return
    played.value = true
    // Same tick as removing the hidden state: the animations start from the
    // hidden frame before the browser paints the unhidden one.
    if (host.value) play(host.value)
  },
  { flush: "post", immediate: true },
)

onBeforeUnmount(() => {
  for (const animation of running) animation.cancel()
})
</script>

<template>
  <component :is="as" ref="host" :class="classes" :style="hidden ? { opacity: 0 } : undefined" v-bind="rest">
    <slot />
  </component>
</template>
