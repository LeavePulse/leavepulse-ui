<script lang="ts">
// The root class is merged with the consumer's (useMergedAttrs).
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A value that "decrypts" into place: each character churns through random
 * glyphs and settles, left to right or all at once.
 *
 * For values that are produced rather than read: a freshly generated API key,
 * a hash a job returned, an invite code. Plain text that swaps says nothing
 * about where it came from; the churn says "this was just made".
 *
 *   <LpScramble :value="token" class="font-mono" />
 *   <LpScramble value="ACCESS GRANTED" trigger="hover" order="together" />
 *
 * The width holds still while it churns: every position is sized by the
 * character it will settle on (an invisible copy), and the random glyph is
 * drawn over it, so even a proportional font does not jitter. A value that
 * changes length eases its width (LpShift). Monospace still reads best: the
 * glyphs then fill their cells exactly.
 *
 * Screen readers get the value once, as text; the churning cells are hidden
 * from them, so nobody hears forty random letters.
 *
 * The clock lives in `useScramble`, for a component that wants the effect on
 * its own markup.
 */
import { onMounted, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useReveal } from "../composables/useReveal"
import { useScramble } from "../composables/useScramble"
import LpShift from "./LpShift.vue"

const props = withDefaults(
  defineProps<{
    /** The value the text settles on. */
    value: string
    /**
     * What starts a scramble besides a change of `value`:
     * `reveal` the first time it is on screen (a key below the fold decrypts
     * when it is scrolled to), `mount` at once, `hover` each time the pointer
     * comes in (a teaser), `none` only on changes and `play()`.
     */
    trigger?: "reveal" | "mount" | "hover" | "none"
    /** Scramble travel time in ms. */
    duration?: number
    /** `sequential` decodes left to right; `together` lands every position at the end. */
    order?: "sequential" | "together"
    /** Glyph pool to churn through. Defaults to upper case, digits and a few symbols. */
    glyphs?: string
    /** Scramble when `value` changes. Off: a new value lands at once. */
    animateChanges?: boolean
    /** Element to render. */
    as?: string
  }>(),
  { trigger: "reveal", duration: 900, order: "sequential", animateChanges: true, as: "span" },
)

const emit = defineEmits<{
  /** A scramble landed on the value. */
  done: []
}>()

const { class: rootClass, attrs: rest } = useMergedAttrs(() => "lp-scramble inline-block whitespace-pre align-baseline")

// Under reduced motion the value shows as is from the first paint, rather than
// a mask that is replaced a frame later.
const masked = (props.trigger === "reveal" || props.trigger === "mount") && !prefersReducedMotion()
const { cells, running, play } = useScramble(() => props.value, {
  duration: () => props.duration,
  order: () => props.order,
  glyphs: () => props.glyphs,
  onChange: () => props.animateChanges,
  start: masked ? "masked" : "settled",
  onDone: () => emit("done"),
})

const { el, revealed } = useReveal({ immediate: () => props.trigger !== "reveal" })
watch(revealed, (seen) => seen && props.trigger === "reveal" && play())
onMounted(() => {
  if (props.trigger === "mount" || (props.trigger === "reveal" && revealed.value)) play()
})

function onEnter() {
  if (props.trigger === "hover" && !running.value) play()
}

defineExpose({ play })
</script>

<template>
  <component :is="as" ref="el" :class="rootClass" v-bind="rest" @pointerenter="onEnter">
    <span class="sr-only">{{ value }}</span>
    <LpShift axis="width" class="inline-block align-baseline" aria-hidden="true">
      <template v-for="(cell, i) in cells" :key="i">
        <template v-if="cell.settled">{{ cell.char }}</template>
        <span v-else class="lp-scramble__cell relative inline-block"
          ><span class="invisible">{{ cell.sizer }}</span
          ><span class="absolute inset-0 text-center opacity-60">{{ cell.char }}</span></span
        >
      </template>
    </LpShift>
  </component>
</template>
