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
 */
import { computed } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpIcon from "./LpIcon.vue"
import LpLoader from "./LpLoader.vue"
import LpRollingText from "./LpRollingText.vue"
import type { StepStatus } from "./pipeline"

const props = withDefaults(
  defineProps<{
    status: StepStatus
    size?: "sm" | "md" | "lg"
    /** Shown inside a pending mark: the step's number in a numbered flow. */
    number?: number | string
    /** Shown inside a pending mark instead of the number. */
    icon?: string
    /** Accessible name; without it the mark is hidden from assistive tech. */
    label?: string
  }>(),
  { size: "md" },
)

const BOX = { sm: "size-4 text-[9px]", md: "size-6 text-[11px]", lg: "size-8 text-xs" }
const GLYPH = { sm: 10, md: 14, lg: 18 }

const TONE: Record<StepStatus, string> = {
  pending: "border-line-strong bg-surface text-muted",
  running: "border-brand bg-brand-soft text-brand",
  success: "border-transparent bg-action text-ink-inverse",
  failed: "border-transparent bg-danger text-ink-inverse",
  skipped: "border-dashed border-line-strong bg-surface text-muted",
  cancelled: "border-line-strong bg-surface-soft text-muted-strong",
}

const ICON: Partial<Record<StepStatus, string>> = {
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
  if (props.status !== "pending") return props.status
  if (props.icon) return "icon"
  return props.number !== undefined ? `n:${props.number}` : "pending"
})

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  `relative inline-flex shrink-0 items-center justify-center rounded-pill border font-semibold tabular-nums transition-[color,background-color,border-color] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none ${BOX[props.size]} ${TONE[props.status]}`,
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
        <LpIcon v-else-if="ICON[value as StepStatus]" :name="ICON[value as StepStatus]!" :size="GLYPH[size]" />
        <LpIcon v-else-if="value === 'icon' && icon" :name="icon" :size="GLYPH[size] - 2" />
        <template v-else-if="String(value).startsWith('n:')">{{ number }}</template>
        <!-- An empty slot would fall back to printing the raw key. -->
        <span v-else class="block size-0" />
      </template>
    </LpRollingText>
  </span>
</template>

<style>
/* A ring that swells off the mark and fades: "this one is happening now". */
.lp-step-halo {
  animation: lp-step-halo 1.6s var(--ease-emphasized, ease-out) infinite;
}
@keyframes lp-step-halo {
  0% { transform: scale(1); opacity: 0.55; }
  70%, 100% { transform: scale(1.6); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-step-halo { animation: none; opacity: 0; }
}
</style>
