<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A hairline along the edge of a card, table or page that says "something is
 * happening here": a sweep while the length of the work is unknown, a fill once
 * it is, a quick run to the end and a fade when it is done.
 *
 * Not LpProgress. LpProgress is a reading the user looks AT: it has a track,
 * a caption, a value that persists. This is ambient: it has no track, lies over
 * the edge of something else without taking space, is absent while idle, waits
 * a beat before appearing so a fast load never flashes it, and on completion
 * finishes its run before fading, so "done" is seen rather than the line just
 * vanishing mid-way.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { durationToken, prefersReducedMotion } from "../composables/easing"
import { useLoadingGate } from "../composables/useLoadingGate"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { meterFraction, TONE_COLOR, type MeterTone } from "./meter"

const props = withDefaults(
  defineProps<{
    /** Work is in flight. Going false finishes the line and fades it out. */
    active?: boolean
    /** Known progress. Unset or null: the length of the work is unknown, and the line sweeps. */
    value?: number | null
    max?: number
    tone?: MeterTone
    /**
     * Where it lies. `top` and `bottom` are absolute, over the edge of the
     * nearest positioned ancestor (give the card `relative`), so showing it
     * moves nothing; `inline` takes its own line in the flow.
     */
    placement?: "top" | "bottom" | "inline"
    /** Thickness in px. */
    height?: number
    /**
     * Ms to wait before showing. Work that finishes within it never shows the
     * line at all: a flash of activity for a 90 ms request is noise.
     */
    delay?: number
    labels?: Partial<{ busy: string }>
  }>(),
  { active: true, value: null, max: 100, tone: "brand", placement: "top", height: 2, delay: 150 },
)

const text = useLabels("activityLine", { busy: "Loading" }, () => props.labels)

/*
 * Whether it is up at all is the same question LpLoader answers, so it is
 * answered the same way (useLoadingGate): wait `delay` before appearing, and
 * once up stay long enough to be read as a state rather than a blink.
 *
 * On top of that the line has an exit of its own:
 * idle → running → (gate closes) → finishing → idle. `finishing` is the run to
 * the end and the fade after it; then the element is gone.
 */
const gated = useLoadingGate(() => props.active, {
  delay: () => (prefersReducedMotion() ? 0 : props.delay),
  minVisible: 300,
})
const phase = ref<"idle" | "running" | "finishing">("idle")
let doneTimer: ReturnType<typeof setTimeout> | undefined

watch(
  gated,
  (on) => {
    clearTimeout(doneTimer)
    if (on) {
      phase.value = "running"
      return
    }
    if (phase.value === "idle") return
    phase.value = "finishing"
    // The run to the end (slow), then the fade (medium), then gone.
    const hold = prefersReducedMotion() ? 0 : durationToken("duration-medium") * 3
    doneTimer = setTimeout(() => (phase.value = "idle"), hold)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(doneTimer))

const determinate = computed(() => props.value != null)
const fraction = computed(() =>
  phase.value === "finishing" ? 1 : determinate.value ? meterFraction(props.value as number, 0, props.max) : 0,
)

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "pointer-events-none overflow-hidden",
    props.placement === "inline" ? "relative block w-full" : "z-[2]",
    "transition-opacity duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none",
  ].join(" "),
)

/*
 * Edge placement goes inline, not through `absolute top-0` classes: a card's
 * skin (`.lp-skin-panel > *`) makes every direct child `position: relative`
 * with a more specific selector than a utility class, which collapsed the line
 * to zero width exactly where it is meant to be used, as a card's first child.
 */
const edge = computed(() =>
  props.placement === "inline"
    ? {}
    : { position: "absolute" as const, left: 0, right: 0, [props.placement]: 0 },
)

// The fade starts once the run to the end is over, not with it.
const opacity = computed(() => (phase.value === "running" ? 1 : 0))
const fadeDelay = computed(() => (phase.value === "finishing" ? "var(--duration-slow)" : "0ms"))
</script>

<template>
  <span
    v-if="phase !== 'idle' || placement === 'inline'"
    role="progressbar"
    :aria-label="text.busy"
    :aria-hidden="phase === 'idle' ? 'true' : undefined"
    :aria-busy="phase === 'running' ? 'true' : undefined"
    :aria-valuenow="determinate && phase !== 'idle' ? (value as number) : undefined"
    :aria-valuemin="determinate ? 0 : undefined"
    :aria-valuemax="determinate ? max : undefined"
    :class="rootClass"
    :style="{ ...edge, height: `${height}px`, opacity, transitionDelay: fadeDelay, '--lp-al-color': TONE_COLOR[tone] }"
    v-bind="rest"
  >
    <!-- The sweep: a short bright segment crossing the edge. Faded rather than
         cut when the work turns determinate or ends. -->
    <span
      class="lp-activity-sweep absolute inset-y-0 left-0 w-2/5 rounded-pill transition-opacity duration-(--duration-medium)"
      :class="determinate || phase === 'finishing' ? 'opacity-0' : 'opacity-100'"
    />
    <!-- The fill, scaled rather than sized, so it eases on the compositor. A
         shimmer runs along it while it is still filling. -->
    <span
      class="absolute inset-0 origin-left rounded-pill transition-transform duration-(--duration-slow) ease-(--ease-emphasized) motion-reduce:transition-none"
      :style="{ transform: `scaleX(${fraction})`, backgroundColor: 'var(--lp-al-color)' }"
    >
      <span v-if="determinate && phase === 'running'" class="lp-activity-shimmer absolute inset-0" />
    </span>
  </span>
</template>

<style>
/*
 * Unscoped and namespaced, like the other kit animations: the keyframes are
 * shared by every line on the page.
 */
.lp-activity-sweep {
  background: linear-gradient(90deg, transparent, var(--lp-al-color) 35%, var(--lp-al-color) 65%, transparent);
  animation: lp-activity-sweep 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes lp-activity-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

.lp-activity-shimmer {
  background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-surface) 45%, transparent), transparent);
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: lp-activity-shimmer 1.6s linear infinite;
}

@keyframes lp-activity-shimmer {
  0% {
    background-position: -40% 0;
  }
  100% {
    background-position: 140% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* No travel: the sweep becomes a steady full-width tint, which still says busy. */
  .lp-activity-sweep {
    animation: none;
    width: 100%;
    opacity: 0.5;
    background: var(--lp-al-color);
  }
  .lp-activity-shimmer {
    animation: none;
    display: none;
  }
}
</style>
