<script setup lang="ts">
import type { TourStep } from "./LpTour.vue"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpKeys from "./LpKeys.vue"

defineProps<{
  step: TourStep | undefined
  index: number
  last: boolean
  progress: string
  labels: { next: string; back: string; done: string; close: string; perform: string; tryIt: string }
}>()

defineEmits<{
  (e: "next"): void
  (e: "back"): void
  (e: "perform"): void
  (e: "dismiss"): void
}>()
</script>

<template>
  <div class="flex items-start justify-between gap-3">
    <p class="font-medium" aria-live="polite">{{ step?.title }}</p>
    <button type="button" class="text-muted hover:text-ink" :aria-label="labels.close" @click="$emit('dismiss')">
      <LpIcon name="lucide:x" class="size-4" />
    </button>
  </div>
  <p v-if="step?.text" class="mt-1.5 text-muted">{{ step.text }}</p>
  <LpKeys v-if="step?.keys" :combo="step.keys" size="sm" class="mt-2" />
  <p v-if="step?.try" class="mt-2 text-xs text-brand">{{ labels.tryIt }}</p>
  <div class="mt-4 flex items-center justify-between gap-2">
    <span class="text-xs tabular-nums text-muted">{{ progress }}</span>
    <div class="flex gap-2">
      <LpButton v-if="index > 0" size="sm" variant="ghost" @click="$emit('back')">{{ labels.back }}</LpButton>
      <LpButton v-if="step?.try && step.perform" size="sm" variant="outline" @click="$emit('perform')">{{ labels.perform }}</LpButton>
      <LpButton size="sm" :variant="step?.try ? 'ghost' : undefined" @click="$emit('next')">{{ last ? labels.done : labels.next }}</LpButton>
    </div>
  </div>
</template>
