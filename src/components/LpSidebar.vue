<script setup lang="ts">
/*
 * App-shell side navigation. A vertical rail of icon + label items, optionally
 * split into labelled sections, with the active item marked by a sliding brand
 * pill (motion-v shared layoutId — same feel as Tabs/Segmented/Pagination).
 * Items carry an optional badge count. Header/footer slots hold a logo, a
 * collapse control, a user chip, etc. Data-driven: bind the active id with
 * v-model. Each item can route via href (rendered as <a>) or just emit select.
 *
 * Phones: set `responsive` and the rail hides below the `mobileBreakpoint` and
 * is replaced by a swipeable LpDrawer (vaul-vue gives drag-to-close for free).
 * The host owns the burger button and binds v-model:open; selecting an item
 * auto-closes the drawer. With `responsive` off the component renders exactly
 * the static <nav> it always has — existing call sites are unaffected.
 */
import { computed, useId } from "vue"
import LpDrawer from "./LpDrawer.vue"
import LpSidebarNav from "./LpSidebarNav.vue"
import type { SidebarItem, SidebarSection } from "./sidebar"

export type { SidebarItem, SidebarSection } from "./sidebar"

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
    /**
     * Collapse to a swipeable drawer on phones. Off by default so existing
     * static-rail usage is unchanged.
     */
    responsive?: boolean
    /** Drawer open state on mobile (v-model:open). Only used when `responsive`. */
    open?: boolean
    /** Tailwind breakpoint below which the drawer takes over. */
    mobileBreakpoint?: "sm" | "md" | "lg" | "xl"
    /** Let a pull from the left screen edge drag the mobile drawer open. */
    edgeOpen?: boolean
  }>(),
  {
    skeletonRows: 6,
    skeletonHeader: true,
    responsive: false,
    mobileBreakpoint: "md",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", id: string): void
  (e: "update:open", value: boolean): void
  (e: "select", item: SidebarItem): void
}>()

// Normalise both inputs to a single section list.
const groups = computed<SidebarSection[]>(() =>
  props.sections ?? (props.items ? [{ items: props.items }] : []),
)

function itemActive(item: SidebarItem): boolean {
  return props.isActive ? props.isActive(item) : item.id === props.modelValue
}

function activate(item: SidebarItem) {
  if (item.disabled) return
  emit("update:modelValue", item.id)
  emit("select", item)
  // Selecting an item dismisses the mobile drawer; harmless on desktop.
  if (props.responsive && props.open) emit("update:open", false)
}

// Each shell (rail vs drawer) gets its own pill layoutId: when responsive they
// can be mounted at once, and a shared layoutId would make motion-v tug one pill
// between two live elements.
const baseId = `lp-sidebar-${useId()}`
const railPillId = `${baseId}-rail`
const drawerPillId = `${baseId}-drawer`

// Hide the static rail at/under the breakpoint when responsive; otherwise the
// rail is always shown and the drawer is never rendered.
const RAIL_VISIBILITY: Record<NonNullable<typeof props.mobileBreakpoint>, string> = {
  sm: "hidden sm:flex",
  md: "hidden md:flex",
  lg: "hidden lg:flex",
  xl: "hidden xl:flex",
}
const railClass = computed(() =>
  props.responsive ? RAIL_VISIBILITY[props.mobileBreakpoint] : "flex",
)
</script>

<template>
  <!-- Desktop / always-on rail -->
  <nav
    class="h-full w-60 flex-col gap-1 border-r border-line bg-surface-raised p-3"
    :class="railClass"
    aria-label="Sidebar"
  >
    <div v-if="$slots.header" class="mb-2 shrink-0">
      <slot name="header" />
    </div>

    <LpSidebarNav
      :groups="groups"
      :pill-id="railPillId"
      :item-active="itemActive"
      :loading="loading"
      :skeleton-rows="skeletonRows"
      :skeleton-header="skeletonHeader"
      @activate="activate"
    >
      <template v-if="$slots.item" #item="slotProps">
        <slot name="item" v-bind="slotProps" />
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </LpSidebarNav>

    <div v-if="$slots.footer" class="mt-2 shrink-0 border-t border-line pt-3">
      <slot name="footer" />
    </div>
  </nav>

  <!-- Mobile: same nav inside a swipeable drawer (drag-to-close via vaul). -->
  <LpDrawer
    v-if="responsive"
    :open="open"
    direction="left"
    size="sm"
    :edge-open="edgeOpen"
    @update:open="(v) => emit('update:open', v)"
  >
    <div class="flex h-full flex-col gap-1">
      <div v-if="$slots.header" class="mb-2 shrink-0">
        <slot name="header" />
      </div>

      <LpSidebarNav
        :groups="groups"
        :pill-id="drawerPillId"
        :item-active="itemActive"
        :loading="loading"
        :skeleton-rows="skeletonRows"
        :skeleton-header="skeletonHeader"
        @activate="activate"
      >
        <template v-if="$slots.item" #item="slotProps">
          <slot name="item" v-bind="slotProps" />
        </template>
        <template v-if="$slots.actions" #actions>
          <slot name="actions" />
        </template>
      </LpSidebarNav>

      <div v-if="$slots.footer" class="mt-2 shrink-0 border-t border-line pt-3">
        <slot name="footer" />
      </div>
    </div>
  </LpDrawer>
</template>
