<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed, ref } from "vue"
import LpNumberFlow from "./LpNumberFlow.vue"
import LpRollingText from "./LpRollingText.vue"
import LpSkeleton from "./LpSkeleton.vue"
import LpSwap from "./LpSwap.vue"
import LpTooltip from "./LpTooltip.vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useLabels } from "../composables/useLpConfig"

export type UptimeStatus = "operational" | "degraded" | "down" | "maintenance" | "empty"

export interface UptimeSegment {
  /** Health of this slice. `empty` renders a faded placeholder (no data). */
  status: UptimeStatus
  /** Optional rich tooltip body; falls back to a humanised status. */
  label?: string
}

const props = withDefaults(
  defineProps<{
    /** Oldest → newest. Each entry is one slice of the timeline. */
    segments: UptimeSegment[]
    /** Caption shown under the left edge (oldest point). */
    startLabel?: string
    /** Caption shown under the right edge (newest point). */
    endLabel?: string
    /** Show the computed uptime % above the bar. */
    showUptime?: boolean
    /** Override the headline shown next to the uptime %. */
    title?: string
    /**
     * Per-status colours. Any CSS colour (hex, rgb, `var(--token)`). Unset
     * statuses fall back to the theme tokens below. Pass e.g.
     * `{ degraded: '#ffb84d' }` to recolour just one state.
     */
    colors?: Partial<Record<UptimeStatus, string>>
    /** Status names, for the tooltip and screen readers. */
    labels?: Partial<Record<UptimeStatus | "loading", string>>
    /**
     * The history is on its way. The row of ticks pulses in place of the
     * slices (as many as `segments` already holds, else `skeletonSlices`) at
     * the bar's own height, and the uptime figure waits as a block; the
     * captions stay, so nothing around the bar moves when the data lands.
     */
    loading?: boolean
    /** Ticks drawn while loading with no segments yet. */
    skeletonSlices?: number
  }>(),
  { showUptime: true, loading: false, skeletonSlices: 45 },
)

/*
 * Green for healthy, and at full strength — the convention every status page
 * shares, so a wall of green reads instantly as "fine" and the eye only has to
 * find the slices that are not green. (Dimming the healthy days was tried and
 * made the whole row look faded rather than calm.)
 */
const defaultColor: Record<UptimeStatus, string> = {
  operational: "var(--color-action)",
  degraded: "var(--color-accent)",
  down: "var(--color-danger)",
  maintenance: "var(--color-brand)",
  empty: "var(--color-surface-soft)",
}

/* Only "no data yet" is held back; a real reading is always full strength. */
const opacityFor = (status: UptimeStatus): number =>
  status === "empty" ? 0.4 : 1

const colorFor = (status: UptimeStatus): string =>
  props.colors?.[status] ?? defaultColor[status]

const statusLabel = useLabels(
  "uptimeBar",
  {
    operational: "Operational",
    degraded: "Degraded",
    down: "Down",
    maintenance: "Maintenance",
    empty: "No data",
    loading: "Loading",
  },
  () => props.labels,
)

const skeletonCount = computed(() => props.segments.length || props.skeletonSlices)

// Uptime counts only slices with data; operational + maintenance are "up".
const uptimePct = computed(() => {
  const tracked = props.segments.filter((s) => s.status !== "empty")
  if (!tracked.length) return null
  const up = tracked.filter((s) => s.status === "operational" || s.status === "maintenance").length
  return (up / tracked.length) * 100
})

/*
 * Places actually needed, so trailing zeros stay trimmed: 100 rather than
 * 100.00, 99.9 rather than 99.90. The counter needs a fixed count per render —
 * it cannot "trim" mid-roll without changing the row's shape — so it is derived
 * from the value instead of hard-coded at two.
 */
/*
 * The gap is drawn INSIDE each slice, not between slices.
 *
 * A flex `gap` looked right and measured wrong: the slices divide a fractional
 * remainder, so each one's edges land on a different side of a device pixel and
 * a single 2.59px gap was painted as a mix of 2px and 3px down the row — the
 * bar kept losing its rhythm no matter what the gap was set to, including a
 * whole number of pixels.
 *
 * Giving every slice the same full share and inset-ing its paint by a
 * percentage of that share moves the rounding INTO a mark that is uniform by
 * construction: whatever each slot rounds to, the visible bar and the space
 * beside it round with it, together.
 */

/** Slice width as a fraction of its slot; the remainder is the gap. Mirrored by
 *  `.lp-uptime__mark` in the stylesheet, which owns the resting state. */
const MARK_WIDTH = 0.64

const hovered = ref<number | null>(null)

/* Sticky-ish read of the hovered slice, so the panel has content to show while
   it is closing rather than emptying first. */
const tip = computed(() => {
  const i = hovered.value
  if (i == null) return null
  const seg = props.segments[i]
  if (!seg) return null
  return { status: seg.status, text: seg.label ?? statusLabel.value[seg.status] }
})

/*
 * One Tab stop for the whole bar, arrows to walk it. A quarter's worth of
 * slices as separate stops made the bar ninety Tab presses to get past.
 */
const focusIndex = ref(-1)
const slots = ref<HTMLElement[]>([])
const tabStop = computed(() =>
  focusIndex.value >= 0 && focusIndex.value < props.segments.length
    ? focusIndex.value
    : props.segments.length - 1,
)

function onSlotKeydown(e: KeyboardEvent, i: number) {
  const last = props.segments.length - 1
  const next =
    e.key === "ArrowRight" ? Math.min(last, i + 1)
    : e.key === "ArrowLeft" ? Math.max(0, i - 1)
    : e.key === "Home" ? 0
    : e.key === "End" ? last
    : -1
  if (next < 0) return
  e.preventDefault()
  focusIndex.value = next
  slots.value[next]?.focus()
}

const uptimeDecimals = computed(() => {
  const v = uptimePct.value
  if (v == null) return 0
  const trimmed = Number(v.toFixed(2))
  return Number.isInteger(trimmed) ? 0 : String(trimmed).split(".")[1].length
})

// The bar sets its own gap between the strip and its caption, which a compact status row has to close.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex flex-col gap-1.5",
)
</script>

<template>
  <div
    :class="rootClass"
    :aria-busy="loading || undefined"
    v-bind="rest">
    <span v-if="loading" class="sr-only">{{ statusLabel.loading }}</span>
    <div v-if="title" class="text-xs">
      <span class="font-medium text-ink">{{ title }}</span>
    </div>

    <!--
      One tooltip for the whole bar, following the pointer, rather than one per
      slice. At sixty slices a few pixels wide, a tip anchored to each would
      jump from box to box as the pointer travelled; following it reads as a
      single readout being scrubbed along the timeline. It also means the kit's
      tooltip is used here rather than a second, hand-wired copy of reka.
    -->
    <!-- Both states are the bar's 34px, so the swap only fades; LpSwap is
         still what plays it, for the same entrance as every other placeholder. -->
    <LpSwap :swap-key="loading ? 'loading' : 'bar'">
    <!-- The same slot-and-mark geometry as the real bar (`.lp-uptime__mark`
         narrows each one), so the ticks sit exactly where the slices will. -->
    <LpSkeleton
      v-if="loading"
      class="lp-uptime flex h-[34px] items-stretch"
    >
      <span v-for="n in skeletonCount" :key="n" class="min-w-0 flex-1">
        <span class="lp-uptime__mark lp-skeleton-item block h-full rounded-[1px] bg-surface-soft" />
      </span>
    </LpSkeleton>
    <LpTooltip v-else :delay="80" follow-cursor side="top" :disabled="hovered === null">
      <template #content>
        <span v-if="tip" class="flex items-center gap-1.5">
          <span
            class="size-1.5 shrink-0 rounded-full"
            :style="{ backgroundColor: colorFor(tip.status) }"
          />
          <LpRollingText :value="tip.text" :duration="180" align="start" />
        </span>
      </template>

      <!--
        Mark-to-gap is a RATIO, not a pixel count. The reference bar is ~800px
        wide and can spare 3.6px between 5.4px marks; the same 3px inside a
        384px card left the marks thinner than the spaces between them. The gap
        is therefore derived from how many slices are being drawn, and clamped
        so a year's worth doesn't lose its gaps and a week's doesn't grow
        canyons.
      -->
      <div class="lp-uptime flex h-[34px] items-stretch" @pointerleave="hovered = null">
        <button
          v-for="(seg, i) in segments"
          :key="i"
          ref="slots"
          type="button"
          class="lp-uptime__slot min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :tabindex="i === tabStop ? 0 : -1"
          :aria-label="seg.label ?? statusLabel[seg.status]"
          @pointerenter="hovered = i"
          @focus="focusIndex = i; hovered = i"
          @blur="hovered === i && (hovered = null)"
          @keydown="onSlotKeydown($event, i)"
        >
          <span
            class="lp-uptime__mark block h-full rounded-[1px] transition-[opacity,scale] duration-[var(--duration-fast)] motion-reduce:transition-none"
            :style="{
              backgroundColor: colorFor(seg.status),
              opacity: hovered === i ? 1 : opacityFor(seg.status),
              // Both axes every time: the x factor is what holds the gap open
              // (see the stylesheet), so a hover that set only y would widen
              // the slice into its neighbours' spacing.
              scale: hovered === i ? `${MARK_WIDTH} 1.12` : undefined,
            }"
          />
        </button>
      </div>
    </LpTooltip>
    </LpSwap>

    <!--
      The figure sits BETWEEN the two dates rather than above the bar: it is a
      summary of exactly the span they bracket, and the rules on either side say
      so. This is the arrangement status pages settled on, and it also frees the
      top line to be nothing but the component's name.
    -->
    <div
      v-if="startLabel || endLabel || showUptime"
      class="flex items-center gap-2 text-xs text-muted"
    >
      <span class="shrink-0">{{ startLabel }}</span>
      <span class="h-px flex-1 bg-line" />
      <span v-if="showUptime" class="shrink-0 text-muted-strong">
        <LpSkeleton
          v-if="loading"
          class="inline-block h-[0.9em] w-8 align-middle"
        />
        <LpNumberFlow
          v-else-if="uptimePct != null"
          :value="uptimePct"
          :decimals="uptimeDecimals"
          suffix="%"
        />
        <template v-else>—</template>
        <span class="text-muted"> uptime</span>
      </span>
      <span class="h-px flex-1 bg-line" />
      <span class="shrink-0">{{ endLabel }}</span>
    </div>
  </div>
</template>


<style>
/*
 * The slot is the full share of the row; the mark inside it is narrowed to a
 * FRACTION of that share, which is what produces the space between days.
 * Because the inset scales with the slot, the mark-to-gap ratio holds at any
 * width and any number of slices, and both round to device pixels together
 * instead of drifting apart.
 *
 * A horizontal scale, not padding. Percentage padding resolves against the
 * PARENT's width, never the element's own — so `padding-inline: 18%` on a slot
 * of a 384px bar asked for 69px of padding on each side of a 3.2px slice. The
 * marks collapsed to zero width and the bar vanished, while flex stretched the
 * slots to fit the padding. `scale` is one of the few things that is genuinely
 * relative to the box itself.
 */
.lp-uptime__mark {
  scale: 0.64 1;
}
</style>
