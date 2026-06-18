<script setup lang="ts">
/*
 * App-shell side navigation. A vertical rail of icon + label items, optionally
 * split into labelled sections, with the active item marked by a sliding brand
 * pill (motion-v shared layoutId — same feel as Tabs/Segmented/Pagination).
 * Items carry an optional badge count. Header/footer slots hold a logo, a
 * collapse control, a user chip, etc. Data-driven: bind the active id with
 * v-model. Each item can route via href (rendered as <a>) or just emit select.
 */
import { Motion } from "motion-v"
import { useId } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import LpBadge from "./LpBadge.vue"
import LpIcon from "./LpIcon.vue"

export interface SidebarItem {
  id: string
  label: string
  icon?: string
  /** Render as a link instead of a button. */
  href?: string
  /** Count chip on the right (number or short string). */
  badge?: number | string
  disabled?: boolean
}

export interface SidebarSection {
  /** Optional heading above the group. */
  title?: string
  items: SidebarItem[]
}

const props = withDefaults(
  defineProps<{
    /** Active item id (v-model). Ignored when `isActive` is provided. */
    modelValue?: string
    /** Flat items, or sections for grouped nav. */
    items?: SidebarItem[]
    sections?: SidebarSection[]
    /**
     * Custom active test — for router-driven nav where "active" is a path-prefix
     * match (e.g. /billing vs /billing-details), not a simple id compare. When
     * given it overrides the modelValue check. The consumer owns the routing.
     */
    isActive?: (item: SidebarItem) => boolean
    /** Show a skeleton placeholder instead of the items. */
    loading?: boolean
    /** Skeleton row count while loading. */
    skeletonRows?: number
    /** Render the user/header skeleton row too (paired with a #header avatar). */
    skeletonHeader?: boolean
  }>(),
  { skeletonRows: 6, skeletonHeader: true },
)

const emit = defineEmits<{
  (e: "update:modelValue", id: string): void
  (e: "select", item: SidebarItem): void
}>()

// Normalise both inputs to a single section list.
const groups = (): SidebarSection[] =>
  props.sections ?? (props.items ? [{ items: props.items }] : [])

function itemActive(item: SidebarItem): boolean {
  return props.isActive ? props.isActive(item) : item.id === props.modelValue
}

function activate(item: SidebarItem) {
  if (item.disabled) return
  emit("update:modelValue", item.id)
  emit("select", item)
}

const pillId = `lp-sidebar-${useId()}`
const pillTransition = usePillTransition()
</script>

<template>
  <nav
    class="flex h-full w-60 flex-col gap-1 border-r border-line bg-surface-raised p-3"
    aria-label="Sidebar"
  >
    <div v-if="$slots.header" class="mb-2 shrink-0">
      <slot name="header" />
    </div>

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
      <div v-for="(section, si) in groups()" :key="si" class="flex flex-col gap-0.5">
        <p
          v-if="section.title"
          class="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
        >
          {{ section.title }}
        </p>

        <component
          :is="item.href && !item.disabled ? 'a' : 'button'"
          v-for="item in section.items"
          :key="item.id"
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
          @click="activate(item)"
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
      </div>

      <!-- Actions slot: buttons / promo card under the nav. -->
      <div v-if="$slots.actions" class="mt-auto flex flex-col gap-2 pt-2">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.footer" class="mt-2 shrink-0 border-t border-line pt-3">
      <slot name="footer" />
    </div>
  </nav>
</template>
