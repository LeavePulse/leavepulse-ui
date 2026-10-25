<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Time left until something: "resend the code in 0:42", "maintenance in
 * 2d 3h", "the lobby closes in 4:59".
 *
 *   Resend in <LpCountdown :seconds="45" @done="canResend = true" />
 *   <LpCountdown :to="window.startsAt" format="units" />
 *   <LpCountdown :seconds="300" progress="ring" :urgent-at="30" />
 *
 * What it takes care of so the app does not:
 *
 *   - the format adapts: a clock under an hour, the two largest units above
 *     it (timeSpan.ts), and it rounds up, so 0:00 means "now", not "nearly";
 *   - no drift: the remaining time is always deadline − now, read from the
 *     clock on each tick (useNow), and ticks land on the second boundary; a
 *     tab left in the background stops ticking and is right again the
 *     moment it is looked at;
 *   - digits roll individually (LpRollingText), so 0:42 → 0:41 moves one
 *     digit and a minute rolling over moves three;
 *   - role="timer", which is silent by design, plus a polite announcement at
 *     round marks (10 minutes, 1 minute, 10 seconds…) and at the end — a
 *     screen reader hears the countdown matter, not every second of it.
 */
import { computed, ref, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useNow } from "../composables/useNow"
import LpProgress from "./LpProgress.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import {
  ceilToSecond,
  crossedMilestone,
  DEFAULT_MILESTONES,
  DEFAULT_UNIT_LABELS,
  formatTime,
  msToNextSecond,
  padPart,
  resolveFormat,
  timeParts,
  toEpoch,
  type TimeFormat,
  type TimeUnitLabels,
} from "./timeSpan"

export type CountdownLabels = {
  /** Spoken at a milestone; `{time}` is the time left in words. */
  left: string
  /** Spoken when the time is up, and the timer's name from then on. */
  done: string
}

const props = withDefaults(
  defineProps<{
    /** The moment to count down to. Takes precedence over `seconds`. */
    to?: Date | string | number
    /**
     * Count down this many seconds from when the countdown mounts — or from
     * when this value changes, or `restart()` is called. For "try again in 45
     * s", where the app has a wait rather than a moment.
     */
    seconds?: number
    /**
     * `to` only: when the wait began, so the ring or bar can show how much of
     * it is left. Without it a `to` countdown draws no progress.
     */
    from?: Date | string | number
    /** `auto` is a clock under an hour and units above it. */
    format?: TimeFormat
    /** Units format: how many places to keep ("2d 3h" is 2). */
    places?: number
    /**
     * Freeze the count. A `seconds` countdown resumes where it stopped; a `to`
     * countdown is tied to a real moment, so it resumes at the true time left.
     */
    paused?: boolean
    /** Draw the time left as a ring around the digits, or a bar under them. */
    progress?: "ring" | "bar"
    /** Ring only: outer diameter in px. */
    ringSize?: number
    /** Seconds left at which it turns danger: the end is close enough to act on. */
    urgentAt?: number
    /**
     * Announce the time left at these marks (ms remaining) and at the end.
     * `false` keeps it silent apart from what the timer role itself offers.
     */
    announce?: boolean | number[]
    labels?: Partial<CountdownLabels>
  }>(),
  { format: "auto", places: 2, ringSize: 56, announce: true },
)

const emit = defineEmits<{
  /** The time is up. Fires once per countdown (again after a restart). */
  done: []
}>()

defineSlots<{
  /** Replaces the digits once the time is up: a "Resend" button, "Live now". */
  done?: () => unknown
}>()

const text = useLabels<CountdownLabels>("countdown", { left: "{time} left", done: "Time is up" }, () => props.labels)
const units = useLabels<TimeUnitLabels>("time", DEFAULT_UNIT_LABELS)

/* What the polite live region last said. */
const announcement = ref("")

/* ── The deadline, and the start it is measured from. */
const startedAt = ref(Date.now())

const deadline = computed(() => {
  const to = toEpoch(props.to)
  if (!Number.isNaN(to)) return to
  if (typeof props.seconds === "number" && Number.isFinite(props.seconds)) return startedAt.value + props.seconds * 1000
  return Number.NaN
})

const total = computed(() => {
  if (!Number.isNaN(toEpoch(props.to))) {
    const from = toEpoch(props.from)
    return Number.isNaN(from) ? Number.NaN : deadline.value - from
  }
  return typeof props.seconds === "number" ? props.seconds * 1000 : Number.NaN
})

/*
 * Pausing freezes the remaining time; resuming a `seconds` countdown moves
 * its start forward by the pause, so the wait continues where it stood.
 */
const frozen = ref<number | null>(null)
let pausedAt = 0

watch(
  () => props.paused,
  (paused) => {
    if (paused) {
      pausedAt = Date.now()
      frozen.value = Math.max(0, deadline.value - pausedAt)
    } else if (frozen.value !== null) {
      if (Number.isNaN(toEpoch(props.to))) startedAt.value += Date.now() - pausedAt
      frozen.value = null
    }
  },
  { immediate: true },
)

const running = ref(true)
const now = useNow(() => running.value && !props.paused && Number.isFinite(deadline.value), {
  nextIn: (at) => msToNextSecond(deadline.value - at),
})

const remaining = computed(() => {
  if (frozen.value !== null) return frozen.value
  const left = deadline.value - now.value
  return Number.isFinite(left) ? Math.max(0, left) : 0
})

const shown = computed(() => ceilToSecond(remaining.value))
const isDone = computed(() => !Number.isNaN(deadline.value) && remaining.value <= 0)

watch(isDone, (done) => { running.value = !done }, { immediate: true })

/* ── The end, once per countdown. */
let fired = false
watch(
  isDone,
  (done) => {
    if (!done) { fired = false; return }
    if (fired) return
    fired = true
    emit("done")
    if (props.announce !== false) announcement.value = text.value.done
  },
  { immediate: true },
)

/** Starts a `seconds` countdown again from the full wait. */
function restart() {
  // Cleared so the next "time is up" is a change the live region announces.
  announcement.value = ""
  startedAt.value = Date.now()
  now.value = startedAt.value
  if (props.paused) {
    pausedAt = startedAt.value
    frozen.value = Math.max(0, deadline.value - pausedAt)
  }
}

watch(() => props.seconds, () => { if (Number.isNaN(toEpoch(props.to))) restart() })

defineExpose({ restart, remaining })

/* ── What is printed and what is said. */
const parts = computed(() => timeParts(shown.value, props.format, units.value, props.places))
const clock = computed(() => resolveFormat(shown.value, props.format) === "clock")

/*
 * Each part's digits, keyed from the right: a part that gains a digit (9:59 →
 * 10:00) grows it on the left without re-keying the ones that were there.
 */
const cells = computed(() =>
  parts.value.map((part) => {
    const digits = padPart(part).split("")
    return { part, digits: digits.map((d, i) => ({ d, key: `${part.unit}${digits.length - i}` })) }
  }),
)

const spokenTime = computed(() => formatTime(shown.value, "units", units.value, 2))

const milestones = computed(() => (Array.isArray(props.announce) ? props.announce : DEFAULT_MILESTONES))

watch(remaining, (after, before) => {
  if (props.announce === false || before === undefined || props.paused) return
  const mark = crossedMilestone(before, after, milestones.value)
  if (mark !== null && after > 0) {
    announcement.value = text.value.left.replace("{time}", formatTime(ceilToSecond(after), "units", units.value, 2))
  }
})

const urgent = computed(() =>
  props.urgentAt !== undefined && !isDone.value && remaining.value <= props.urgentAt * 1000,
)

const fraction = computed(() => {
  if (!(total.value > 0)) return null
  return Math.max(0, Math.min(1, remaining.value / total.value))
})

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  props.progress === "bar"
    ? "flex w-full min-w-0 flex-col gap-1.5"
    : "relative inline-flex items-center justify-center align-baseline",
)
</script>

<template>
  <span
    :class="rootClass"
    :data-urgent="urgent || undefined"
    :data-done="isDone || undefined"
    v-bind="rest"
  >
    <LpProgress
      v-if="progress === 'ring' && fraction !== null"
      variant="ring"
      :value="fraction * 100"
      :size="ringSize"
      :thickness="Math.max(3, Math.round(ringSize / 14))"
      :tone="urgent ? 'danger' : 'brand'"
      :animate-on-mount="false"
      :duration="1000"
      aria-hidden="true"
    />
    <span
      role="timer"
      :aria-label="isDone ? text.done : spokenTime"
      class="inline-flex items-baseline font-mono tabular-nums transition-colors duration-(--duration-medium) motion-reduce:transition-none"
      :class="[
        urgent ? 'text-danger' : '',
        progress === 'ring' && fraction !== null ? 'absolute text-xs font-medium' : '',
      ]"
    >
      <LpShift axis="width">
        <Transition
          mode="out-in"
          enter-active-class="transition-opacity duration-(--duration-fast) ease-(--ease-emphasized) motion-reduce:transition-none"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-(--duration-fast) ease-out motion-reduce:transition-none"
          leave-to-class="opacity-0"
        >
          <span v-if="isDone && $slots.done" key="done" class="inline-flex font-sans">
            <slot name="done" />
          </span>
          <span v-else key="time" class="inline-flex items-baseline whitespace-nowrap" aria-hidden="true">
            <template v-for="(cell, ci) in cells" :key="cell.part.unit">
              <LpRollingText
                v-for="digit in cell.digits"
                :key="digit.key"
                :value="digit.d"
                direction="down"
                :duration="260"
              />
              <span v-if="clock" class="px-px">{{ cell.part.after }}</span>
              <span v-else class="font-sans text-[0.85em] text-muted" :class="ci < cells.length - 1 && 'mr-[0.35em]'">{{ cell.part.after }}</span>
            </template>
          </span>
        </Transition>
      </LpShift>
    </span>
    <LpProgress
      v-if="progress === 'bar' && fraction !== null"
      :value="fraction * 100"
      :tone="urgent ? 'danger' : 'brand'"
      :animate-on-mount="false"
      :duration="1000"
      aria-hidden="true"
    />
    <span v-if="announce !== false" class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</span>
  </span>
</template>
