<script setup lang="ts">
/** Custom Vue Flow node: an infra host/service card on kit tokens. */
import { Handle, Position } from "@vue-flow/core"
import { computed } from "vue"

type Role = "hypervisor" | "game" | "router" | "edge"

const props = defineProps<{
  data: {
    name: string
    role: Role
    overlay: string
    online: boolean
    kind: string
  }
  selected?: boolean
}>()

const roleVar: Record<Role, string> = {
  hypervisor: "var(--color-accent)",
  game: "var(--color-action)",
  router: "var(--color-muted-strong)",
  edge: "var(--color-brand)",
}
const accent = computed(() => roleVar[props.data.role])
const roleIcon: Record<Role, string> = {
  hypervisor: "▣",
  game: "◈",
  router: "⇄",
  edge: "☁",
}
</script>

<template>
  <div
    class="lp-infra-node"
    :class="{ 'lp-infra-node--sel': selected, 'lp-infra-node--off': !data.online }"
    :style="{ '--accent': accent }"
  >
    <Handle type="target" :position="Position.Left" class="lp-infra-handle" />
    <Handle type="source" :position="Position.Right" class="lp-infra-handle" />

    <div class="lp-infra-node__bar" />
    <div class="lp-infra-node__body">
      <div class="lp-infra-node__top">
        <span class="lp-infra-node__icon">{{ roleIcon[data.role] }}</span>
        <span class="lp-infra-node__name">{{ data.name }}</span>
        <span class="lp-infra-node__dot" :class="data.online ? 'is-on' : 'is-off'" />
      </div>
      <div class="lp-infra-node__meta">
        <span class="lp-infra-node__role">{{ data.role }}</span>
        <span class="lp-infra-node__ip">{{ data.overlay }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lp-infra-node {
  width: 168px;
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-line);
  box-shadow: var(--shadow-panel);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.lp-infra-node--sel {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent), var(--shadow-panel);
}
.lp-infra-node--off { opacity: 0.5; }
.lp-infra-node__bar { height: 3px; background: var(--accent); }
.lp-infra-node__body { padding: 9px 11px 10px; }
.lp-infra-node__top { display: flex; align-items: center; gap: 7px; }
.lp-infra-node__icon { color: var(--accent); font-size: 13px; }
.lp-infra-node__name {
  flex: 1; color: var(--color-ink); font-size: 13px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lp-infra-node__dot { width: 7px; height: 7px; border-radius: 999px; }
.lp-infra-node__dot.is-on { background: var(--color-action); box-shadow: 0 0 6px var(--color-action); }
.lp-infra-node__dot.is-off { background: var(--color-danger); }
.lp-infra-node__meta {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 6px;
}
.lp-infra-node__role {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--accent); font-weight: 600;
}
.lp-infra-node__ip { font-size: 10px; font-family: ui-monospace, monospace; color: var(--color-muted); }
.lp-infra-handle {
  width: 8px; height: 8px;
  background: var(--color-surface); border: 2px solid var(--accent);
}
</style>
