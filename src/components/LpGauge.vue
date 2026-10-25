<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * One reading within a range, drawn as a dial: CPU load, disk use, a score.
 *
 * Not a variant of LpProgress's ring, though both draw an arc. The ring is
 * progress toward done: it starts at zero, closes into a circle at 100 and has
 * no idea what the number means. A gauge is a reading on a scale: it has a
 * floor that need not be zero, steps along the way where the reading changes
 * meaning (the threshold notches), and a sweep with a visible start and end so
 * the eye can tell low from high without reading the figure. Folding that into
 * the ring would grow it a second set of props that only apply in one variant.
 * The arithmetic both need (fraction of a range, tone at a reading) lives in
 * meter.ts and is shared rather than copied.
 */
import { computed } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useLocale } from "../composables/useLocale"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useRevealedValue } from "../composables/useRevealedValue"
import LpNumberFlow from "./LpNumberFlow.vue"
import LpRollingText from "./LpRollingText.vue"
import {
  arcPath,
  capacityThresholds,
  GAUGE_SWEEP,
  meterFraction,
  polar,
  toneAt,
  type MeterThreshold,
  type MeterTone,
} from "./meter"
import { toneLook } from "./tone"

export type GaugeLabels = {
  /** Appended to the spoken value when the reading is in a warning step. */
  warning: string
  /** Appended to the spoken value when the reading is in a danger step. */
  danger: string
}

const props = withDefaults(
  defineProps<{
    value: number
    min?: number
    max?: number
    /**
     * Steps of the scale, in the gauge's own units: from each `at` upward the
     * arc takes that tone. Unset, the capacity scale applies (warning from 80%
     * of the range, danger from 90%), which is what a resource gauge wants. A
     * score where higher is better lists its own steps:
     * `[{ at: 0, tone: 'danger' }, { at: 50, tone: 'warning' }, { at: 80, tone: 'ok' }]`.
     */
    thresholds?: MeterThreshold[]
    /**
     * A fixed tone instead of the scale. For a gauge whose reading is neither
     * good nor bad (a temperature, a position), where colouring it by
     * thresholds would invent a judgement.
     */
    tone?: MeterTone
    /** What is measured, printed under the figure ("CPU", "Disk"). Also the accessible name. */
    label?: string
    /** Printed after the figure, smaller ("%", "°C", "ms"). */
    unit?: string
    /** Decimal places of the figure. */
    decimals?: number
    /**
     * Says the figure differently ("1.2k", "3/8"). Overrides `decimals`; the
     * figure still rolls, since the formatted string is what LpNumberFlow animates.
     */
    format?: (value: number) => string
    /** `semi` (default) sweeps across the top; `full` is a 270° dial open at the bottom. */
    variant?: "semi" | "full"
    /** Width in px. The height follows from the shape. */
    size?: number
    /** Arc thickness in px. Defaults to a share of `size`. */
    thickness?: number
    /** Print `min` and `max` under the ends of the arc. On by default for `semi`, where they sit naturally. */
    showRange?: boolean
    /** Notch the track where each threshold starts, so the reader sees how far the next step is. */
    showThresholds?: boolean
    /**
     * Sweep up from the floor when first seen, instead of appearing already
     * at the reading. Later changes always ease from where the needle is.
     */
    animateOnMount?: boolean
    /** Sweep length in ms, shared by the arc and the figure. */
    duration?: number
    locale?: string
    labels?: Partial<GaugeLabels>
  }>(),
  {
    min: 0,
    max: 100,
    decimals: 0,
    variant: "semi",
    size: 160,
    showRange: undefined,
    showThresholds: true,
    animateOnMount: true,
    // Same as LpProgress: a gauge filling is content, and at the kit's
    // `slow` step the sweep is over before it is noticed.
    duration: 900,
  },
)

const text = useLabels<GaugeLabels>("gauge", { warning: "warning", danger: "critical" }, () => props.labels)
const locale = useLocale(() => props.locale)

/*
 * One animated number drives both the arc and the figure, as in LpProgress:
 * two animations of the same length still drift apart through the middle,
 * because they ease on different curves.
 */
const { el: revealAnchor, shown } = useRevealedValue(() => props.value, {
  from: () => props.min,
  animateOnMount: () => props.animateOnMount,
  duration: () => props.duration,
})

const steps = computed(() => props.thresholds ?? capacityThresholds(props.min, props.max))

/*
 * The tone follows the TARGET, not the sweeping value, so the arc does not
 * flash through amber on its way down from red: it travels in the colour its
 * reading warrants.
 */
const paintedTone = computed<MeterTone>(() => props.tone ?? toneAt(props.value, steps.value))

const thick = computed(() => props.thickness ?? Math.max(4, Math.round(props.size * 0.075)))
const sweep = computed(() => GAUGE_SWEEP[props.variant])
// Threshold notches sit just outside the arc, so the arc gives up their room.
const NOTCH = 5
const radius = computed(() => (props.size - thick.value) / 2 - (props.showThresholds ? NOTCH : 0))
const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)
// A semicircle needs only its top half plus the round caps hanging below the
// ends; the full dial needs the square.
const height = computed(() =>
  props.variant === "semi" ? Math.ceil(cy.value + thick.value / 2) : props.size,
)

const track = computed(() => arcPath(cx.value, cy.value, radius.value, sweep.value[0], sweep.value[1]))
const fraction = computed(() => meterFraction(shown.value, props.min, props.max))

/*
 * The value arc is the track path dashed to length, with `pathLength` so the
 * dash is a plain share of 1000 whatever the radius. At zero a round-capped
 * zero-length dash still draws a dot, so the arc hides instead.
 */
const dash = computed(() => `${(fraction.value * 1000).toFixed(2)} 1000`)

const notches = computed(() => {
  if (!props.showThresholds) return []
  const [from, to] = sweep.value
  const inner = radius.value + thick.value / 2 + 1.5
  const outer = inner + NOTCH - 1
  return steps.value
    .filter((s) => s.at > props.min && s.at < props.max)
    .map((s) => {
      const deg = from + (to - from) * meterFraction(s.at, props.min, props.max)
      const a = polar(cx.value, cy.value, inner, deg)
      const b = polar(cx.value, cy.value, outer, deg)
      return { key: `${s.at}-${s.tone}`, a, b, color: toneLook(s.tone).color }
    })
})

const rangeShown = computed(() => props.showRange ?? props.variant === "semi")

const formatter = computed(() => {
  if (props.format) return props.format
  const nf = new Intl.NumberFormat(locale.value, {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  })
  return (v: number) => nf.format(v)
})

const valueText = computed(() => {
  const reading = `${formatter.value(props.value)}${props.unit ? ` ${props.unit}` : ""}`
  const tone = paintedTone.value
  return tone === "warning" || tone === "danger" ? `${reading}, ${text.value[tone]}` : reading
})

const { class: rootClass, attrs: rest } = useMergedAttrs(
  "relative inline-flex shrink-0 flex-col items-center",
)
const figureSize = computed(() => `${Math.max(14, Math.round(props.size * 0.19))}px`)
</script>

<template>
  <div
    :ref="(el) => (revealAnchor = el as Element | null)"
    role="meter"
    :aria-valuenow="value"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuetext="valueText"
    :aria-label="label"
    :class="rootClass"
    :style="{ width: `${size}px` }"
    v-bind="rest"
  >
    <div class="relative">
      <svg
        :width="size"
        :height="height"
        :viewBox="`0 0 ${size} ${height}`"
        class="overflow-visible"
        aria-hidden="true"
      >
        <path
          :d="track"
          fill="none"
          stroke="var(--color-surface-soft)"
          :stroke-width="thick"
          stroke-linecap="round"
        />
        <path
          :d="track"
          fill="none"
          pathLength="1000"
          :stroke="toneLook(paintedTone).color"
          :stroke-width="thick"
          stroke-linecap="round"
          :stroke-dasharray="dash"
          :opacity="fraction > 0.0005 ? 1 : 0"
          class="transition-[stroke] duration-(--duration-slow) ease-(--ease-emphasized) motion-reduce:transition-none"
        />
        <line
          v-for="n in notches"
          :key="n.key"
          :x1="n.a.x"
          :y1="n.a.y"
          :x2="n.b.x"
          :y2="n.b.y"
          :stroke="n.color"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>

      <!-- The figure sits in the bowl of the arc: on its baseline for the
           semicircle, in the middle for the dial. -->
      <div
        class="pointer-events-none absolute inset-x-0 flex flex-col items-center leading-none"
        :class="variant === 'semi' ? 'bottom-0' : 'top-1/2 -translate-y-1/2'"
      >
        <span class="flex items-baseline gap-0.5 font-mono font-semibold text-ink" :style="{ fontSize: figureSize }">
          <LpNumberFlow
            :value="shown"
            :decimals="decimals"
            :format="format"
            :locale="locale"
            :duration="0"
            :animate-on-mount="false"
            :style="{ '--lp-nf-spin': '90ms' }"
          />
          <span v-if="unit" class="text-[0.55em] font-medium text-muted">{{ unit }}</span>
        </span>
        <span v-if="label && variant === 'full'" class="mt-1 text-xs text-muted">
          <LpRollingText :value="label" />
        </span>
      </div>
    </div>

    <!-- Under a semicircle the label shares the baseline row with the range
         ends rather than stacking under the figure inside the bowl: a small
         gauge has no room for both there, and the figure ran into the arc. -->
    <div
      v-if="rangeShown || (label && variant === 'semi')"
      class="mt-1 grid w-full grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-[11px] text-muted"
      :style="{ paddingInline: `${Math.max(0, cx - radius - thick / 2)}px` }"
    >
      <span class="font-mono tabular-nums" aria-hidden="true">{{ rangeShown ? formatter(min) : "" }}</span>
      <span class="truncate text-xs">
        <LpRollingText v-if="label && variant === 'semi'" :value="label" />
      </span>
      <span class="text-right font-mono tabular-nums" aria-hidden="true">{{ rangeShown ? formatter(max) : "" }}</span>
    </div>
  </div>
</template>
