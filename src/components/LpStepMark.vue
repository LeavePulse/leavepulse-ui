<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * The state of one job as a round glyph: hollow while it waits, spinning while
 * it runs, a tick, a cross, a dash for skipped, a slash for cancelled.
 *
 * LpPipeline draws its steps with it, and it stands alone wherever a single
 * job's state sits next to its name: a row in a deploys table, a check in a
 * list, a toast about a build. A change of status is a change the viewer is
 * waiting for, so it shows as one: the colours ease, the glyph flips to the
 * new one (LpRollingText), and a running mark breathes a halo so it reads as
 * live even while the spinner is small.
 *
 * Decorative by default (the text next to it says the state); pass `label`
 * when the mark is all there is.
 *
 * `variant="step"` is the same mark as a wizard draws it (LpStepper): the
 * step you are on is a brand ring with its number (`status="current"`), a
 * finished one is filled with the brand colour rather than the "passed"
 * green, and the ones ahead are a quiet ring with no fill of their own.
 */
import { computed } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpIcon from "./LpIcon.vue"
import LpLoader from "./LpLoader.vue"
import LpRollingText from "./LpRollingText.vue"
import type { StepStatus } from "./pipeline"
import { TONES } from "./tone"

/** A job's state, plus `current`: the step a person is on in a flow they drive. */
export type StepMarkStatus = StepStatus | "current"

const props = withDefaults(
  defineProps<{
    status: StepMarkStatus
    /** `status` (default) colours a job's outcome; `step` is a wizard's step (see above). */
    variant?: "status" | "step"
    size?: "sm" | "md" | "lg"
    /** Shown inside a pending mark: the step's number in a numbered flow. */
    number?: number | string
    /** Shown inside a pending mark instead of the number. */
    icon?: string
    /** Accessible name; without it the mark is hidden from assistive tech. */
    label?: string
  }>(),
  { variant: "status", size: "md" },
)

const BOX = { sm: "size-4 text-[9px]", md: "size-6 text-[11px]", lg: "size-8 text-xs" }
const GLYPH = { sm: 10, md: 14, lg: 18 }

// Outcomes in the kit's tones (tone.ts): a ring for what is under way, a solid
// disc for what is decided. The quiet states are greys, not tones.
const TONE: Record<StepMarkStatus, string> = {
  pending: "border-line-strong bg-surface text-muted",
  current: `bg-surface ${TONES.brand.border} ${TONES.brand.text}`,
  running: `${TONES.brand.border} ${TONES.brand.chip}`,
  success: `border-transparent text-ink-inverse ${TONES.success.bg}`,
  failed: `border-transparent text-ink-inverse ${TONES.danger.bg}`,
  skipped: "border-dashed border-line-strong bg-surface text-muted",
  cancelled: "border-line-strong bg-surface-soft text-muted-strong",
}

// A wizard's step sits on whatever surface the form has, so only its ring and number are its own.
const STEP_TONE: Partial<Record<StepMarkStatus, string>> = {
  pending: "border-line text-muted",
  current: `${TONES.brand.border} ${TONES.brand.text}`,
  success: `border-transparent text-ink-inverse ${TONES.brand.bg}`,
}

const ICON: Partial<Record<StepMarkStatus, string>> = {
  success: "lucide:check",
  failed: "lucide:x",
  skipped: "lucide:minus",
  cancelled: "lucide:slash",
}

/*
 * What the glyph shows, as one value the roll keys on: a status change flips
 * it, a pending step's number changing (a reordered flow) flips it too.
 */
const glyph = computed(() => {
  // Pending and current show the same thing, so arriving at a step keeps its number in place.
  if (props.status !== "pending" && props.status !== "current") return props.status
  if (props.icon) return "icon"
  return props.number !== undefined ? `n:${props.number}` : "pending"
})

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  `relative inline-flex shrink-0 items-center justify-center rounded-pill border font-semibold tabular-nums transition-[color,background-color,border-color] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none ${BOX[props.size]} ${(props.variant === "step" && STEP_TONE[props.status]) || TONE[props.status]}`,
)
</script>

<template>
  <span
    :class="rootClass"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    :data-status="status"
    v-bind="rest"
  >
    <span v-if="status === 'running'" class="lp-step-halo pointer-events-none absolute -inset-px rounded-pill border border-brand" />
    <LpRollingText mode="flip" :duration="260" :value="glyph">
      <template #default="{ value }">
        <LpLoader
          v-if="value === 'running'"
          :delay="0"
          :min-visible="0"
          size="inline"
          :class="size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-sm' : 'text-lg'"
        />
        <LpIcon v-else-if="ICON[value as StepMarkStatus]" :name="ICON[value as StepMarkStatus]!" :size="GLYPH[size]" />
        <LpIcon v-else-if="value === 'icon' && icon" :name="icon" :size="variant === 'step' ? GLYPH[size] : GLYPH[size] - 2" />
        <template v-else-if="String(value).startsWith('n:')">{{ number }}</template>
        <!-- An empty slot would fall back to printing the raw key. -->
        <span v-else class="block size-0" />
      </template>
    </LpRollingText>
  </span>
</template>

<style>
/* The kit's halo (tokens.css), swelling less: this ring already starts at the mark's own size. */
.lp-step-halo {
  --halo-scale: 1.6;
  animation: lp-halo 1.6s var(--ease-emphasized, ease-out) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .lp-step-halo { animation: none; opacity: 0; }
}
</style>
