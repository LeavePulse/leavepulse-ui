<script setup lang="ts">
/**
 * LeaveInfra topology canvas — preview/demo.
 *
 * A native-SVG mock of the declarative topology graph the operator panel will
 * show: project swimlanes, nodes carrying a role, edges typed by transport
 * (wireguard / cloudflared), and desired-vs-observed rendering (solid = applied,
 * dashed = pending, red = drift). Built on kit tokens (text-ink / bg-surface-*
 * / border-line utilities) so it follows the active preview theme. No Vue Flow
 * dependency — this is the visual spec the real control-panel canvas mirrors.
 */
import { computed, ref } from "vue"
import { LpBadge, LpButton, LpCard, LpSwitch } from "../../src"

type Role = "hypervisor" | "game" | "router" | "edge"
type EdgeKind = "wireguard" | "cloudflared"
type Obs = "applied" | "pending" | "drift"

interface Node {
  id: string
  name: string
  role: Role
  project: string
  online: boolean
  overlay: string
  x: number
  y: number
}

interface Edge {
  id: string
  from: string
  to: string
  kind: EdgeKind
  observed: Obs
}

// Two projects, isolated overlays. The edges fan out from a public hub.
const nodes = ref<Node[]>([
  { id: "api", name: "platform-api", role: "edge", project: "infra", online: true, overlay: "10.0.0.2", x: 120, y: 90 },
  { id: "lobby", name: "lobby", role: "game", project: "42", online: true, overlay: "10.42.0.2", x: 360, y: 70 },
  { id: "survival", name: "survival", role: "game", project: "42", online: true, overlay: "10.42.0.3", x: 600, y: 70 },
  { id: "db42", name: "postgres", role: "hypervisor", project: "42", online: false, overlay: "10.42.0.4", x: 480, y: 200 },
  { id: "hub43", name: "router", role: "router", project: "43", online: true, overlay: "10.43.0.2", x: 360, y: 330 },
  { id: "mc43", name: "smp", role: "game", project: "43", online: true, overlay: "10.43.0.3", x: 600, y: 330 },
])

const edges = ref<Edge[]>([
  { id: "e1", from: "api", to: "lobby", kind: "cloudflared", observed: "applied" },
  { id: "e2", from: "lobby", to: "survival", kind: "wireguard", observed: "applied" },
  { id: "e3", from: "lobby", to: "db42", kind: "wireguard", observed: "pending" },
  { id: "e4", from: "survival", to: "db42", kind: "wireguard", observed: "pending" },
  { id: "e5", from: "hub43", to: "mc43", kind: "wireguard", observed: "drift" },
])

const roleColor: Record<Role, string> = {
  hypervisor: "var(--color-accent)",
  game: "var(--color-action)",
  router: "var(--color-muted-strong)",
  edge: "var(--color-brand)",
}

const projects = [
  { id: "infra", label: "infra · neutral", cidr: "—", x: 40, y: 40, w: 220, h: 110 },
  { id: "42", label: "project 42", cidr: "10.42.0.0/24", x: 290, y: 30, w: 430, h: 240 },
  { id: "43", label: "project 43", cidr: "10.43.0.0/24", x: 290, y: 290, w: 430, h: 110 },
]

const byId = computed(() => Object.fromEntries(nodes.value.map((n) => [n.id, n])))
const selected = ref<string | null>("lobby")
const showPending = ref(true)

const visibleEdges = computed(() =>
  edges.value.filter((e) => showPending.value || e.observed !== "pending"),
)

function edgeStroke(o: Obs): string {
  if (o === "drift") return "var(--color-danger)"
  if (o === "pending") return "var(--color-muted)"
  return "var(--color-brand)"
}
function edgeDash(o: Obs): string {
  return o === "applied" ? "0" : "6 5"
}

const sel = computed(() => (selected.value ? byId.value[selected.value] : null))
const selPeers = computed(() => {
  if (!sel.value) return []
  const id = sel.value.id
  return edges.value
    .filter((e) => e.from === id || e.to === id)
    .map((e) => {
      const other = e.from === id ? e.to : e.from
      return { node: byId.value[other], kind: e.kind, observed: e.observed }
    })
})

function obsTone(o: Obs): "success" | "outline" | "danger" {
  return o === "applied" ? "success" : o === "pending" ? "outline" : "danger"
}
</script>

<template>
  <div class="flex h-full min-h-0 w-full">
    <!-- canvas -->
    <div class="relative min-h-0 flex-1 overflow-hidden">
      <div class="absolute left-4 top-4 z-10 flex items-center gap-3">
        <span class="text-sm font-semibold text-ink">Topology</span>
        <LpBadge tone="brand">desired vs observed</LpBadge>
        <label class="flex items-center gap-2 text-xs text-muted">
          <LpSwitch v-model="showPending" />
          show pending
        </label>
      </div>

      <svg class="h-full w-full" viewBox="0 0 760 420" preserveAspectRatio="xMidYMid meet">
        <!-- project swimlanes -->
        <g v-for="p in projects" :key="p.id">
          <rect
            :x="p.x" :y="p.y" :width="p.w" :height="p.h" rx="14"
            fill="var(--color-surface-soft)"
            stroke="var(--color-line)" stroke-dasharray="2 4"
          />
          <text :x="p.x + 12" :y="p.y + 20" font-size="11" fill="var(--color-muted-strong)">
            {{ p.label }}
          </text>
          <text :x="p.x + 12" :y="p.y + 34" font-size="9" fill="var(--color-muted)">
            {{ p.cidr }}
          </text>
        </g>

        <!-- edges -->
        <g v-for="e in visibleEdges" :key="e.id">
          <line
            :x1="byId[e.from].x" :y1="byId[e.from].y"
            :x2="byId[e.to].x" :y2="byId[e.to].y"
            :stroke="edgeStroke(e.observed)"
            :stroke-dasharray="edgeDash(e.observed)"
            stroke-width="2" opacity="0.9"
          />
          <text
            :x="(byId[e.from].x + byId[e.to].x) / 2"
            :y="(byId[e.from].y + byId[e.to].y) / 2 - 4"
            font-size="8" text-anchor="middle"
            :fill="e.kind === 'cloudflared' ? 'var(--color-brand)' : 'var(--color-muted-strong)'"
          >
            {{ e.kind === "cloudflared" ? "cloudflared" : "wg" }}
          </text>
        </g>

        <!-- nodes -->
        <g
          v-for="n in nodes" :key="n.id"
          class="cursor-pointer" @click="selected = n.id"
        >
          <circle
            :cx="n.x" :cy="n.y" r="22"
            fill="var(--color-surface-raised)"
            :stroke="selected === n.id ? 'var(--color-ring)' : roleColor[n.role]"
            :stroke-width="selected === n.id ? 3 : 2"
            :opacity="n.online ? 1 : 0.4"
          />
          <circle :cx="n.x + 16" :cy="n.y - 16" r="4" :fill="n.online ? 'var(--color-action)' : 'var(--color-danger)'" />
          <text :x="n.x" :y="n.y + 4" font-size="9" text-anchor="middle" fill="var(--color-ink)" :opacity="n.online ? 1 : 0.5">
            {{ n.name }}
          </text>
          <text :x="n.x" :y="n.y + 38" font-size="8" text-anchor="middle" :fill="roleColor[n.role]">
            {{ n.role }}
          </text>
        </g>
      </svg>
    </div>

    <!-- inspector -->
    <aside class="w-72 shrink-0 border-l border-line bg-surface-raised p-4">
      <LpCard v-if="sel">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-ink">{{ sel.name }}</span>
            <LpBadge :tone="sel.online ? 'success' : 'danger'">
              {{ sel.online ? "online" : "offline" }}
            </LpBadge>
          </div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt class="text-muted">role</dt>
            <dd class="text-ink">{{ sel.role }}</dd>
            <dt class="text-muted">project</dt>
            <dd class="text-ink">{{ sel.project }}</dd>
            <dt class="text-muted">overlay</dt>
            <dd class="font-mono text-ink">{{ sel.overlay }}</dd>
          </dl>

          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
            peers ({{ selPeers.length }})
          </div>
          <div v-if="selPeers.length" class="flex flex-col gap-1.5">
            <div
              v-for="p in selPeers" :key="p.node.id"
              class="flex items-center justify-between rounded-control bg-surface-soft px-2 py-1.5"
            >
              <span class="text-xs text-ink">{{ p.node.name }}</span>
              <LpBadge :tone="obsTone(p.observed)">{{ p.observed }}</LpBadge>
            </div>
          </div>
          <p v-else class="text-xs text-muted">no project peers — isolated.</p>

          <LpButton size="sm" variant="soft" class="mt-1" @click="sel.online = !sel.online">
            simulate {{ sel.online ? "offline" : "online" }}
          </LpButton>
        </div>
      </LpCard>
      <p v-else class="text-sm text-muted">Select a node.</p>

      <div class="mt-4 flex flex-col gap-1.5 text-xs text-muted">
        <div class="flex items-center gap-2">
          <span class="inline-block h-0.5 w-6" style="background: var(--color-brand)" /> applied
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block h-0.5 w-6" style="background: var(--color-muted); border-top: 1px dashed" /> pending (reconciling)
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block h-0.5 w-6" style="background: var(--color-danger)" /> drift
        </div>
      </div>
    </aside>
  </div>
</template>
