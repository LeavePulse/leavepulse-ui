<script setup lang="ts">
// Stat tile: dot + caps label, big mono value, optional delta/trend badge and a
// subtitle. A product pattern, fully token-driven — re-skins with the theme.
import { computed } from "vue"
import LpIcon from "./LpIcon.vue"

const props = withDefaults(
  defineProps<{
    label: string
    value: string
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
  { trend: "auto" },
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
        {{ value }}
      </span>
      <span
        v-if="showDelta"
        class="inline-flex items-center gap-0.5 text-sm font-medium tabular-nums"
        :class="trendColor"
      >
        <LpIcon :name="trendIcon" :size="14" />
        {{ deltaText }}
      </span>
    </div>
    <span v-if="hint" class="text-sm text-muted">{{ hint }}</span>
  </div>
</template>
