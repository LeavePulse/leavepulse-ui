<script setup lang="ts">
/**
 * Preview/demo for the public LpAppShell kit component — the full application
 * frame (rail + header + single scroll region). The shell is `h-dvh` by design,
 * so here it's framed inside a fixed-height rounded card (the `[&>div]:h-full`
 * override lets it fill the frame instead of the viewport) to show it in context
 * without taking over the playground chrome.
 */
import { computed, ref } from "vue"
import {
  LpAppShell,
  LpAvatar,
  LpBadge,
  LpButton,
  LpCard,
  LpIcon,
  LpSegmented,
  LpStat,
  type SidebarItem,
  type SidebarSection,
} from "../../src"

const sections: SidebarSection[] = [
  {
    items: [
      { id: "/", label: "Dashboard", icon: "lucide:layout-dashboard" },
      { id: "/servers", label: "Servers", icon: "lucide:server", badge: 12 },
      { id: "/billing", label: "Billing", icon: "lucide:credit-card" },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "/team", label: "Team", icon: "lucide:users", badge: 3 },
      { id: "/settings", label: "Settings", icon: "lucide:settings" },
    ],
  },
]

// Drive the active item locally (no router here) — the shell derives the header
// title from it.
const active = ref("/servers")

const stats = [
  { label: "Servers", value: "12", delta: 2 },
  { label: "Uptime", value: "99.98%", delta: 0.4 },
  { label: "Spend", value: "$248", delta: -12, invert: true },
]

/*
 * The header's moving parts, exercised deliberately.
 *
 * Each section carries a different primary action — one carries none — and the
 * labels differ in length, which is exactly what a translated UI does to a
 * toolbar. Switching sections therefore changes the width of the actions
 * cluster and the height of the title block. The shell eases both instead of
 * re-laying the bar in one frame; flip between sections to watch it.
 */
const section = ref("racks")
const sectionOptions = [
  { value: "racks", label: "Racks" },
  { value: "stock", label: "Stock" },
  { value: "devices", label: "Devices" },
]
const sectionAction = computed(
  () =>
    ({
      racks: "New rack",
      stock: "",
      devices: "Register a new device",
    })[section.value],
)
const sectionSubtitle = computed(
  () =>
    ({
      racks: "LH-NV-DC1 · Novovolynsk",
      stock: "",
      devices: "LH-NV-DC1 · Novovolynsk · 48 units",
    })[section.value],
)
</script>

<template>
  <div class="p-6">
    <div class="h-[640px] overflow-hidden rounded-card border border-line [&>div]:h-full">
      <LpAppShell v-model="active" :sections="sections">
        <template #logo>
          <div class="flex items-center gap-2 font-semibold text-ink">
            <LpIcon name="lucide:activity" :size="20" class="text-brand" />
            <span>LeavePulse</span>
          </div>
        </template>

        <!-- A title that gains and loses a subtitle: the block changes height,
             and the shell eases it rather than jolting the bar. -->
        <template #header-title>
          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold leading-tight">Datacentre DC1</h1>
            <p v-if="sectionSubtitle" class="truncate text-xs text-muted">
              {{ sectionSubtitle }}
            </p>
          </div>
        </template>

        <template #header-actions>
          <!-- The primary action changes with the section — present or absent,
               short label or long. That is what moves everything to its left. -->
          <LpButton v-if="sectionAction" size="sm">
            <LpIcon name="lucide:plus" :size="16" />
            {{ sectionAction }}
          </LpButton>
          <LpButton variant="ghost" size="sm" square aria-label="Search">
            <LpIcon name="lucide:search" :size="18" />
          </LpButton>
          <LpButton variant="ghost" size="sm" square aria-label="Notifications">
            <LpIcon name="lucide:bell" :size="18" />
          </LpButton>
          <LpAvatar alt="Ada Lovelace" size="sm" />
        </template>

        <template #sidebar-footer>
          <div class="flex items-center gap-2 px-1">
            <LpAvatar alt="Ada Lovelace" size="sm" />
            <div class="min-w-0">
              <p class="truncate text-sm text-ink">Ada Lovelace</p>
              <p class="truncate text-xs text-muted">admin@leavepulse.io</p>
            </div>
          </div>
        </template>

        <!-- Page body -->
        <div class="flex flex-col gap-6">
          <LpCard>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold text-ink">Header motion</h2>
                <p class="mt-1 text-sm text-muted">
                  Switch sections: the primary action appears, disappears and
                  changes length, and the subtitle comes and goes. The header
                  eases between those sizes instead of snapping.
                </p>
              </div>
              <LpSegmented v-model="section" :options="sectionOptions" size="sm" />
            </div>
          </LpCard>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LpStat
              v-for="s in stats"
              :key="s.label"
              :label="s.label"
              :value="s.value"
              :delta="s.delta"
              :invert-trend="s.invert"
            />
          </div>

          <LpCard>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold text-ink">Recent activity</h2>
              <LpBadge tone="brand">Live</LpBadge>
            </div>
            <p class="mt-2 text-sm text-muted">
              The shell owns the rail, header and the single scroll region — only
              this body scrolls, the rail footer stays pinned. Resize the window
              below the <code>lg</code> breakpoint to see the rail collapse into a
              burger-driven drawer.
            </p>
          </LpCard>
        </div>
      </LpAppShell>
    </div>
  </div>
</template>
