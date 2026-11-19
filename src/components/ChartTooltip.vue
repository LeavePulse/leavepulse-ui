<script setup lang="ts">
/*
 * LpChart's hover card: the point's label and every visible series' reading.
 *
 * It trails the pointer on a soft spring rather than being pinned to it. Two
 * reasons it is animated rather than positioned directly: the crosshair SNAPS
 * to the nearest point, so a pinned card would jump a whole band at a time
 * sideways while gliding vertically; and a card that lags slightly reads as
 * following the cursor instead of being welded to it.
 */
import { Motion } from "motion-v"
import LpShift from "./LpShift.vue"
import { PANEL_SURFACE } from "./dropdown"
import { usePillTransition } from "../composables/usePillTransition"

defineProps<{
  label: string
  rows: readonly { id: string; name: string; color: string; text: string }[]
  /** Where the card points from; `flip` puts it on the left of that point. */
  target: { x: number; y: number; flip: boolean }
}>()

const floatTransition = usePillTransition("float")
</script>

<template>
  <Motion
    as="div"
    class="pointer-events-none absolute left-0 top-0 z-(--z-tooltip) min-w-32 px-2.5 py-2 group-data-[state=open]/plot:hidden"
    :class="PANEL_SURFACE"
    :initial="{ opacity: 0, scale: 0.96 }"
    :animate="{
      opacity: 1,
      scale: 1,
      x: target.flip ? `calc(${target.x}px - 100%)` : `${target.x}px`,
      y: `calc(${target.y}px - 50%)`,
    }"
    :transition="floatTransition"
  >
    <!-- A point where one series has no value drops a row; easing the box
         keeps the card from snapping mid-glide. -->
    <LpShift axis="both">
      <div class="mb-1 text-[11px] font-medium text-muted-strong">
        {{ label }}
      </div>
      <div class="flex flex-col gap-1">
        <div
          v-for="r in rows"
          :key="r.id"
          class="flex items-center justify-between gap-3 text-xs"
        >
          <span class="flex items-center gap-1.5 text-muted">
            <span class="size-1.5 shrink-0 rounded-full" :style="{ backgroundColor: r.color }" />
            {{ r.name }}
          </span>
          <span class="font-mono tabular-nums text-ink">{{ r.text }}</span>
        </div>
      </div>
    </LpShift>
  </Motion>
</template>
