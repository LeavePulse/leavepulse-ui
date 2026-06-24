<script setup lang="ts">
/**
 * Preview/demo for the public LpAppShell kit component — the full application
 * frame (rail + header + single scroll region). The shell is `h-dvh` by design,
 * so here it's framed inside a fixed-height rounded card (the `[&>div]:h-full`
 * override lets it fill the frame instead of the viewport) to show it in context
 * without taking over the playground chrome.
 */
import { ref } from "vue"
import {
  LpAppShell,
  LpAvatar,
  LpBadge,
  LpButton,
  LpCard,
  LpIcon,
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

        <template #header-actions>
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
