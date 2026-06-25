<script setup lang="ts">
/**
 * Custom Vue Flow node for LpTopologyCanvas: an infra host/service card on kit
 * tokens. Not used directly by consumers — LpTopologyCanvas registers it as the
 * `infra` node type. Exported so apps can override the renderer if needed.
 *
 * Styled with Tailwind utilities (no scoped <style>) so the consumer's
 * `@source` over the kit emits these classes — scoped CSS in a published
 * component doesn't reach apps that only import the kit's token css.
 */
import { Handle, Position } from "@vue-flow/core"
import { computed } from "vue"

export interface InfraNodeData {
  name: string
  role: string
  overlay?: string
  online?: boolean
  kind?: string
  project?: string
  /** Control-plane firewall rule count on this host (badge when > 0). */
  firewallCount?: number
  /** Service count on this host (badge when defined — services toggle on). */
  serviceCount?: number
  /** Fade the node back (search miss / not part of the focused node's graph). */
  dimmed?: boolean
}

const props = defineProps<{ data: InfraNodeData; selected?: boolean }>()

const roleVar: Record<string, string> = {
  hypervisor: "var(--color-accent)",
  game: "var(--color-action)",
  router: "var(--color-muted-strong)",
  edge: "var(--color-brand)",
}
const accent = computed(() => roleVar[props.data.role] ?? "var(--color-line-strong)")
const roleIcon: Record<string, string> = {
  hypervisor: "▣",
  game: "◈",
  router: "⇄",
  edge: "☁",
}
const icon = computed(() => roleIcon[props.data.role] ?? "●")
</script>

<template>
  <div
    class="w-[168px] overflow-hidden rounded-card border bg-surface-raised shadow-panel transition-[border-color,box-shadow]"
    :class="selected ? 'border-[var(--accent)]' : 'border-line'"
    :style="{
      '--accent': accent,
      opacity: data.dimmed ? 0.3 : data.online === false ? 0.5 : 1,
      ...(selected
        ? { boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent), var(--shadow-panel)' }
        : {}),
    }"
  >
    <Handle
      type="target"
      :position="Position.Left"
      class="!size-2 !border-2 !border-[var(--accent)] !bg-surface"
    />
    <Handle
      type="source"
      :position="Position.Right"
      class="!size-2 !border-2 !border-[var(--accent)] !bg-surface"
    />

    <div class="h-[3px] bg-[var(--accent)]" />
    <div class="px-[11px] pb-2.5 pt-[9px]">
      <div class="flex items-center gap-[7px]">
        <span class="text-[13px] text-[var(--accent)]">{{ icon }}</span>
        <span class="flex-1 truncate text-[13px] font-semibold text-ink">{{ data.name }}</span>
        <span
          v-if="data.online !== undefined"
          class="size-[7px] rounded-full"
          :class="data.online ? 'bg-action shadow-[0_0_6px_var(--color-action)]' : 'bg-danger'"
        />
      </div>
      <div class="mt-1.5 flex items-center justify-between">
        <span class="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
          {{ data.role }}
        </span>
        <span v-if="data.overlay" class="font-mono text-[10px] text-muted">{{ data.overlay }}</span>
      </div>
      <div
        v-if="data.firewallCount || data.serviceCount !== undefined"
        class="mt-1.5 flex items-center gap-1.5"
      >
        <span
          v-if="data.firewallCount"
          class="inline-flex items-center gap-1 rounded-pill bg-danger-soft px-1.5 py-0.5 text-[9px] font-medium text-danger"
          :title="`${data.firewallCount} firewall rule(s)`"
        >
          <span>⛨</span>{{ data.firewallCount }}
        </span>
        <span
          v-if="data.serviceCount !== undefined"
          class="inline-flex items-center gap-1 rounded-pill bg-surface-soft px-1.5 py-0.5 text-[9px] font-medium text-muted"
          :title="`${data.serviceCount} service(s)`"
        >
          <span>◇</span>{{ data.serviceCount }}
        </span>
      </div>
    </div>
  </div>
</template>
