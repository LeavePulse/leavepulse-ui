<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * "Used of limit": storage, seats, API calls. A header with the reading, a bar,
 * and a line saying what is left, with the tone rising as the limit nears.
 *
 * The bar is drawn here rather than borrowed from LpProgress. LpProgress shows
 * one fraction clamped to full, which is right for progress and wrong for a
 * quota on two counts: a quota is often made of parts (a stacked bar), and an
 * exceeded quota has to SHOW the excess. Here the bar stretches to hold what is
 * used and the limit becomes a mark along it, so 12 of 10 GB reads as a bar
 * running past a line instead of as a full bar indistinguishable from 10 of 10.
 * The tone scale, the track and the header row are LpProgress's (meter.ts), so
 * the two agree on one disk and look like one family.
 */
import { computed } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useLocale } from "../composables/useLocale"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useRevealedValue } from "../composables/useRevealedValue"
import LpIcon from "./LpIcon.vue"
import LpNumberFlow from "./LpNumberFlow.vue"
import LpRollingText from "./LpRollingText.vue"
import { METER_HEADER, METER_TRACK } from "./meter"
import { formatAmount, quotaSegments, quotaState, type QuotaPart, type QuotaUnit } from "./quota"
import { toneLook } from "./tone"

export type QuotaLabels = {
  /** `{amount}` is what remains. */
  left: string
  /** `{amount}` is the excess. */
  over: string
  /** Shown instead of what remains when there is no limit. */
  unlimited: string
  /** The spoken reading, followed by what is left or over. `{used}`, `{limit}`. */
  reading: string
}

const props = withDefaults(
  defineProps<{
    used: number
    /** Unset, zero or Infinity means unlimited: the reading stays, the bar and "left" go. */
    limit?: number | null
    /** What is counted ("Storage", "Seats"). Also the accessible name. */
    label?: string
    /** `"bytes"`, a plain suffix ("seats"), or a formatter. See `formatAmount`. */
    unit?: QuotaUnit
    /**
     * What the used amount is made of. The bar stacks them and a legend names
     * them; their sum need not equal `used` (a part can be left unlisted), but
     * the bar shows the parts, so list them all if the bar should add up.
     */
    parts?: QuotaPart[]
    /** Share of the limit (0–1) where the quota turns warning. */
    warnAt?: number
    /** Share of the limit where it turns danger. Over the limit is always danger. */
    dangerAt?: number
    /** Hide the legend under a stacked bar, for a compact row where the tooltip of the page says enough. */
    hideLegend?: boolean
    /** Fill from empty when first seen. */
    animateOnMount?: boolean
    locale?: string
    labels?: Partial<QuotaLabels>
  }>(),
  { limit: null, warnAt: 0.8, dangerAt: 0.9, hideLegend: false, animateOnMount: true },
)

const text = useLabels<QuotaLabels>(
  "quota",
  {
    left: "{amount} left",
    over: "{amount} over the limit",
    unlimited: "No limit",
    reading: "{used} of {limit} used",
  },
  () => props.labels,
)
const locale = useLocale(() => props.locale)

const state = computed(() => quotaState(props.used, props.limit, props.warnAt, props.dangerAt))
const look = computed(() => toneLook(state.value.tone))
const fmt = (v: number) => formatAmount(v, props.unit, locale.value)

/*
 * Without parts the used amount is one part in the tone it earns, so a single
 * bar and a stacked one share the layout, the overflow mark and the motion.
 */
const layout = computed(() =>
  quotaSegments(
    props.parts?.length ? props.parts : [{ label: props.label ?? "", value: props.used, color: look.value.color }],
    props.limit,
  ),
)

// The bar's segments ease in CSS and the figure rolls in LpNumberFlow, so only the held value is needed here.
const { el: revealAnchor, revealed, target: shownUsed } = useRevealedValue(() => props.used, {
  animateOnMount: () => props.animateOnMount,
})

const footer = computed(() => {
  const s = state.value
  if (!s.limited) return text.value.unlimited
  if (s.over > 0) return text.value.over.replace("{amount}", fmt(s.over))
  return text.value.left.replace("{amount}", fmt(s.remaining))
})

/* Spoken: the reading, then the same verdict the footer shows. */
const valueText = computed(() =>
  state.value.limited
    ? `${text.value.reading.replace("{used}", fmt(props.used)).replace("{limit}", fmt(props.limit as number))}, ${footer.value}`
    : `${fmt(props.used)}, ${text.value.unlimited}`,
)

// Ink while the reading is fine: a calm quota should not be coloured at all.
const readingTone = computed(() => (state.value.tone === "ok" ? "text-ink" : look.value.text))

const { class: rootClass, attrs: rest } = useMergedAttrs("flex w-full flex-col gap-1.5")
</script>

<template>
  <div
    :ref="(el) => (revealAnchor = el as Element | null)"
    :role="state.limited ? 'meter' : 'group'"
    :aria-valuenow="state.limited ? used : undefined"
    :aria-valuemin="state.limited ? 0 : undefined"
    :aria-valuemax="state.limited ? (limit as number) : undefined"
    :aria-valuetext="state.limited ? valueText : undefined"
    :aria-label="label"
    :class="rootClass"
    v-bind="rest"
  >
    <div :class="METER_HEADER" class="gap-3 text-sm">
      <span v-if="label" class="truncate text-ink">{{ label }}</span>
      <span class="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted">
        <LpNumberFlow
          :value="shownUsed"
          :format="fmt"
          :animate-on-mount="false"
          class="transition-colors duration-(--duration-medium)"
          :class="readingTone"
        />
        <template v-if="state.limited">
          <span class="px-1">/</span>
          <LpNumberFlow :value="limit as number" :format="fmt" :animate-on-mount="false" />
        </template>
      </span>
    </div>

    <div
      v-if="state.limited || parts?.length"
      class="relative"
      :class="METER_TRACK"
      aria-hidden="true"
    >
      <div class="flex h-full w-full gap-px overflow-hidden rounded-pill">
        <span
          v-for="seg in layout.segments"
          :key="seg.label"
          class="h-full shrink-0 transition-[width,background-color] duration-700 ease-(--ease-emphasized) motion-reduce:transition-none"
          :style="{ width: revealed ? `${seg.share * 100}%` : '0%', backgroundColor: seg.color }"
        />
      </div>
      <!-- The limit, once the bar has run past it. Taller than the track so it
           reads as a line across the bar, not as one more part. -->
      <span
        class="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-pill bg-ink transition-[left,opacity] duration-700 ease-(--ease-emphasized) motion-reduce:transition-none"
        :style="{ left: `${(layout.limitAt ?? 1) * 100}%`, opacity: layout.limitAt != null && revealed ? 1 : 0 }"
      />
    </div>

    <div
      class="flex items-center gap-1 text-xs transition-colors duration-(--duration-medium)"
      :class="state.over > 0 ? look.text : 'text-muted'"
    >
      <LpIcon
        name="lucide:triangle-alert"
        :size="12"
        class="shrink-0 transition-[opacity,width] duration-(--duration-medium)"
        :class="state.over > 0 ? 'w-3 opacity-100' : 'w-0 opacity-0'"
      />
      <LpRollingText :value="footer" align="start" />
    </div>

    <ul v-if="parts?.length && !hideLegend" class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <li v-for="seg in layout.segments" :key="seg.label" class="flex items-center gap-1.5">
        <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: seg.color }" />
        <span>{{ seg.label }}</span>
        <span class="font-mono tabular-nums text-muted-strong">{{ fmt(seg.value) }}</span>
      </li>
    </ul>
  </div>
</template>
