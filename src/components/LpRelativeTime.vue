<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A date said the way people say it ("3 min ago", "in 2 h"), kept true as time
 * passes, with the exact date one hover away.
 *
 * Each instance sleeps until its own text would change (useNow with the
 * formatter's `refreshIn`): a "just now" wakes in seconds, a "last month" once
 * an hour, so a table of old rows costs almost nothing between changes. When
 * the text does change it rolls to the new one, so "4 min ago" becoming
 * "5 min ago" is seen as the same clock moving.
 */
import { computed } from "vue"
import { useLocale } from "../composables/useLocale"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useNow } from "../composables/useNow"
import LpRollingText from "./LpRollingText.vue"
import LpTooltip from "./LpTooltip.vue"
import { formatRelativeTime } from "./relativeTime"
import { toEpoch } from "./timeSpan"

const props = withDefaults(
  defineProps<{
    /** A Date, an ISO string or epoch milliseconds. */
    date: Date | string | number
    /** Intl's width: `long` "3 minutes ago", `short` "3 min. ago", `narrow` "3m ago". */
    format?: Intl.RelativeTimeFormatStyle
    /** Within this many ms of now it reads "now" rather than counting seconds. */
    nowWithin?: number
    /**
     * Show the exact date on hover and focus. Off, it moves to the native
     * `title` instead, for a dense log where tooltips would get in the way of
     * reading; it is never shown both ways at once, which would stack two
     * hints on one hover.
     */
    tooltip?: boolean
    /** How the exact date is written. Defaults to the full date with the time. */
    absolute?: Intl.DateTimeFormatOptions
    locale?: string
  }>(),
  { format: "long", tooltip: true, nowWithin: 45_000 },
)

const locale = useLocale(() => props.locale)
const at = computed(() => toEpoch(props.date))
const options = computed(() => ({ locale: locale.value, style: props.format, nowWithin: props.nowWithin }))

/*
 * The clock wakes only when this text would change (`refreshIn`): a "just
 * now" in seconds, a "last month" once an hour, nothing while the tab is
 * hidden. A new date or wording reschedules it, since the wait planned for the
 * old one may be far too long for the new.
 */
const now = useNow(true, {
  nextIn: (t) => formatRelativeTime(at.value, t, options.value).refreshIn,
  restartOn: () => [at.value, locale.value, props.format, props.nowWithin],
})
const reading = computed(() => formatRelativeTime(at.value, now.value, options.value))

const exact = computed(() => {
  if (!Number.isFinite(at.value)) return ""
  return new Intl.DateTimeFormat(locale.value, props.absolute ?? { dateStyle: "full", timeStyle: "short" }).format(at.value)
})
const iso = computed(() => (Number.isFinite(at.value) ? new Date(at.value).toISOString() : undefined))

const { class: rootClass, attrs: rest } = useMergedAttrs("inline-flex whitespace-nowrap tabular-nums")
</script>

<template>
  <LpTooltip v-if="tooltip && exact" :content="exact">
    <!-- Focusable, so the exact date is reachable from the keyboard too; the
         tooltip is a description, the relative text stays the name. -->
    <time
      :datetime="iso"
      tabindex="0"
      :class="[rootClass, 'rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring']"
      v-bind="rest"
    >
      <LpRollingText :value="reading.text" align="start" />
    </time>
  </LpTooltip>
  <time v-else :datetime="iso" :title="exact || undefined" :class="rootClass" v-bind="rest">
    <LpRollingText :value="reading.text" align="start" />
  </time>
</template>
