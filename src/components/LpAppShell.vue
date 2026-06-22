<script setup lang="ts">
/*
 * Full application shell: a fixed-height (h-dvh) flex frame holding the side
 * navigation rail, a top header bar, and a single scrollable main region.
 *
 * It owns the things every product's cabinet/console layout was re-implementing
 * by hand — and getting subtly wrong:
 *  - the rail is full viewport height and never scrolls with the page (only
 *    `main` scrolls, via LpScrollArea), so the sidebar footer stays pinned;
 *  - a responsive burger that drives LpSidebar's mobile drawer;
 *  - a default `isActive` (path prefix-match) and a default page title derived
 *    from the nav items, so the header title and the active pill never drift.
 *
 * Everything product-specific goes through slots: #logo (brand in the rail
 * header), #sidebar-actions / #sidebar-footer (pass-through to LpSidebar),
 * #header-actions (right side of the top bar — bell, search, theme switch),
 * #header-title (override the computed title), and the default slot (page body).
 * Overlays that aren't part of the frame (command palette, toaster) live in the
 * host next to <LpAppShell>.
 */
import { computed, ref, watch } from "vue"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpSidebar from "./LpSidebar.vue"
import type { SidebarItem, SidebarSection } from "./sidebar"

export type { SidebarItem, SidebarSection } from "./sidebar"

const props = withDefaults(
  defineProps<{
    /** Flat items, or sections for grouped nav. Forwarded to LpSidebar. */
    items?: SidebarItem[]
    sections?: SidebarSection[]
    /** Active item id (v-model) when not using a custom `isActive`. */
    modelValue?: string
    /**
     * The current route path. Enables the built-in prefix-match active test and
     * the derived page title without the host wiring its own `isActive`. Pass
     * `route.path`. Ignored when a custom `isActive` is provided.
     */
    path?: string
    /**
     * Custom active test (router-driven nav). Overrides `path`/`modelValue`.
     */
    isActive?: (item: SidebarItem) => boolean
    /** Override the header title. Falls back to the active item's label. */
    title?: string
    /** Mobile drawer open state (v-model:open). */
    open?: boolean
    /** Tailwind breakpoint below which the rail becomes a drawer. */
    mobileBreakpoint?: "sm" | "md" | "lg" | "xl"
    /** Show the brand/header divider in the rail. */
    divider?: boolean
    /** Max content width inside main (Tailwind class), or null to fill. */
    contentClass?: string
    /**
     * Full-bleed main: render the page slot directly into main with NO
     * scroll-area wrapper and NO padding, so the page owns the whole region
     * (for a canvas / map / graph that fills the viewport and pans internally).
     */
    fullBleed?: boolean
    /** Loading skeleton for the nav. */
    loading?: boolean
  }>(),
  {
    mobileBreakpoint: "lg",
    divider: true,
    contentClass: "mx-auto w-full max-w-6xl",
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", id: string): void
  (e: "update:open", value: boolean): void
  (e: "select", item: SidebarItem): void
}>()

// Normalise items/sections to a flat list for the title computation.
const flatItems = computed<SidebarItem[]>(() =>
  props.sections ? props.sections.flatMap((s) => s.items) : (props.items ?? []),
)

// Default active test: exact match for "/", prefix match (on a segment
// boundary) otherwise — so "/billing" doesn't light up on "/billing-x".
function defaultActive(item: SidebarItem): boolean {
  if (props.path == null) return item.id === props.modelValue
  if (item.id === "/") return props.path === "/"
  return props.path === item.id || props.path.startsWith(`${item.id}/`)
}
const activeTest = computed(() => props.isActive ?? defaultActive)

// Header title: explicit prop wins; else the longest-matching active item's
// label (longest so nested routes resolve to their own entry, not a parent).
const pageTitle = computed(() => {
  if (props.title != null) return props.title
  const test = activeTest.value
  const match = [...flatItems.value]
    .sort((a, b) => b.id.length - a.id.length)
    .find((item) => test(item))
  return match?.label ?? ""
})

// Mobile drawer: also close it on every path change, so href/select navigation
// from a nav item dismisses it.
const drawerOpen = computed({
  get: () => props.open ?? false,
  set: (v) => emit("update:open", v),
})
watch(
  () => props.path,
  () => {
    if (drawerOpen.value) emit("update:open", false)
  },
)

function onSelect(item: SidebarItem) {
  emit("select", item)
}
function onModel(id: string) {
  emit("update:modelValue", id)
}

const burgerHidden: Record<NonNullable<typeof props.mobileBreakpoint>, string> = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
  xl: "xl:hidden",
}
const burgerClass = computed(() => burgerHidden[props.mobileBreakpoint])

// Expose the burger trigger so a host can omit its own header entirely.
const _openDrawer = () => emit("update:open", true)
defineExpose({ openDrawer: _openDrawer })
</script>

<template>
  <div class="flex h-dvh overflow-hidden bg-surface text-ink">
    <LpSidebar
      :model-value="modelValue"
      :items="items"
      :sections="sections"
      :is-active="activeTest"
      :open="drawerOpen"
      responsive
      edge-open
      :mobile-breakpoint="mobileBreakpoint"
      :divider="divider"
      :loading="loading"
      class="shrink-0"
      @update:model-value="onModel"
      @update:open="(v) => emit('update:open', v)"
      @select="onSelect"
    >
      <template v-if="$slots.logo" #header>
        <slot name="logo" />
      </template>
      <template v-if="$slots['sidebar-actions']" #actions>
        <slot name="sidebar-actions" />
      </template>
      <template v-if="$slots['sidebar-footer']" #footer>
        <slot name="sidebar-footer" />
      </template>
      <template v-if="$slots['sidebar-item']" #item="slotProps">
        <slot name="sidebar-item" v-bind="slotProps" />
      </template>
    </LpSidebar>

    <!-- Main column: header + the single scroll region. -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6"
      >
        <LpButton
          :class="burgerClass"
          variant="ghost"
          size="sm"
          square
          aria-label="Open menu"
          @click="emit('update:open', true)"
        >
          <LpIcon name="lucide:menu" :size="18" />
        </LpButton>

        <slot name="header-title">
          <h1 class="truncate text-lg font-semibold">{{ pageTitle }}</h1>
        </slot>

        <div v-if="$slots['header-actions']" class="ml-auto flex items-center gap-2">
          <slot name="header-actions" />
        </div>
      </header>

      <!-- full-bleed: page owns the whole region (canvas/map); otherwise the
           single scroll region with padding. -->
      <div v-if="fullBleed" class="min-h-0 flex-1 overflow-hidden">
        <slot />
      </div>
      <LpScrollArea
        v-else
        class="min-h-0 flex-1"
        :content-class="`px-4 py-6 md:px-6 ${contentClass}`"
      >
        <slot />
      </LpScrollArea>
    </div>

    <slot name="overlays" />
  </div>
</template>
