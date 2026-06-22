<script setup lang="ts">
/**
 * Preview/demo for the public LpTopologyCanvas kit component. The canvas itself
 * lives in src/ (LpTopologyCanvas); this page only supplies mock data + the
 * inspector/legend chrome an app would wrap around it. Drag from a handle to
 * connect within a project; cross-project connects are rejected (mirrors the
 * server-side isolation invariant).
 */
import { computed, ref } from "vue"
import {
  LpBadge,
  LpButton,
  LpTopologyCanvas,
  useToast,
  type EdgeObserved,
  type TopologyEdge,
  type TopologyNode,
} from "../../src"

const nodes = ref<TopologyNode[]>([
  { id: "api", position: { x: 40, y: 220 }, data: { name: "platform-api", role: "edge", overlay: "10.0.0.2", online: true, project: "infra" } },
  { id: "lobby", position: { x: 330, y: 120 }, data: { name: "lobby", role: "game", overlay: "10.42.0.2", online: true, project: "42" } },
  { id: "survival", position: { x: 620, y: 120 }, data: { name: "survival", role: "game", overlay: "10.42.0.3", online: true, project: "42" } },
  { id: "db42", position: { x: 475, y: 300 }, data: { name: "postgres", role: "hypervisor", overlay: "10.42.0.4", online: false, project: "42" } },
  { id: "hub43", position: { x: 330, y: 470 }, data: { name: "router", role: "router", overlay: "10.43.0.2", online: true, project: "43" } },
  { id: "mc43", position: { x: 620, y: 470 }, data: { name: "smp", role: "game", overlay: "10.43.0.3", online: true, project: "43" } },

  // Service layer demo: two host frames (group nodes) with services inside, and
  // a depends_on edge crossing the frames (auth-service -> auth-db on a
  // different host).
  { id: "host-app", type: "group", position: { x: 40, y: 640 }, width: 300, height: 150, data: { name: "app-vps-1", role: "" }, label: "app-vps-1" },
  { id: "auth-service", type: "service", parent: "host-app", position: { x: 16, y: 40 }, data: { name: "auth-service", kind: "service" } },
  { id: "billing-service", type: "service", parent: "host-app", position: { x: 16, y: 80 }, data: { name: "billing-service", kind: "service" } },
  { id: "host-data", type: "group", position: { x: 460, y: 640 }, width: 300, height: 150, data: { name: "data-vps", role: "" }, label: "data-vps" },
  { id: "auth-db", type: "service", parent: "host-data", position: { x: 16, y: 40 }, data: { name: "auth-db", kind: "database" } },
  { id: "nats", type: "service", parent: "host-data", position: { x: 16, y: 80 }, data: { name: "nats", kind: "infra" } },
])

const edges = ref<TopologyEdge[]>([
  { id: "e1", source: "api", target: "lobby", kind: "cloudflared", observed: "applied" },
  { id: "e2", source: "lobby", target: "survival", kind: "wg", observed: "applied" },
  { id: "e3", source: "lobby", target: "db42", kind: "wg", observed: "pending" },
  { id: "e4", source: "survival", target: "db42", kind: "wg", observed: "pending" },
  { id: "e5", source: "hub43", target: "mc43", kind: "wg", observed: "drift" },
  // depends_on edges crossing host frames (the cross-host service links).
  { id: "d1", source: "auth-service", target: "auth-db", kind: "depends_on", observed: "applied" },
  { id: "d2", source: "auth-service", target: "nats", kind: "depends_on", observed: "applied" },
  { id: "d3", source: "billing-service", target: "auth-db", kind: "depends_on", observed: "applied" },
])

const toast = useToast()
const selected = ref<string | null>("lobby")
let edgeSeq = 100

function onConnect(conn: { source: string | null; target: string | null }) {
  const src = nodes.value.find((n) => n.id === conn.source)
  const dst = nodes.value.find((n) => n.id === conn.target)
  if (!src || !dst) return
  if (src.data.project !== dst.data.project) {
    toast.error(`cross-project edge rejected: ${src.data.project} ✗ ${dst.data.project}`)
    return
  }
  if (
    edges.value.some(
      (e) =>
        (e.source === conn.source && e.target === conn.target) ||
        (e.source === conn.target && e.target === conn.source),
    )
  ) {
    toast.info("edge already exists")
    return
  }
  edges.value.push({ id: `e${edgeSeq++}`, source: conn.source!, target: conn.target!, kind: "wg", observed: "pending" })
  toast.success(`wg edge added — reconciling (${src.data.name} ↔ ${dst.data.name})`)
}

const sel = computed(() => nodes.value.find((n) => n.id === selected.value) ?? null)
const selPeers = computed(() => {
  if (!sel.value) return []
  const id = sel.value.id
  return edges.value
    .filter((e) => e.source === id || e.target === id)
    .map((e) => {
      const other = e.source === id ? e.target : e.source
      const node = nodes.value.find((n) => n.id === other)!
      return { name: node.data.name, observed: e.observed ?? "applied", kind: e.kind }
    })
})

function obsTone(o: EdgeObserved): "success" | "outline" | "danger" {
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
      <LpTopologyCanvas
        :nodes="nodes"
        :edges="edges"
        connectable
        @connect="onConnect"
        @node-select="(id) => (selected = id)"
      />
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
      </div>
    </aside>
  </div>
</template>
