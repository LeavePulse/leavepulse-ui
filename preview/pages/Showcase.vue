<script setup lang="ts">
/*
 * Rebuilds a slice of the LeavePulse landing using only kit components +
 * tokens. Switch the theme to "lime" (top-right) to see the whole thing
 * re-skin to the screenshot look from one token object.
 */
import { LpBadge, LpCard, LpIcon, LpStat } from "../../src"

const features = [
  { icon: "lucide:globe", title: "A profile that grows with you", body: "A complete timeline of your journey across servers." },
  { icon: "lucide:link", title: "One profile across all servers", body: "Build a consistent gameplay footprint." },
  { icon: "lucide:chart-no-axes-column", title: "A true picture of your gameplay", body: "Time distribution, activity changes, patterns." },
  { icon: "lucide:map", title: "Gameplay progress in one place", body: "Sessions, milestones, rankings and more." },
]
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-12 p-8">
    <!-- Stat grid 3×2 -->
    <LpCard variant="flat" class="grid grid-cols-3 gap-x-10 gap-y-8 p-8">
      <LpStat online label="Servers online right now" value="43" hint="Active servers responding in monitoring." />
      <LpStat online label="Players online right now" value="127" hint="Players on monitored servers." />
      <LpStat label="Servers with LeavePulse agent" value="10" hint="Extended metrics available." icon="lucide:cpu" />
      <LpStat label="Players with a LeavePulse profile" value="1" hint="Linked profiles currently in-game." />
      <LpStat label="Total accumulated playtime" value="19,802 h" hint="Aggregate playtime across integrations." />
      <LpStat label="Registered profiles" value="2,136" hint="Profiles whose history and milestones are stored." />
    </LpCard>

    <!-- Section heading -->
    <div class="flex flex-col items-center gap-2 text-center">
      <h2 class="text-2xl font-semibold text-ink">LeavePulse profile</h2>
      <p class="max-w-xl text-sm text-muted">
        One place to see your playtime, sessions and milestones across every
        server that runs LeavePulse.
      </p>
    </div>

    <!-- Profile cards -->
    <div class="grid grid-cols-2 gap-4">
      <LpCard interactive class="flex flex-col gap-4">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="relative size-11 rounded-xl bg-surface-soft">
              <span class="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-action ring-2 ring-surface-raised" />
            </div>
            <div class="flex flex-col">
              <span class="font-semibold text-ink">System_Admin_8</span>
              <span class="font-mono text-xs text-muted">ID: 148208649934737408</span>
            </div>
          </div>
          <LpBadge tone="action">VERIFIED</LpBadge>
        </div>
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between text-xs">
            <span class="text-muted">Profile Completion</span>
            <span class="font-mono text-brand">87%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-pill bg-surface-soft">
            <div class="h-full rounded-pill bg-brand" style="width: 87%" />
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <LpBadge tone="neutral"><LpIcon name="lucide:activity" :size="12" /> 2,847h</LpBadge>
          <LpBadge tone="neutral"><LpIcon name="lucide:server" :size="12" /> 12 servers</LpBadge>
          <LpBadge tone="neutral"><LpIcon name="lucide:users" :size="12" /> 3.2K friends</LpBadge>
        </div>
      </LpCard>

      <LpCard interactive class="flex flex-col gap-2">
        <LpIcon name="lucide:lock" :size="22" class="text-brand" />
        <span class="font-semibold text-ink">Public or private — you choose</span>
        <span class="text-sm text-muted">
          Nickname + avatar only, or full stats and achievements.
        </span>
      </LpCard>

      <LpCard
        v-for="f in features"
        :key="f.title"
        interactive
        class="flex flex-col gap-2"
      >
        <LpIcon :name="f.icon" :size="22" class="text-brand" />
        <span class="font-semibold text-ink">{{ f.title }}</span>
        <span class="text-sm text-muted">{{ f.body }}</span>
      </LpCard>
    </div>
  </div>
</template>
