<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { computed } from "vue"
import LpStepMark from "./LpStepMark.vue"
import StepConnector from "./StepConnector.vue"
import { useMergedAttrs } from "../composables/useMergedClass"

export interface Step {
  label: string
  /** Stable id, for flows whose steps are addressed by name rather than order. */
  key?: string
  /** Replaces the step number while the step is pending or current. */
  icon?: string
}

const props = defineProps<{
  steps: Step[]
  /**
   * The active step: an index, or a step `key` for keyed flows.
   */
  current: number | string
  /**
   * Which steps count as done. Omit it and everything before `current` is
   * complete, which is the linear case. Pass keys (or indices) when a flow can
   * finish steps out of order — a verification that succeeds before its
   * prerequisite is filled in, say.
   */
  completed?: Array<string | number>
}>()

const currentIndex = computed(() => {
  if (typeof props.current === "number") return props.current
  return props.steps.findIndex((s) => s.key === props.current)
})

function isCompleted(step: Step, i: number): boolean {
  if (!props.completed) return i < currentIndex.value
  return props.completed.includes(i) || (!!step.key && props.completed.includes(step.key))
}

function isCurrent(i: number): boolean {
  return i === currentIndex.value
}

// The stepper spaces its steps evenly; a compact wizard header needs that spacing under the consumer's control.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "@container flex w-full min-w-0 items-center gap-2",
)
</script>

<template>
  <ol
    :class="rootClass"
    v-bind="rest">
    <li
      v-for="(step, i) in steps"
      :key="step.key ?? i"
      class="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
      :aria-current="isCurrent(i) ? 'step' : undefined"
    >
      <div class="flex min-w-0 items-center">
        <!-- The kit's step mark, as a wizard draws it: the number turns into the
             tick rather than swapping for it. -->
        <LpStepMark
          variant="step"
          :status="isCompleted(step, i) ? 'success' : isCurrent(i) ? 'current' : 'pending'"
          :number="i + 1"
          :icon="step.icon"
          class="size-7 text-xs"
        />
        <!-- Where only the current step has room for its name (a narrow
             container), the others fold their label to nothing rather than
             dropping it in one frame: the row slides instead of jumping when
             the step changes. Folded, the words stay in the reading order. -->
        <span
          class="grid min-w-0 grid-cols-[1fr] transition-[grid-template-columns,opacity] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
          :class="!isCurrent(i) && '@max-md:grid-cols-[0fr] @max-md:opacity-0'"
        >
          <span class="min-w-0 overflow-hidden">
            <span
              class="block truncate pl-2 text-sm transition-colors duration-[var(--duration-medium)]"
              :class="isCompleted(step, i) || isCurrent(i) ? 'text-ink' : 'text-muted'"
            >
              {{ step.label }}
              <!-- Status for screen readers; the colour/check are visual only. -->
              <span class="sr-only">{{
                isCompleted(step, i)
                  ? "(completed)"
                  : isCurrent(i)
                    ? "(current step)"
                    : ""
              }}</span>
            </span>
          </span>
        </span>
      </div>
      <!-- The connector fills from the step it leaves towards the next one,
           so finishing a step reads as moving forward. -->
      <StepConnector v-if="i < steps.length - 1" :filled="isCompleted(step, i)" class="h-px" />
    </li>
  </ol>
</template>
