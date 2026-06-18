<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui"
import { computed } from "vue"
import { PANEL_SURFACE, TOOLTIP_ANIM } from "./dropdown"

export type UptimeStatus = "operational" | "degraded" | "down" | "maintenance" | "empty"

export interface UptimeSegment {
  /** Health of this slice. `empty` renders a faded placeholder (no data). */
  status: UptimeStatus
  /** Optional rich tooltip body; falls back to a humanised status. */
  label?: string
}

const props = withDefaults(
  defineProps<{
    /** Oldest → newest. Each entry is one slice of the timeline. */
    segments: UptimeSegment[]
    /** Caption shown under the left edge (oldest point). */
    startLabel?: string
    /** Caption shown under the right edge (newest point). */
    endLabel?: string
    /** Show the computed uptime % above the bar. */
    showUptime?: boolean
    /** Override the headline shown next to the uptime %. */
    title?: string
  }>(),
  { showUptime: true },
)

const segColor: Record<UptimeStatus, string> = {
  operational: "bg-action",
  degraded: "bg-accent",
  down: "bg-danger",
  maintenance: "bg-brand",
  empty: "bg-surface-soft",
}

const statusLabel: Record<UptimeStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  maintenance: "Maintenance",
  empty: "No data",
}

// Uptime counts only slices with data; operational + maintenance are "up".
const uptimePct = computed(() => {
  const tracked = props.segments.filter((s) => s.status !== "empty")
  if (!tracked.length) return null
  const up = tracked.filter((s) => s.status === "operational" || s.status === "maintenance").length
  return (up / tracked.length) * 100
})

const uptimeText = computed(() => {
  const v = uptimePct.value
  if (v == null) return "—"
  // Trim trailing zeros: 100, 99.98, 99.9.
  return `${Number(v.toFixed(2))}%`
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="showUptime || title" class="flex items-baseline justify-between gap-3 text-xs">
      <span v-if="title" class="font-medium text-ink">{{ title }}</span>
      <span v-else />
      <span v-if="showUptime" class="tabular-nums text-muted-strong">
        {{ uptimeText }}<span class="text-muted"> uptime</span>
      </span>
    </div>

    <TooltipProvider :delay-duration="120">
      <div class="flex h-7 items-stretch gap-0.5">
        <TooltipRoot v-for="(seg, i) in segments" :key="i">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="min-w-0 flex-1 rounded-xs outline-none transition-[scale,opacity] duration-150 hover:scale-y-110 focus-visible:ring-2 focus-visible:ring-ring"
              :class="[segColor[seg.status], seg.status === 'empty' ? 'opacity-50' : '']"
              :aria-label="seg.label ?? statusLabel[seg.status]"
            />
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              :side-offset="6"
              :class="[PANEL_SURFACE, TOOLTIP_ANIM, 'z-(--z-tooltip) px-2.5 py-1.5 text-xs text-ink']"
            >
              <span class="flex items-center gap-1.5">
                <span class="size-1.5 shrink-0 rounded-full" :class="segColor[seg.status]" />
                {{ seg.label ?? statusLabel[seg.status] }}
              </span>
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </div>
    </TooltipProvider>

    <div
      v-if="startLabel || endLabel"
      class="flex items-center justify-between text-xs text-muted"
    >
      <span>{{ startLabel }}</span>
      <span>{{ endLabel }}</span>
    </div>
  </div>
</template>
