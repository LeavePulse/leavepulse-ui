<script setup lang="ts">
/*
 * The "Example" tag on a sample: LpHintExample's block and a data component
 * drawing made-up data for a tour step. Sits on the top edge of its
 * positioned parent.
 */
import { useLabels } from "../composables/useLpConfig"

const props = defineProps<{ labels?: Partial<{ badge: string }> }>()

const labels = useLabels("hintExample", { badge: "Example" }, () => props.labels)
</script>

<template>
  <span
    class="pointer-events-none absolute -top-2 right-3 z-10 rounded-pill border border-brand/40 bg-surface-raised px-1.5 py-px text-[10px] font-medium tracking-wide text-brand"
  >{{ labels.badge }}</span>
</template>
