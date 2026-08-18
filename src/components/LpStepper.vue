<script setup lang="ts">
import { computed } from "vue"
import LpIcon from "./LpIcon.vue"

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
</script>

<template>
  <ol class="flex items-center gap-2">
    <li
      v-for="(step, i) in steps"
      :key="step.key ?? i"
      class="flex flex-1 items-center gap-2 last:flex-none"
      :aria-current="isCurrent(i) ? 'step' : undefined"
    >
      <div class="flex items-center gap-2">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-pill border text-xs font-semibold transition-colors"
          :class="isCompleted(step, i)
            ? 'border-transparent bg-brand text-ink-inverse'
            : isCurrent(i)
              ? 'border-brand text-brand'
              : 'border-line text-muted'"
        >
          <LpIcon v-if="isCompleted(step, i)" name="lucide:check" :size="14" />
          <LpIcon v-else-if="step.icon" :name="step.icon" :size="14" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span
          class="text-sm"
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
      </div>
      <span
        v-if="i < steps.length - 1"
        class="h-px flex-1"
        :class="isCompleted(step, i) ? 'bg-brand' : 'bg-line'"
      />
    </li>
  </ol>
</template>
