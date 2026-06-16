<script setup lang="ts">
import LpIcon from "./LpIcon.vue"

export interface Step {
  label: string
}

defineProps<{ steps: Step[]; current: number }>()
</script>

<template>
  <ol class="flex items-center gap-2">
    <li
      v-for="(step, i) in steps"
      :key="i"
      class="flex flex-1 items-center gap-2 last:flex-none"
    >
      <div class="flex items-center gap-2">
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-pill border text-xs font-semibold transition-colors"
          :class="i < current
            ? 'border-transparent bg-brand text-ink-inverse'
            : i === current
              ? 'border-brand text-brand'
              : 'border-line text-muted'"
        >
          <LpIcon v-if="i < current" name="lucide:check" :size="14" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="text-sm" :class="i <= current ? 'text-ink' : 'text-muted'">
          {{ step.label }}
        </span>
      </div>
      <span
        v-if="i < steps.length - 1"
        class="h-px flex-1"
        :class="i < current ? 'bg-brand' : 'bg-line'"
      />
    </li>
  </ol>
</template>
