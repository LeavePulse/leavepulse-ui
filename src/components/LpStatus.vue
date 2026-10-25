<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * What state something is in, as a light and a word: a server online, a bot
 * starting, a region degraded.
 *
 * Not LpBadge with a dot. A badge is a label whose text is the point and whose
 * dot is decoration; here the STATE is the point and the caller passes a state,
 * not a colour and a word. The light, the word, the pulse and the spoken text
 * all follow from it, so every status in an app looks and sounds the same, and
 * a change of state (starting → online) reads as one thing changing: the light
 * crossfades, the word rolls, the pulse starts or stops.
 */
import { computed } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import { TONE_COLOR, TONE_SOFT, type MeterTone } from "./meter"
import { STATUS_LABELS, STATUS_LOOK, type StatusKind } from "./status"

const props = withDefaults(
  defineProps<{
    state: StatusKind
    /** The word shown, when the state's own name is not the right one ("Ready", "In a match"). */
    label?: string
    /** Overrides the state's tone, for an app whose "offline" is an alarm rather than a rest state. */
    tone?: MeterTone
    /** Overrides whether the light pulses. */
    pulse?: boolean
    /** `inline` (default) is a light and a word in running text or a table cell; `pill` puts them on a tinted chip. */
    variant?: "inline" | "pill"
    size?: "sm" | "md"
    /**
     * Light only. The word is still there for screen readers and as a native
     * hint on hover, so a dense list can drop it visually without going silent.
     */
    hideLabel?: boolean
    /**
     * Speak changes as they happen (`role="status"`). Off by default: a table
     * of twenty servers announcing each flip would drown everything else.
     * Turn it on for the one status the user is waiting on.
     */
    announce?: boolean
    labels?: Partial<Record<StatusKind, string>>
  }>(),
  { variant: "inline", size: "md", hideLabel: false, announce: false, pulse: undefined },
)

const names = useLabels<Record<StatusKind, string>>("status", STATUS_LABELS, () => props.labels)

const look = computed(() => STATUS_LOOK[props.state] ?? STATUS_LOOK.unknown)
const tone = computed(() => props.tone ?? look.value.tone)
const pulsing = computed(() => props.pulse ?? look.value.pulse)
const word = computed(() => props.label ?? names.value[props.state] ?? props.state)

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "inline-flex shrink-0 items-center align-middle font-medium leading-[1.2] whitespace-nowrap",
    "transition-[color,background-color] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none",
    props.size === "sm" ? "gap-1.5 text-[11px]" : "gap-2 text-xs",
    props.variant === "pill" ? (props.size === "sm" ? "h-[18px] rounded-pill px-1.5" : "rounded-pill px-2.5 py-0.5") : "",
  ].join(" "),
)

const rootStyle = computed(() =>
  props.variant === "pill"
    ? {
        backgroundColor: TONE_SOFT[tone.value],
        color: tone.value === "neutral" ? "var(--color-muted-strong)" : TONE_COLOR[tone.value],
      }
    : { color: "var(--color-muted-strong)" },
)

const dotSize = computed(() => (props.size === "sm" ? "size-1.5" : "size-2"))
</script>

<template>
  <span
    :role="announce ? 'status' : undefined"
    :title="hideLabel ? word : undefined"
    :class="rootClass"
    :style="rootStyle"
    v-bind="rest"
  >
    <span class="relative inline-flex shrink-0" :class="dotSize" aria-hidden="true">
      <!-- The halo is the same colour as the light and scales out from it, so
           it stays in step with a tone change instead of lagging a beat. -->
      <span
        class="lp-status-halo absolute inset-0 rounded-full transition-[background-color,opacity] duration-(--duration-medium)"
        :class="pulsing ? 'lp-status-halo--on' : 'opacity-0'"
        :style="{ backgroundColor: TONE_COLOR[tone] }"
      />
      <span
        class="relative inline-flex size-full rounded-full transition-[background-color] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
        :style="{ backgroundColor: TONE_COLOR[tone] }"
      />
    </span>
    <span v-if="hideLabel" class="sr-only">{{ word }}</span>
    <LpShift v-else axis="width">
      <LpRollingText :value="word" align="start" />
    </LpShift>
  </span>
</template>

<style>
/*
 * Unscoped and namespaced, like LpSkeleton's pulse: one animation name keeps
 * every live light on a page breathing in phase, because CSS animations are
 * timed against the document rather than against when each one mounted. A
 * column of servers pulsing out of step reads as flicker.
 */
.lp-status-halo--on {
  animation: lp-status-halo 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes lp-status-halo {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  70%,
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-status-halo--on {
    animation: none;
    opacity: 0;
  }
}
</style>
