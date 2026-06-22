<script setup lang="ts">
/**
 * LeaveInfra topology canvas — preview/demo on Vue Flow (the engine n8n &
 * NetBird use). Real pan/zoom, draggable nodes, bezier edges, dot-grid
 * background, minimap, controls. Custom node = an Lp-token card. Edges are
 * styled by observed state (solid = applied, dashed brand = pending,
 * dashed red = drift). This is the visual spec the real control-panel canvas
 * will mirror — same library, same look.
 */
import { Background } from "@vue-flow/background"
import { Controls } from "@vue-flow/controls"
import { MarkerType, VueFlow, useVueFlow, type NodeTypesObject } from "@vue-flow/core"
import { MiniMap } from "@vue-flow/minimap"
import { computed, markRaw, ref } from "vue"
import { LpBadge, LpButton, useToast } from "../../src"
import InfraNode from "./infra/InfraNode.vue"

import "@vue-flow/core/dist/style.css"
import "@vue-flow/core/dist/theme-default.css"
import "@vue-flow/controls/dist/style.css"
import "@vue-flow/minimap/dist/style.css"

type Obs = "applied" | "pending" | "drift"
const nodeTypes = { infra: markRaw(InfraNode) } as unknown as NodeTypesObject

const nodes = ref([
  { id: "api", type: "infra", position: { x: 40, y: 220 }, data: { name: "platform-api", role: "edge", overlay: "10.0.0.2", online: true, kind: "service", project: "infra" } },
  { id: "lobby", type: "infra", position: { x: 330, y: 120 }, data: { name: "lobby", role: "game", overlay: "10.42.0.2", online: true, kind: "mc", project: "42" } },
  { id: "survival", type: "infra", position: { x: 620, y: 120 }, data: { name: "survival", role: "game", overlay: "10.42.0.3", online: true, kind: "mc", project: "42" } },
  { id: "db42", type: "infra", position: { x: 475, y: 300 }, data: { name: "postgres", role: "hypervisor", overlay: "10.42.0.4", online: false, kind: "db", project: "42" } },
  { id: "hub43", type: "infra", position: { x: 330, y: 470 }, data: { name: "router", role: "router", overlay: "10.43.0.2", online: true, kind: "router", project: "43" } },
  { id: "mc43", type: "infra", position: { x: 620, y: 470 }, data: { name: "smp", role: "game", overlay: "10.43.0.3", online: true, kind: "mc", project: "43" } },
])

const rawEdges = ref([
  { id: "e1", source: "api", target: "lobby", kind: "cloudflared", observed: "applied" as Obs },
  { id: "e2", source: "lobby", target: "survival", kind: "wg", observed: "applied" as Obs },
  { id: "e3", source: "lobby", target: "db42", kind: "wg", observed: "pending" as Obs },
  { id: "e4", source: "survival", target: "db42", kind: "wg", observed: "pending" as Obs },
  { id: "e5", source: "hub43", target: "mc43", kind: "wg", observed: "drift" as Obs },
])

function edgeColor(o: Obs): string {
  return o === "drift"
    ? "var(--color-danger)"
    : o === "pending"
      ? "var(--color-muted-strong)"
      : "var(--color-brand)"
}

const edges = computed(() =>
  rawEdges.value.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "default",
    animated: e.observed !== "applied",
    label: e.kind,
    labelBgStyle: { fill: "var(--color-surface)" },
    labelStyle: { fill: "var(--color-muted-strong)", fontSize: "10px" },
    style: {
      stroke: edgeColor(e.observed),
      strokeWidth: 2,
      strokeDasharray: e.observed === "applied" ? "0" : "6 5",
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(e.observed) },
    data: { observed: e.observed, kind: e.kind },
  })),
)

const { onNodeClick, onConnect, fitView } = useVueFlow()
const toast = useToast()
const selected = ref<string | null>("lobby")
onNodeClick(({ node }) => (selected.value = node.id))

let edgeSeq = 100
// Drag from a node handle to another -> create a wireguard edge, but ONLY
// within the same project: a cross-project edge is rejected, mirroring the
// server-side isolation invariant (control-service GraphController).
onConnect((conn) => {
  const src = nodes.value.find((n) => n.id === conn.source)
  const dst = nodes.value.find((n) => n.id === conn.target)
  if (!src || !dst) return
  if (src.data.project !== dst.data.project) {
    toast.error(
      `cross-project edge rejected: ${src.data.project} ✗ ${dst.data.project}`,
    )
    return
  }
  if (
    rawEdges.value.some(
      (e) =>
        (e.source === conn.source && e.target === conn.target) ||
        (e.source === conn.target && e.target === conn.source),
    )
  ) {
    toast.info("edge already exists")
    return
  }
  rawEdges.value.push({
    id: `e${edgeSeq++}`,
    source: conn.source!,
    target: conn.target!,
    kind: "wg",
    observed: "pending",
  })
  toast.success(`wg edge added — reconciling (${src.data.name} ↔ ${dst.data.name})`)
})

const sel = computed(() => nodes.value.find((n) => n.id === selected.value) ?? null)
const selPeers = computed(() => {
  if (!sel.value) return []
  const id = sel.value.id
  return rawEdges.value
    .filter((e) => e.source === id || e.target === id)
    .map((e) => {
      const other = e.source === id ? e.target : e.source
      const node = nodes.value.find((n) => n.id === other)!
      return { name: node.data.name, observed: e.observed, kind: e.kind }
    })
})

function obsTone(o: Obs): "success" | "outline" | "danger" {
  return o === "applied" ? "success" : o === "pending" ? "outline" : "danger"
}
function toggleOnline() {
  if (sel.value) sel.value.data.online = !sel.value.data.online
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full">
    <div class="relative min-h-0 flex-1">
      <div class="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-3">
        <span class="text-sm font-semibold text-ink">Topology</span>
        <LpBadge tone="brand">desired vs observed</LpBadge>
      </div>

      <VueFlow
        v-model:nodes="nodes"
        :edges="edges"
        :node-types="nodeTypes"
        :default-viewport="{ zoom: 0.9 }"
        :min-zoom="0.3"
        :max-zoom="2"
        fit-view-on-init
        class="lp-infra-flow"
      >
        <Background :gap="22" :size="1.4" pattern-color="var(--color-line-strong)" />
        <MiniMap pannable zoomable node-color="var(--color-surface-soft)" mask-color="rgba(0,0,0,0.55)" />
        <Controls />
      </VueFlow>
    </div>

    <aside class="w-72 shrink-0 border-l border-line bg-surface-raised p-4">
      <template v-if="sel">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-ink">{{ sel.data.name }}</span>
          <LpBadge :tone="sel.data.online ? 'success' : 'danger'">
            {{ sel.data.online ? "online" : "offline" }}
          </LpBadge>
        </div>
        <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt class="text-muted">role</dt>
          <dd class="text-ink">{{ sel.data.role }}</dd>
          <dt class="text-muted">overlay</dt>
          <dd class="font-mono text-ink">{{ sel.data.overlay }}</dd>
        </dl>

        <div class="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
          peers ({{ selPeers.length }})
        </div>
        <div v-if="selPeers.length" class="mt-2 flex flex-col gap-1.5">
          <div
            v-for="(p, i) in selPeers" :key="i"
            class="flex items-center justify-between rounded-control bg-surface-soft px-2 py-1.5"
          >
            <span class="text-xs text-ink">{{ p.name }} <span class="text-muted">· {{ p.kind }}</span></span>
            <LpBadge :tone="obsTone(p.observed)">{{ p.observed }}</LpBadge>
          </div>
        </div>
        <p v-else class="mt-2 text-xs text-muted">no project peers — isolated.</p>

        <LpButton size="sm" variant="soft" class="mt-4 w-full" @click="toggleOnline">
          simulate {{ sel.data.online ? "offline" : "online" }}
        </LpButton>
      </template>
      <p v-else class="text-sm text-muted">Select a node.</p>

      <div class="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-xs text-muted">
        <div class="flex items-center gap-2">
          <span class="h-0.5 w-7 rounded" style="background: var(--color-brand)" /> applied
        </div>
        <div class="flex items-center gap-2">
          <span class="h-0.5 w-7 rounded border-t border-dashed" style="border-color: var(--color-muted-strong)" /> pending
        </div>
        <div class="flex items-center gap-2">
          <span class="h-0.5 w-7 rounded border-t border-dashed" style="border-color: var(--color-danger)" /> drift
        </div>
        <LpButton size="sm" variant="ghost" class="mt-2 self-start" @click="fitView()">fit view</LpButton>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.lp-infra-flow {
  background: var(--color-surface);
}
/* Tone Vue Flow's default chrome to kit tokens. */
.lp-infra-flow :deep(.vue-flow__controls) {
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-control);
  overflow: hidden;
}
.lp-infra-flow :deep(.vue-flow__controls-button) {
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-line);
  fill: var(--color-muted-strong);
}
.lp-infra-flow :deep(.vue-flow__controls-button:hover) {
  background: var(--color-surface-soft);
}
.lp-infra-flow :deep(.vue-flow__minimap) {
  border-radius: var(--radius-card);
  border: 1px solid var(--color-line);
  overflow: hidden;
}
.lp-infra-flow :deep(.vue-flow__edge-text) { fill: var(--color-muted-strong); }
.lp-infra-flow :deep(.vue-flow__edge-textbg) { fill: var(--color-surface); }
</style>
