<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * A run of jobs and the state each one is in: a deploy, a CI workflow, a
 * server being provisioned.
 *
 * Not a wizard. LpStepper answers "where am I in a form", with one current
 * step and everything before it done; here every step has its own state —
 * three can pass, one fail and the rest never run — and the viewer is
 * watching rather than driving. So the pieces are the ones a process monitor
 * needs: a glyph per state (LpStepMark), how long each job took (ticking
 * while it runs, from `startedAt`, without the app re-sending it), the line
 * between steps filled up to where the run got and broken where it stopped,
 * and a step's inside (its sub-jobs, its log) folded under it.
 *
 *   <LpPipeline :steps="run.jobs" follow />
 *   <LpPipeline :steps="stages" orientation="horizontal" compact />
 *
 * Each change of state is announced politely ("Deploy: failed"), so a screen
 * reader user learns about the run the way a sighted one glances at it.
 */
import { computed, nextTick, ref, useId, useSlots, watch } from "vue"
import { prefersReducedMotion } from "../composables/easing"
import { useLabels } from "../composables/useLpConfig"
import { useMergedAttrs } from "../composables/useMergedClass"
import { useNow } from "../composables/useNow"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import LpStepMark from "./LpStepMark.vue"
import LpTooltip from "./LpTooltip.vue"
import {
  childProgress,
  connectorFilled,
  currentStepIndex,
  stepElapsed,
  stepKey,
  type PipelineStep,
  type StepStatus,
} from "./pipeline"
import { DEFAULT_UNIT_LABELS, formatElapsed, toEpoch, type TimeUnitLabels } from "./timeSpan"

export type PipelineLabels = Record<StepStatus, string> & {
  showDetails: string
  hideDetails: string
}

const props = withDefaults(
  defineProps<{
    steps: PipelineStep[]
    /**
     * `vertical` (default) is the job list: room for descriptions, durations
     * and folded sub-steps. `horizontal` is the strip across a card or a
     * header, where the run is read at a glance.
     */
    orientation?: "horizontal" | "vertical"
    /**
     * Smaller marks, no descriptions. Horizontal and compact is marks and
     * lines only, each step named in a tooltip — a run in a table cell.
     */
    compact?: boolean
    /** Number the pending marks, for a run whose order is part of its meaning. */
    numbered?: boolean
    /**
     * Keep the current step (see `currentStepIndex`) scrolled into view as the
     * run advances: a long job list, or a horizontal strip wider than its box.
     */
    follow?: boolean
    /**
     * Open a step on its own when it starts running or fails, if it has
     * something inside, and fold it again when it passes. That is the step the
     * viewer would open next anyway; a step the viewer opened stays open.
     */
    autoExpand?: boolean
    /** Announce status changes to screen readers. A nested pipeline turns it off so its parent speaks once. */
    announce?: boolean
    labels?: Partial<PipelineLabels>
  }>(),
  { orientation: "vertical", autoExpand: true, announce: true },
)

/** Keys of the open steps. Works uncontrolled; bind it to keep it in the app. */
const expanded = defineModel<string[]>("expanded", { default: () => [] })

defineSlots<{
  /** Inside an expanded step, under its sub-steps: a log tail, a link to the run, an error. */
  detail?: (props: { step: PipelineStep; index: number }) => unknown
}>()

const text = useLabels<PipelineLabels>(
  "pipeline",
  {
    pending: "Pending",
    running: "Running",
    success: "Passed",
    failed: "Failed",
    skipped: "Skipped",
    cancelled: "Cancelled",
    showDetails: "Show details",
    hideDetails: "Hide details",
  },
  () => props.labels,
)
const units = useLabels<TimeUnitLabels>("time", DEFAULT_UNIT_LABELS)

const slots = useSlots()
const vertical = computed(() => props.orientation === "vertical")
const markSize = computed(() => (props.compact ? "sm" : "md"))

/* The clock only runs while a step is running on its own timestamps. */
const ticking = computed(() =>
  props.steps.some((s) => s.status === "running" && s.duration === undefined && !Number.isNaN(toEpoch(s.startedAt))),
)
const now = useNow(ticking)

const elapsed = (step: PipelineStep) => {
  const ms = stepElapsed(step, now.value)
  return ms === null ? "" : formatElapsed(ms, units.value)
}

const progressText = (step: PipelineStep) => {
  const p = childProgress(step)
  return p ? `${p.done}/${p.total}` : ""
}

/* A job that has not started has no log yet; its sub-steps are still worth a look. */
const expandable = (step: PipelineStep) =>
  vertical.value && (!!step.steps?.length || (!!slots.detail && step.status !== "pending"))
const isOpen = (step: PipelineStep, i: number) => expanded.value.includes(stepKey(step, i))

function toggle(step: PipelineStep, i: number) {
  const key = stepKey(step, i)
  // Touched by the viewer: theirs now, not the pipeline's to fold away.
  autoOpened.delete(key)
  expanded.value = isOpen(step, i) ? expanded.value.filter((k) => k !== key) : [...expanded.value, key]
}

/*
 * The fill of the line leaving a step: travelled in the colour of what
 * happened (passed, skipped), flowing while the step runs, empty where the
 * run stopped or has not reached.
 */
const FILL: Partial<Record<StepStatus, string>> = {
  success: "bg-action",
  skipped: "bg-line-strong",
}

const statusText = (step: PipelineStep) => {
  const time = elapsed(step)
  return time ? `${text.value[step.status]}, ${time}` : text.value[step.status]
}

/* ── Announcements and auto-expansion: both react to a step CHANGING state. */
const announcement = ref("")
let seen = new Map<string, StepStatus>()
/* Steps the pipeline opened itself — the only ones it may close again. */
const autoOpened = new Set<string>()

watch(
  () => props.steps.map((s, i) => [stepKey(s, i), s.status] as const),
  (pairs, old) => {
    const next = new Map(pairs)
    if (old) {
      const opened: string[] = []
      const closed: string[] = []
      const said: string[] = []
      props.steps.forEach((step, i) => {
        const key = stepKey(step, i)
        const before = seen.get(key)
        if (before === undefined || before === step.status) return
        said.push(`${step.label}: ${text.value[step.status]}`)
        if (!props.autoExpand) return
        if ((step.status === "running" || step.status === "failed") && expandable(step)) opened.push(key)
        else if (connectorFilled(step.status) && autoOpened.has(key)) closed.push(key)
      })
      if (said.length && props.announce) announcement.value = said.join(". ")
      const fresh = opened.filter((k) => !expanded.value.includes(k))
      fresh.forEach((k) => autoOpened.add(k))
      closed.forEach((k) => autoOpened.delete(k))
      if (fresh.length || closed.length) {
        expanded.value = [...expanded.value.filter((k) => !closed.includes(k)), ...fresh]
      }
    }
    seen = next
  },
  { immediate: true },
)

/* ── Following the current step. */
const uid = useId()
const items: Array<Element | null> = []
const bindItem = (i: number) => (el: unknown) => { items[i] = el instanceof Element ? el : null }
const current = computed(() => currentStepIndex(props.steps))

watch(current, async (i) => {
  if (!props.follow || i < 0) return
  await nextTick()
  items[i]?.scrollIntoView({
    block: "nearest",
    inline: "center",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  })
})

const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  vertical.value
    ? "flex w-full min-w-0 flex-col"
    : `flex w-full min-w-0 items-start overflow-x-auto ${props.compact ? "gap-1.5 py-1" : "gap-3 pb-1"}`,
)
</script>

<template>
  <div class="contents">
    <ol :class="rootClass" v-bind="rest">
      <li
        v-for="(step, i) in steps"
        :key="stepKey(step, i)"
        :ref="bindItem(i)"
        :aria-current="i === current ? 'step' : undefined"
        :class="vertical
          ? 'grid grid-cols-[auto_minmax(0,1fr)] gap-x-3'
          : 'flex min-w-0 flex-1 items-start last:flex-none ' + (compact ? 'min-w-6 gap-1.5' : 'min-w-28 gap-3')"
      >
        <!-- ── Vertical: mark and line in a rail, the job beside it. -->
        <template v-if="vertical">
          <div class="flex flex-col items-center">
            <LpStepMark
              :status="step.status"
              :size="markSize"
              :number="numbered ? i + 1 : undefined"
              :icon="step.icon"
              :class="compact ? 'mt-0.5' : 'mt-px'"
            />
            <span
              v-if="i < steps.length - 1"
              class="relative my-1 w-0.5 min-h-3 flex-1 overflow-hidden rounded-pill bg-line"
              aria-hidden="true"
            >
              <span
                class="absolute inset-0 origin-top transition-[scale,background-color] duration-(--duration-slow) ease-(--ease-emphasized) motion-reduce:transition-none"
                :class="[FILL[step.status] ?? 'bg-action', connectorFilled(step.status) ? 'scale-y-100' : 'scale-y-0']"
              />
              <span v-if="step.status === 'running'" class="lp-pipe-flow lp-pipe-flow--down absolute inset-x-0 h-1/2 bg-linear-to-b from-transparent via-brand to-transparent" />
            </span>
          </div>

          <div class="min-w-0" :class="i < steps.length - 1 ? (compact ? 'pb-2' : 'pb-4') : ''">
            <component
              :is="expandable(step) ? 'button' : 'div'"
              :type="expandable(step) ? 'button' : undefined"
              :aria-expanded="expandable(step) ? isOpen(step, i) : undefined"
              :aria-controls="expandable(step) ? `${uid}-${i}` : undefined"
              class="group/row flex w-full min-w-0 items-start gap-2 rounded-control text-left"
              :class="expandable(step) && '-mx-1.5 -my-0.5 w-[calc(100%+0.75rem)] px-1.5 py-0.5 transition-colors duration-(--duration-fast) hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'"
              @click="expandable(step) && toggle(step, i)"
            >
              <span class="flex min-w-0 flex-1 flex-col">
                <span
                  class="truncate transition-colors duration-(--duration-medium)"
                  :class="[compact ? 'text-xs' : 'text-sm', step.status === 'pending' || step.status === 'skipped' ? 'text-muted' : 'text-ink', step.status === 'running' && 'font-medium']"
                >
                  {{ step.label }}
                  <span class="sr-only">({{ statusText(step) }})</span>
                </span>
                <span v-if="step.description && !compact" class="truncate text-xs text-muted">{{ step.description }}</span>
              </span>
              <span
                class="flex shrink-0 items-center gap-2 font-mono text-xs tabular-nums"
                :class="step.status === 'failed' ? 'text-danger' : 'text-muted'"
                aria-hidden="true"
              >
                <span v-if="progressText(step)" class="text-muted">{{ progressText(step) }}</span>
                <LpShift axis="width">
                  <LpRollingText v-if="elapsed(step)" :value="elapsed(step)" align="end" :duration="200" />
                </LpShift>
                <LpIcon
                  v-if="expandable(step)"
                  name="lucide:chevron-down"
                  :size="14"
                  class="text-muted transition-transform duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
                  :class="isOpen(step, i) && 'rotate-180'"
                />
              </span>
            </component>

            <LpShift axis="height">
              <div
                v-if="expandable(step) && isOpen(step, i)"
                :id="`${uid}-${i}`"
                class="flex flex-col gap-2 pt-2 animate-[fade-in_var(--duration-medium)_var(--ease-emphasized)] motion-reduce:animate-none"
              >
                <LpPipeline
                  v-if="step.steps?.length"
                  :steps="step.steps"
                  compact
                  :announce="false"
                  :auto-expand="false"
                  :labels="labels"
                  class="rounded-card border border-line bg-surface-soft/40 px-3 py-2"
                />
                <slot name="detail" :step="step" :index="i" />
              </div>
            </LpShift>
          </div>
        </template>

        <!-- ── Horizontal: mark, words, then the line to the next step. -->
        <template v-else>
          <LpTooltip v-if="compact" :content="`${step.label}: ${statusText(step)}`">
            <span
              tabindex="0"
              class="inline-flex rounded-pill focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <LpStepMark
                :status="step.status"
                size="sm"
                :number="numbered ? i + 1 : undefined"
                :icon="step.icon"
              />
              <span class="sr-only">{{ step.label }} ({{ statusText(step) }})</span>
            </span>
          </LpTooltip>
          <template v-else>
            <LpStepMark
              :status="step.status"
              :size="markSize"
              :number="numbered ? i + 1 : undefined"
              :icon="step.icon"
            />
            <span class="flex min-w-0 shrink flex-col">
              <span
                class="truncate text-sm transition-colors duration-(--duration-medium)"
                :class="[step.status === 'pending' || step.status === 'skipped' ? 'text-muted' : 'text-ink', step.status === 'running' && 'font-medium']"
              >
                {{ step.label }}
                <span class="sr-only">({{ statusText(step) }})</span>
              </span>
              <span
                class="flex h-4 items-center gap-1.5 font-mono text-[11px] tabular-nums"
                :class="step.status === 'failed' ? 'text-danger' : 'text-muted'"
                aria-hidden="true"
              >
                <LpShift axis="width">
                  <LpRollingText :value="elapsed(step) || text[step.status]" align="start" :duration="200" />
                </LpShift>
                <span v-if="progressText(step)">· {{ progressText(step) }}</span>
              </span>
            </span>
          </template>
          <span
            v-if="i < steps.length - 1"
            class="relative h-0.5 min-w-4 flex-1 self-start overflow-hidden rounded-pill bg-line"
            :class="compact ? 'mt-[7px]' : 'mt-[11px]'"
            aria-hidden="true"
          >
            <span
              class="absolute inset-0 origin-left transition-[scale,background-color] duration-(--duration-slow) ease-(--ease-emphasized) motion-reduce:transition-none rtl:origin-right"
              :class="[FILL[step.status] ?? 'bg-action', connectorFilled(step.status) ? 'scale-x-100' : 'scale-x-0']"
            />
            <span v-if="step.status === 'running'" class="lp-pipe-flow lp-pipe-flow--across absolute inset-y-0 w-1/2 bg-linear-to-r from-transparent via-brand to-transparent" />
          </span>
        </template>
      </li>
    </ol>
    <span v-if="announce" class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</span>
  </div>
</template>

<style>
/*
 * A light running along the line out of a running step: the work is moving
 * towards the next one. Unscoped and namespaced, for the keyframe names.
 */
.lp-pipe-flow--across {
  animation: lp-pipe-across 1.3s ease-in-out infinite;
}
.lp-pipe-flow--down {
  animation: lp-pipe-down 1.3s ease-in-out infinite;
}
@keyframes lp-pipe-across {
  from { transform: translateX(-100%); }
  to { transform: translateX(200%); }
}
@keyframes lp-pipe-down {
  from { transform: translateY(-100%); }
  to { transform: translateY(200%); }
}
.lp-pipe-flow--across:dir(rtl) {
  animation-direction: reverse;
}
@media (prefers-reduced-motion: reduce) {
  .lp-pipe-flow { animation: none; opacity: 0.5; transform: none; }
}
</style>
