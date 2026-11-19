<script setup lang="ts">
/*
 * LpChart's stand-in while `loading`: a pulsing sketch of the chart's own type
 * in the area the marks will take, laid out with the real plot's margins.
 */
import { computed } from "vue"
import LpSkeleton from "./LpSkeleton.vue"
import { skeletonHeights, skeletonWave } from "./chartSkeleton"

const props = defineProps<{
  type: "line" | "area" | "bar"
  height: number
  /** Points the chart will have, when already known; 0 when not. */
  points: number
  yTicks: number
  showGrid?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  loadingLabel: string
}>()

// As many bars as the chart will have, when that is already known (labels
// usually are); a dozen otherwise.
const bars = computed(() => skeletonHeights(Math.min(props.points || 12, 24)))
// The line takes a few gentle swells whatever the point count: a curve through
// two dozen pseudo-points reads as noise, not as "a line goes here".
const path = skeletonWave(skeletonHeights(8))
const ticks = computed(() => Math.max(2, props.yTicks) + 1)
</script>

<template>
  <div :style="{ height: `${height}px` }">
    <span class="sr-only">{{ loadingLabel }}</span>
    <!-- Laid out with the real box's margins: tick stubs in the y gutter,
         labels under the x axis, the marks in between. -->
    <LpSkeleton
      class="flex size-full"
      :style="{ paddingTop: '10px', paddingBottom: showXAxis ? '26px' : '8px' }"
    >
      <div v-if="showYAxis" class="flex w-9 shrink-0 flex-col justify-between pr-2">
        <div v-for="n in ticks" :key="n" class="lp-skeleton-item h-2 w-full -translate-y-1 rounded-control bg-surface-soft" />
      </div>
      <div class="relative min-w-0 flex-1">
        <div v-if="showGrid" class="absolute inset-0 flex flex-col justify-between">
          <div v-for="n in ticks" :key="n" class="h-px bg-line" />
        </div>
        <div v-if="type === 'bar'" class="absolute inset-0 flex items-end gap-[2%] px-[1%]">
          <div
            v-for="(h, i) in bars"
            :key="i"
            class="lp-skeleton-item min-w-0 flex-1 rounded-t-[3px] bg-surface-soft"
            :style="{ height: `${h * 100}%` }"
          />
        </div>
        <svg
          v-else
          class="absolute inset-0 size-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            v-if="type === 'area'"
            class="lp-skeleton-item"
            :d="`${path} L100 100 L0 100 Z`"
            fill="var(--color-surface-soft)"
          />
          <path
            class="lp-skeleton-item"
            :d="path"
            fill="none"
            stroke="var(--color-surface-soft)"
            stroke-width="3"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <div
          v-if="showXAxis"
          class="absolute inset-x-0 -bottom-[18px] flex justify-between"
        >
          <div v-for="n in 5" :key="n" class="lp-skeleton-item h-2 w-8 rounded-control bg-surface-soft" />
        </div>
      </div>
    </LpSkeleton>
  </div>
</template>
