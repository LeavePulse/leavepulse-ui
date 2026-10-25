<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * The kit's loading indicator: a spinner, three dots or an indeterminate bar.
 *
 * Every component that waits used to draw its own (a lucide loader-circle
 * with `animate-spin`, toned by hand), so each one blinked on fast loads in
 * its own way and none told a screen reader anything. This one owns the three
 * things they all needed and none had:
 *
 *   - timing: `delay` before it appears, so a load that finishes quickly shows
 *     nothing at all, and `minVisible` once it has, so it never flashes
 *     (see useLoadingGate);
 *   - a status: role="status" with a polite label, so "loading" is announced
 *     rather than only drawn;
 *   - reduced motion: a spinner that simply stops reads as a frozen page, so
 *     under reduced motion every variant breathes (a slow fade) instead of
 *     moving — a change of state the eye can still see, without travel.
 *
 *   <LpLoader />                                   inline spinner
 *   <LpLoader variant="dots" label="Connecting" />
 *   <LpLoader :active="loading"><Results /></LpLoader>   placeholder → content
 *
 * Determinate progress (a known fraction) is LpProgress; this is for waits
 * whose length is unknown.
 */
import { computed, useSlots } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useLoadingGate } from "../composables/useLoadingGate"
import { useMergedAttrs } from "../composables/useMergedClass"
import LoaderMark from "./LoaderMark.vue"
import LpSwap from "./LpSwap.vue"
import { toneLook, type ToneName } from "./tone"

export type LoaderVariant = "spinner" | "dots" | "bar"
export type LoaderSize = "inline" | "sm" | "md" | "lg"
/** `current` inherits the text colour around it; the rest are the kit's tones (tone.ts). */
export type LoaderTone = "current" | ToneName
export type LoaderLabels = { loading: string }

const props = withDefaults(
  defineProps<{
    /**
     * `spinner` for a spot (a button, a row, a field); `dots` for something
     * conversational (typing, connecting); `bar` for a region across its width
     * (the top of a card or a page).
     */
    variant?: LoaderVariant
    /**
     * `inline` sizes the mark from the font (a 1em spinner), so it fits a
     * button or a line of text at whatever size that text is.
     */
    size?: LoaderSize
    /**
     * `current` takes the surrounding text colour, which is what a loader
     * inside a button or a coloured badge wants; the others pin a kit tone.
     */
    tone?: LoaderTone
    /**
     * Whether work is under way. Off, the loader is not shown (or, with a
     * default slot, the content is). Leave it on and mount the loader with
     * `v-if` when it has nothing to swap with.
     */
    active?: boolean
    /**
     * Ms of loading before anything appears. Most requests finish inside 150
     * ms; a spinner for those is a blink, not information. 0 shows at once —
     * the right call where the trigger already acknowledged the click (a
     * button that faded its label).
     */
    delay?: number
    /** Ms the loader stays once shown, so a load ending just after it appeared does not blink it away. */
    minVisible?: number
    /**
     * Visible text beside the indicator. Without it the indicator is still
     * announced, with the `loading` label, to screen readers only.
     */
    label?: string
    /** Spinner only: draw the faint full circle the arc runs along. */
    track?: boolean
    labels?: Partial<LoaderLabels>
  }>(),
  {
    variant: "spinner",
    size: "md",
    tone: "current",
    active: true,
    delay: 150,
    minVisible: 400,
    track: false,
  },
)

const text = useLabels<LoaderLabels>("loader", { loading: "Loading…" }, () => props.labels)
const shown = useLoadingGate(() => props.active, {
  delay: () => props.delay,
  minVisible: () => props.minVisible,
})

const slots = useSlots()
const wraps = computed(() => !!slots.default)


/*
 * The consumer's class lands on the indicator's own box (the status element),
 * so `class="w-40"` narrows a bar and `class="text-lg"` scales an `inline`
 * loader, rather than styling a wrapper around them.
 */
const { class: rootClass, attrs: rest } = useMergedAttrs(() => {
  const tone = props.tone === "current" ? "" : toneLook(props.tone).text
  if (props.variant === "bar") {
    return `flex w-full min-w-12 flex-col gap-1.5 ${tone}`
  }
  return `inline-flex items-center gap-2 align-middle ${tone}`
})

const spoken = computed(() => props.label || text.value.loading)
</script>

<template>
  <div v-if="wraps" :aria-busy="shown ? 'true' : undefined">
    <LpSwap :swap-key="shown ? 'loading' : 'content'">
      <div v-if="shown" class="flex justify-center py-8">
        <LoaderMark :class="rootClass" v-bind="rest" :variant="variant" :size="size" :track="track" :label="label" :spoken="spoken" />
      </div>
      <slot v-else />
    </LpSwap>
  </div>

  <Transition
    v-else
    enter-active-class="transition-opacity duration-(--duration-fast) ease-(--ease-emphasized) motion-reduce:transition-none"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-(--duration-fast) ease-out motion-reduce:transition-none"
    leave-to-class="opacity-0"
  >
    <LoaderMark v-if="shown" :class="rootClass" v-bind="rest" :variant="variant" :size="size" :track="track" :label="label" :spoken="spoken" />
  </Transition>
</template>
