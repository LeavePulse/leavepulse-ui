<script setup lang="ts">
/*
 * Inner body of LpSidebar: the section/item list plus the loading skeleton and
 * the sliding active pill. Split out so LpSidebar can render the exact same nav
 * in two shells — the static desktop rail and the swipeable mobile drawer —
 * without duplicating markup. Not exported on its own; an LpSidebar detail.
 */
import { Motion } from "motion-v"
import { usePillTransition } from "../composables/usePillTransition"
import LpBadge from "./LpBadge.vue"
import LpContextMenu from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import type { SidebarItem, SidebarSection } from "./sidebar"

const props = withDefaults(
  defineProps<{
    /** Normalised section list (LpSidebar collapses items/sections into this). */
    groups: SidebarSection[]
    /** Shared layoutId so the active pill flies between desktop/drawer renders. */
    pillId: string
    itemActive: (item: SidebarItem) => boolean
    loading?: boolean
    skeletonRows?: number
    skeletonHeader?: boolean
  }>(),
  { skeletonRows: 6, skeletonHeader: true },
)

const emit = defineEmits<{
  (e: "activate", item: SidebarItem): void
}>()

const pillTransition = usePillTransition()
</script>

<template>
  <!-- Loading skeleton: an optional identity row + a run of item rows. -->
  <div v-if="loading" class="flex min-h-0 flex-1 flex-col gap-4">
    <div v-if="skeletonHeader" class="flex items-center gap-3 px-1">
      <div class="size-10 shrink-0 animate-pulse rounded-pill bg-surface-soft" />
      <div class="flex-1 space-y-2">
        <div class="h-3.5 w-24 animate-pulse rounded bg-surface-soft" />
        <div class="h-3 w-16 animate-pulse rounded bg-surface-soft/60" />
      </div>
    </div>
    <div class="space-y-1">
      <div
        v-for="n in skeletonRows"
        :key="n"
        class="h-9 animate-pulse rounded-control bg-surface-soft"
      />
    </div>
  </div>

  <div v-else class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
    <div v-for="(section, si) in groups" :key="si" class="flex flex-col gap-0.5">
      <p
        v-if="section.title"
        class="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        {{ section.title }}
      </p>

      <!-- Optional right-click menu per item; passthrough when item.menu is
           absent or empty, so the item keeps the native context menu. -->
      <LpContextMenu
        v-for="item in section.items"
        :key="item.id"
        :items="item.menu ?? []"
      >
        <component
          :is="item.href && !item.disabled ? 'a' : 'button'"
          :href="item.href && !item.disabled ? item.href : undefined"
          :type="item.href ? undefined : 'button'"
          :disabled="item.href ? undefined : item.disabled"
          :aria-current="itemActive(item) ? 'page' : undefined"
          :aria-disabled="item.disabled || undefined"
          class="group/item relative flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring"
          :class="item.disabled
            ? 'cursor-not-allowed text-muted/50'
            : itemActive(item)
              ? 'text-ink'
              : 'text-muted hover:text-ink'"
          @click="emit('activate', item)"
        >
          <!-- Sliding active pill -->
          <Motion
            v-if="itemActive(item)"
            :layout-id="pillId"
            :transition="pillTransition"
            class="absolute inset-0 z-0 rounded-control bg-brand-soft"
          />
          <!-- #item slot for fully custom rows; falls back to icon+label+badge. -->
          <slot name="item" :item="item" :active="itemActive(item)">
            <LpIcon
              v-if="item.icon"
              :name="item.icon"
              :size="17"
              class="relative z-10 shrink-0 transition-colors"
              :class="itemActive(item) ? 'text-brand' : ''"
            />
            <span class="relative z-10 min-w-0 flex-1 truncate">{{ item.label }}</span>
            <LpBadge
              v-if="item.badge != null"
              :tone="itemActive(item) ? 'brand' : 'neutral'"
              class="relative z-10 shrink-0"
            >
              {{ item.badge }}
            </LpBadge>
          </slot>
        </component>
      </LpContextMenu>
    </div>

    <!-- Actions slot: buttons / promo card under the nav. -->
    <div v-if="$slots.actions" class="mt-auto flex flex-col gap-2 pt-2">
      <slot name="actions" />
    </div>
  </div>
</template>
