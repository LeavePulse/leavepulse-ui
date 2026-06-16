<script setup lang="ts">
import { ProgressIndicator, ProgressRoot } from "reka-ui"
import { computed } from "vue"

const props = withDefaults(
  defineProps<{ value?: number; max?: number; tone?: "brand" | "action" | "danger" }>(),
  { value: 0, max: 100, tone: "brand" },
)

const pct = computed(() => Math.max(0, Math.min(100, (props.value / props.max) * 100)))
const bar: Record<string, string> = {
  brand: "bg-brand",
  action: "bg-action",
  danger: "bg-danger",
}
</script>

<template>
  <ProgressRoot
    :model-value="value"
    :max="max"
    class="h-1.5 w-full overflow-hidden rounded-pill bg-surface-soft"
  >
    <ProgressIndicator
      class="h-full rounded-pill transition-[width] duration-300 ease-[var(--ease-emphasized)]"
      :class="bar[tone]"
      :style="{ width: `${pct}%` }"
    />
  </ProgressRoot>
</template>
