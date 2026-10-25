<script setup lang="ts">
import type { TourStep } from "./LpTour.vue"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpKeys from "./LpKeys.vue"
import LpRollingText from "./LpRollingText.vue"
import LpShift from "./LpShift.vue"
import LpSwap from "./LpSwap.vue"

defineProps<{
  step: TourStep | undefined
  index: number
  last: boolean
  progress: string
  labels: { next: string; back: string; done: string; close: string; perform: string; tryIt: string; example: string }
}>()

defineEmits<{
  (e: "next"): void
  (e: "back"): void
  (e: "perform"): void
  (e: "dismiss"): void
}>()
</script>

<template>
  <!-- A step is another piece of content in the same card: it swaps in and the
       card eases to its height (LpSwap), the count and the main button roll,
       and the button row eases when Back joins it, so moving on reads as the
       card turning a page rather than being redrawn. -->
  <LpSwap :swap-key="index">
    <div class="flex items-start justify-between gap-3">
      <p class="font-medium" aria-live="polite">{{ step?.title }}</p>
      <button type="button" class="text-muted hover:text-ink" :aria-label="labels.close" @click="$emit('dismiss')">
        <LpIcon name="lucide:x" class="size-4" />
      </button>
    </div>
    <p v-if="step?.text" class="mt-1.5 text-muted">{{ step.text }}</p>
    <LpKeys v-if="step?.keys" :combo="step.keys" size="sm" class="mt-2" />
    <p v-if="step?.try" class="mt-2 text-xs text-brand">{{ labels.tryIt }}</p>
    <p v-if="step?.example" class="mt-2 text-xs text-muted">{{ labels.example }}</p>
  </LpSwap>
  <div class="mt-4 flex items-center justify-between gap-2">
    <LpRollingText class="text-xs tabular-nums text-muted" :value="progress" align="start" />
    <LpShift axis="width">
      <div class="flex gap-2">
        <LpButton v-if="index > 0" size="sm" variant="ghost" @click="$emit('back')">{{ labels.back }}</LpButton>
        <LpButton v-if="step?.try && step.perform" size="sm" variant="outline" @click="$emit('perform')">{{ labels.perform }}</LpButton>
        <LpButton size="sm" :variant="step?.try ? 'ghost' : undefined" @click="$emit('next')">
          <LpRollingText :value="last ? labels.done : labels.next" />
        </LpButton>
      </div>
    </LpShift>
  </div>
</template>
