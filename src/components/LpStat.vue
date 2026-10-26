<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
// Stat tile: dot + caps label, big mono value, optional delta/trend badge and a
// subtitle. A product pattern, fully token-driven — re-skins with the theme.
import { computed } from "vue"
import LpIcon from "./LpIcon.vue"
import LpNumberFlow from "./LpNumberFlow.vue"
import LpSkeleton from "./LpSkeleton.vue"
import LpStatus from "./LpStatus.vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import { TONES } from "./tone"

const props = withDefaults(
  defineProps<{
    label: string
    /**
     * A string is printed as given; a NUMBER counts to its new value on
     * LpNumberFlow's digit wheels. A tile on a live dashboard is the one place
     * a figure changes while somebody is looking at it, and a value that cuts
     * from 41 to 43 says nothing about which way it moved.
     */
    value: string | number
    /** Formatting for a numeric `value` — see LpNumberFlow. */
    compact?: boolean
    grouped?: boolean
    decimals?: number
    prefix?: string
    valueSuffix?: string
    hint?: string
    icon?: string
    online?: boolean
    /** Change vs. a previous period. Renders a coloured arrow + this text. A
     *  number is shown with a sign; a string is shown verbatim (e.g. "+12%"). */
    delta?: number | string
    /** Appended to a numeric delta, e.g. "%". Ignored for string deltas. */
    deltaSuffix?: string
    /** Trend direction. "auto" derives it from a numeric delta's sign. */
    trend?: "auto" | "up" | "down" | "flat"
    /** For metrics where down is good (latency, errors): swaps the colours so a
     *  downward trend reads as positive (action) and upward as danger. */
    invertTrend?: boolean
    /**
     * The figure is still on its way. The tile keeps its shape and every line
     * its height: the value and the delta pulse as blocks set in their own type
     * size, so the tile is exactly as tall loading as loaded and the row of
     * tiles does not move when the numbers land. A known label stays readable
     * (it names the tile, it is not data); an empty one pulses too.
     */
    loading?: boolean
  }>(),
  { trend: "auto", decimals: 0 },
)

// Resolve the trend direction: explicit wins; "auto" reads a numeric delta.
const dir = computed<"up" | "down" | "flat">(() => {
  if (props.trend !== "auto") return props.trend
  if (typeof props.delta === "number") {
    if (props.delta > 0) return "up"
    if (props.delta < 0) return "down"
  }
  return "flat"
})

const trendIcon = computed(() =>
  dir.value === "up"
    ? "lucide:trending-up"
    : dir.value === "down"
      ? "lucide:trending-down"
      : "lucide:minus",
)

// up = good by default; invertTrend flips good/bad for "lower is better" metrics.
const trendColor = computed(() => {
  if (dir.value === "flat") return "text-muted"
  const good = props.invertTrend ? dir.value === "down" : dir.value === "up"
  return good ? TONES.success.text : TONES.danger.text
})

// Numeric delta gets an explicit sign; string deltas are shown as given.
const deltaText = computed(() => {
  if (props.delta == null) return ""
  if (typeof props.delta === "number") {
    const sign = props.delta > 0 ? "+" : ""
    return `${sign}${props.delta}${props.deltaSuffix ?? ""}`
  }
  return props.delta
})

const showDelta = computed(() => props.delta != null)

/*
 * Read off the delta itself rather than taken as a prop: a change is quoted at
 * whatever precision it was measured (+2.4%, +12), and the tile's own
 * `decimals` describes the VALUE, which is a different quantity. Rounding
 * +0.4 to +0 would report no change at all.
 */
const deltaDecimals = computed(() => {
  if (typeof props.delta !== "number") return 0
  const [, fraction] = String(props.delta).split(".")
  return Math.min(fraction?.length ?? 0, 4)
})

/*
 * Placeholder and figure cross-fade in place. Both sit in the same line box, so
 * there is no size to ease, only the content: LpSwap's height tween would have
 * nothing to do, and its block wrapper would break the baseline row.
 */
const FADE = {
  mode: "out-in",
  enterFromClass: "opacity-0",
  enterActiveClass: "transition-opacity duration-fast ease-out motion-reduce:transition-none",
  leaveActiveClass: "transition-opacity duration-fast ease-in motion-reduce:transition-none",
  leaveToClass: "opacity-0",
} as const

// A stat tile spaces its label and value on a fixed gap; a dense KPI row needs that tighter.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex flex-col gap-2",
)
</script>

<template>
  <div
    :class="rootClass"
    v-bind="rest">
    <div class="flex items-center gap-2">
      <!-- The kit's own "online" light, so a live tile reads (and is spoken)
           the same as a live server row elsewhere on the page. -->
      <LpStatus v-if="online" state="online" size="sm" hide-label />
      <LpIcon v-if="icon" :name="icon" :size="14" class="text-muted" />
      <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Transition v-bind="FADE">
          <LpSkeleton v-if="loading && !label" class="inline-block h-[0.8em] w-20 align-middle" />
          <span v-else>{{ label }}</span>
        </Transition>
      </span>
    </div>
    <!-- A narrow tile moves the delta under the figure rather than breaking the
         figure itself: "2085 ч" split across two lines reads as two values. -->
    <div class="flex flex-wrap items-baseline gap-x-2">
      <!-- The placeholder sits INSIDE the value's own type size, so its line box
           is the real one: the tile cannot change height when the figure lands. -->
      <span class="whitespace-nowrap font-mono text-3xl font-medium tracking-tight text-ink">
        <!-- Each side wrapped in a plain element: LpNumberFlow renders more
             than one root node, which a Transition cannot fade. -->
        <Transition v-bind="FADE">
          <span v-if="loading" key="loading">
            <LpSkeleton class="inline-block h-[0.8em] w-[4.5ch] align-middle" />
          </span>
          <span v-else key="value">
            <LpNumberFlow
              v-if="typeof value === 'number'"
              :value="value"
              :compact="compact"
              :grouped="grouped"
              :decimals="decimals"
              :prefix="prefix"
              :suffix="valueSuffix"
            />
            <template v-else>{{ value }}</template>
          </span>
        </Transition>
      </span>
      <span
        v-if="loading"
        class="inline-flex items-center text-sm font-medium"
      >
        <LpSkeleton class="inline-block h-[0.9em] w-10 align-middle" />
      </span>
      <span
        v-else-if="showDelta"
        class="inline-flex items-center gap-0.5 whitespace-nowrap text-sm font-medium tabular-nums"
        :class="trendColor"
      >
        <LpIcon :name="trendIcon" :size="14" />
        <!-- Rolls like the value it sits beside. Two figures on one line, one
             cutting and one counting, reads as the delta failing to update. -->
        <LpNumberFlow
          v-if="typeof delta === 'number'"
          :value="delta"
          :decimals="deltaDecimals"
          :prefix="delta > 0 ? '+' : ''"
          :suffix="deltaSuffix"
        />
        <template v-else>{{ deltaText }}</template>
      </span>
      <!-- A delta says how much it moved; the shape says how it got there. Put
           an LpSparkline (or a ring) here to answer both at once. -->
      <span v-if="$slots.trend" class="ml-3 self-center">
        <slot name="trend" />
      </span>
    </div>
    <span v-if="hint" class="text-sm text-muted">{{ hint }}</span>
  </div>
</template>
