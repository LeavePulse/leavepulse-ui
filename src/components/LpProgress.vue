<script setup lang="ts">
/*
 * One determinate value, drawn as a bar or as a ring. Both are the same data —
 * a fraction of a whole — so they live in one component rather than two: a
 * caller switching a KPI tile from a bar to a dial changes `variant`, not which
 * component it imports.
 *
 * The ring is the bar wrapped into a circle: same tones, same clamping, same
 * reka ProgressRoot underneath (so assistive tech reads a progressbar with a
 * value either way).
 */
import { ProgressIndicator, ProgressRoot } from "reka-ui"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { easeOut, prefersReducedMotion } from "../composables/easing"
import { useReveal } from "../composables/useReveal"
import LpNumberFlow from "./LpNumberFlow.vue"

const props = withDefaults(
  defineProps<{
    value?: number
    max?: number
    /**
     * `"auto"` colours by how full the bar is — calm up to `warnAt`, accent
     * past it, danger past `dangerAt`.
     *
     * A gauge of a finite resource (disk, memory, quota) means something
     * different at 92% than at 12%, and consumers were each re-deriving that
     * with their own palette — which also put raw colours back into components
     * the theme can no longer reach.
     */
    tone?: "brand" | "action" | "danger" | "accent" | "auto"
    /** `auto` tone: the fill fraction, 0–1, where the bar turns accent. */
    warnAt?: number
    /** `auto` tone: the fill fraction, 0–1, where it turns danger. */
    dangerAt?: number
    /**
     * Bar only: a name for what is being measured, printed above the bar. With
     * `caption` it forms the "CPU … 42%" header a usage row wants.
     */
    title?: string
    /**
     * Bar only: the reading, printed opposite `title`. `true` prints the
     * rounded percentage; a string says it in the units that matter
     * ("23 GB / 64 GB"), which a percentage alone cannot.
     */
    caption?: boolean | string
    /** `bar` (default) fills horizontally; `ring` draws a dial. */
    variant?: "bar" | "ring"
    /** Ring only: outer diameter in px. */
    size?: number
    /** Ring only: stroke width in px. */
    thickness?: number
    /**
     * Ring only: print the rounded percentage in the middle. Pass a string to
     * label it with something else ("12.4k", "3/8") — the ring shows progress,
     * the caption says what it is progress of.
     */
    label?: boolean | string
    /**
     * Grow from empty on first render instead of appearing already filled.
     *
     * A dial that arrives complete states a fact; one that fills shows a
     * quantity being measured, and the eye follows the sweep to where it stops —
     * which is the number the tile is actually about. Both variants already ease
     * every later change, so this only concerns the first paint.
     */
    animateOnMount?: boolean
    /** How long the fill takes, in ms. The counter in a ring matches it. */
    duration?: number
  }>(),
  {
    value: 0,
    max: 100,
    tone: "brand",
    variant: "bar",
    size: 44,
    thickness: 4,
    animateOnMount: true,
    // A resource is comfortable well past half, uncomfortable in the last
    // fifth, and urgent in the last tenth — the thresholds a capacity gauge is
    // read against, rather than an even split of the range.
    warnAt: 0.8,
    dangerAt: 0.9,
    // Slower than the kit's `slow` step: a gauge filling is content, not state
    // feedback, and at 320ms the sweep was over before it was noticed.
    duration: 900,
  },
)

/*
 * The arc and the counter are driven by ONE animated value rather than by two
 * animations of the same length.
 *
 * Matching their durations is not enough: a CSS transition and LpNumberFlow's
 * own easing decelerate on different curves, so the ring ran ahead of the
 * figure through the middle of the sweep — and shortening one merely moved the
 * gap to the other end. Interpolating here and handing both the same number
 * keeps them exactly level, because there is only one number.
 */
/*
 * `shown` is the position on screen, and it is the thing that is animated —
 * not a phase that something else multiplies by.
 *
 * The earlier shape kept an eased 0..1 and derived the position from it and a
 * `from` captured in the watcher. That could not work: `from` was read off a
 * computed over `props.value`, so by the time the watcher ran it already
 * reported the DESTINATION, and every sweep after the first interpolated from
 * the answer to the answer. The entrance still animated, which is what made
 * the bug look like a decision — the bar filled beautifully once and jumped
 * forever after.
 *
 * Animating the position directly removes the question. Wherever the bar is is
 * where the next sweep starts, including one that interrupts another midway.
 */
const shown = ref(props.animateOnMount ? 0 : props.value)
let raf = 0

const runSweep = (to: number, ms: number) => {
  if (raf) cancelAnimationFrame(raf)
  const from = shown.value
  if (prefersReducedMotion() || ms <= 0 || from === to) {
    shown.value = to
    return
  }
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms)
    // The kit's shared curve — the same function LpNumberFlow eases on, so the
    // arc and the counter agree by construction rather than by comment.
    shown.value = from + (to - from) * easeOut(t)
    raf = t < 1 ? requestAnimationFrame(step) : 0
  }
  raf = requestAnimationFrame(step)
}

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
})

/*
 * The sweep starts when the ring is looked at, not when it is built. A row of
 * these on a dashboard mounts all at once; started on mount, every one below
 * the fold is already sitting at its final value by the time it is scrolled to,
 * and the sweep — the whole point of a ring filling up — is never seen.
 *
 * reka's ProgressRoot is a component, so the ref holds an instance; take its
 * host element to observe.
 */
const { el: revealAnchor, revealed } = useReveal({ immediate: () => !props.animateOnMount })

const bindReveal = (instance: unknown) => {
  revealAnchor.value = (instance as { $el?: Element } | null)?.$el ?? null
}

watch(
  revealed,
  (visible) => {
    if (visible && props.animateOnMount) runSweep(props.value, props.duration)
  },
  { immediate: true },
)

/* A later change eases to the new value from wherever the bar stands. */
watch(
  () => [props.value, props.max],
  () => runSweep(props.value, props.duration),
)

const pct = computed(() =>
  Math.max(0, Math.min(100, (shown.value / props.max) * 100)),
)

/*
 * The tone actually painted. `auto` reads the fill and crosses two thresholds;
 * every other value passes straight through.
 *
 * Thresholds are compared against the TARGET, not the animated position, so a
 * bar does not change colour partway through its own sweep — it fills in the
 * colour its reading warrants.
 */
const paintedTone = computed(() => {
  if (props.tone !== "auto") return props.tone
  const fraction = props.max > 0 ? props.value / props.max : 0
  if (fraction >= props.dangerAt) return "danger"
  if (fraction >= props.warnAt) return "accent"
  return "action"
})

const captionText = computed(() => {
  if (props.caption === undefined || props.caption === false) return ""
  return typeof props.caption === "string" ? props.caption : `${Math.round(pct.value)}%`
})

const bar: Record<string, string> = {
  brand: "bg-brand",
  action: "bg-action",
  danger: "bg-danger",
  accent: "bg-accent",
}

const stroke: Record<string, string> = {
  brand: "var(--color-brand)",
  action: "var(--color-action)",
  danger: "var(--color-danger)",
  accent: "var(--color-accent)",
}

/*
 * The arc is drawn by dashing the circumference: one dash as long as the filled
 * fraction, one gap covering the rest. Rotated -90° so it starts at twelve
 * o'clock, which is where a dial is read from.
 */
const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

/*
 * Round caps add half a stroke at each end, so a nearly-full arc closes its own
 * gap and 97% renders as a solid ring — indistinguishable from done. Hold the
 * arc short of the seam unless the value really is complete.
 */
const dash = computed(() => {
  const full = circumference.value
  const raw = (pct.value / 100) * full
  if (pct.value >= 100) return full
  return Math.min(raw, full - props.thickness * 1.5)
})

/* A string label is verbatim — it isn't a number and has nothing to count. */
const staticCaption = computed(() =>
  typeof props.label === "string" ? props.label : null,
)
</script>

<template>
  <ProgressRoot
    v-if="variant === 'ring'"
    :ref="bindReveal"
    :model-value="value"
    :max="max"
    class="relative inline-flex shrink-0 items-center justify-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg :width="size" :height="size" class="-rotate-90">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--color-surface-soft)"
        :stroke-width="thickness"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="stroke[paintedTone]"
        :stroke-width="thickness"
        stroke-linecap="round"
        :stroke-dasharray="`${dash} ${circumference - dash}`"
      />
    </svg>
    <!-- Reads the same interpolated value as the arc — no animation of its own,
         or the two would drift apart again. -->
    <span
      v-if="label !== false && label !== undefined"
      class="absolute font-mono text-[11px] font-medium text-ink"
    >
      <template v-if="staticCaption">{{ staticCaption }}</template>
      <LpNumberFlow
        v-else
        :value="pct"
        suffix="%"
        :duration="0"
        :animate-on-mount="false"
        :style="{ '--lp-nf-spin': '90ms' }"
      />
    </span>
  </ProgressRoot>

  <!-- Wrapped only when there is a header to carry. A bare bar stays the single
       element it has always been, so an existing caller's layout is untouched. -->
  <div v-else-if="title || captionText" class="flex w-full flex-col gap-1">
    <div class="flex items-baseline justify-between gap-2 text-xs">
      <span class="text-muted">{{ title }}</span>
      <!-- Tabular, so a figure ticking upward doesn't shuffle its own width. -->
      <span class="font-mono tabular-nums text-muted-strong">{{ captionText }}</span>
    </div>
    <ProgressRoot
      :ref="bindReveal"
      :model-value="value"
      :max="max"
      class="h-1.5 w-full overflow-hidden rounded-pill bg-surface-soft"
    >
      <ProgressIndicator
        class="h-full rounded-pill transition-colors duration-medium"
        :class="bar[paintedTone]"
        :style="{ width: `${pct}%` }"
      />
    </ProgressRoot>
  </div>

  <ProgressRoot
    v-else
    :ref="bindReveal"
    :model-value="value"
    :max="max"
    class="h-1.5 w-full overflow-hidden rounded-pill bg-surface-soft"
  >
    <ProgressIndicator
      class="h-full rounded-pill transition-colors duration-medium"
      :class="bar[paintedTone]"
      :style="{ width: `${pct}%` }"
    />
  </ProgressRoot>
</template>
