<script setup lang="ts">
// Stat tile: dot + caps label, big mono value, optional delta/trend badge and a
// subtitle. A product pattern, fully token-driven — re-skins with the theme.
import { computed } from "vue"
import LpIcon from "./LpIcon.vue"
import LpNumberFlow from "./LpNumberFlow.vue"

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
  return good ? "text-action" : "text-danger"
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
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span v-if="online" class="size-1.5 rounded-full bg-action" />
      <LpIcon v-if="icon" :name="icon" :size="14" class="text-muted" />
      <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {{ label }}
      </span>
    </div>
    <div class="flex items-baseline gap-2">
      <span class="font-mono text-3xl font-medium tracking-tight text-ink">
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
      <span
        v-if="showDelta"
        class="inline-flex items-center gap-0.5 text-sm font-medium tabular-nums"
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
