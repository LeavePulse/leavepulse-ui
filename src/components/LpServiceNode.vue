<script setup lang="ts">
/**
 * Custom Vue Flow node for a SERVICE inside a host frame on LpTopologyCanvas.
 * Smaller than LpInfraNode (a host). Coloured by kind (service/database/infra).
 * depends_on edges connect these across host frames. Tailwind utilities only
 * (no scoped CSS) so styles reach consumer apps via @source.
 */
import { Handle, Position } from "@vue-flow/core"
import { computed } from "vue"

export interface ServiceNodeData {
  name: string
  kind?: string // service | database | infra
  stack?: string
  /** Fade the node back (search miss / not part of the focused node's graph). */
  dimmed?: boolean
}

const props = defineProps<{ data: ServiceNodeData; selected?: boolean }>()

const kindVar: Record<string, string> = {
  service: "var(--color-brand)",
  database: "var(--color-accent)",
  infra: "var(--color-muted-strong)",
}
const accent = computed(() => kindVar[props.data.kind ?? "service"] ?? "var(--color-brand)")
const kindIcon: Record<string, string> = {
  service: "◇",
  database: "⛁",
  infra: "⬡",
}
const icon = computed(() => kindIcon[props.data.kind ?? "service"] ?? "◇")
</script>

<template>
  <div
    class="flex w-[132px] items-center gap-1.5 rounded-control border bg-surface-soft px-2 py-1.5 transition-[border-color,opacity]"
    :class="[
      selected ? 'border-[var(--accent)]' : 'border-line',
      data.dimmed ? 'opacity-30' : 'opacity-100',
    ]"
    :style="{ '--accent': accent }"
  >
    <Handle
      type="target"
      :position="Position.Left"
      class="!size-1.5 !border !border-[var(--accent)] !bg-surface"
    />
    <Handle
      type="source"
      :position="Position.Right"
      class="!size-1.5 !border !border-[var(--accent)] !bg-surface"
    />
    <span class="text-[11px] text-[var(--accent)]">{{ icon }}</span>
    <span class="flex-1 truncate text-[11px] font-medium text-ink">{{ data.name }}</span>
  </div>
</template>
