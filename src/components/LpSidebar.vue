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
import { computed, ref, useId } from "vue"
import LpDrawer from "./LpDrawer.vue"
import LpInput from "./LpInput.vue"
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
    /**
     * Put a filter field above the nav. A hundred-item sidebar is not read, it
     * is searched: past a screenful, scanning costs more than typing, and every
     * app that has one had built the same LpInput into the #header slot.
     *
     * Filtering is on `label` (and any `keywords` on the item), case- and
     * accent-insensitive. Sections whose items all fail drop out rather than
     * leaving a run of empty headings, and a collapsed section opens while a
     * query is active — a hidden match is the same as no match.
     */
    searchable?: boolean
    /** Placeholder for that field. */
    searchPlaceholder?: string
    /** The query, when the app wants to own it (v-model:search). */
    search?: string
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
    /**
     * Draw a hairline rule between the #header (logo) and the nav. On by
     * default — it visually anchors the brand above the items. Pass false for a
     * flush, header-less look.
     */
    divider?: boolean
    /**
     * Where this nav lives.
     *
     * `rail` is the app shell's edge: one hairline on the inner side, square
     * corners, the raised shell background.
     *
     * `panel` is a nav that sits inside a page next to the content it drives —
     * a settings index, a table picker. It is a card: boxed on all four sides
     * and rounded. Without it the rail's single border reads as a stray line
     * down the middle of the page, and a consumer cannot cancel it with a class
     * of their own.
     */
    variant?: "rail" | "panel"
    /**
     * Rail width. A plain `class` cannot set it — the component's own `w-60`
     * wins, and the kit does not merge conflicting Tailwind classes — so the
     * width is a prop. Any CSS length; a page-embedded nav usually wants to
     * match the column it lives in.
     */
    width?: string
    /**
     * Which collapsible groups are folded away (v-model:collapsed). Leave it
     * unbound to let the sidebar fold long navs on its own — see
     * `autoCollapseAfter`.
     */
    collapsed?: string[]
    /**
     * Fold collapsible groups automatically once the nav has more than this
     * many rows, counting headings and items alike.
     *
     * The reason is the reader, not the pixels: a short nav is taken in at a
     * glance, a long one has to be searched, and searching a list you did not
     * choose to have is the part that grates. Past the threshold the groups
     * that are not today's work fold themselves, and the one holding the
     * current page always stays open.
     *
     * 0 turns it off — the app then owns the state through `collapsed`.
     */
    autoCollapseAfter?: number
  }>(),
  {
    searchPlaceholder: "Search",
    skeletonRows: 6,
    skeletonHeader: true,
    responsive: false,
    mobileBreakpoint: "md",
    divider: true,
    variant: "rail",
    autoCollapseAfter: 14,
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", id: string): void
  (e: "update:open", value: boolean): void
  (e: "update:collapsed", keys: string[]): void
  (e: "select", item: SidebarItem): void
  (e: "update:search", value: string): void
}>()

// Normalise both inputs to a single section list.
const allGroups = computed<SidebarSection[]>(() =>
  props.sections ?? (props.items ? [{ items: props.items }] : []),
)

/*
 * The filter query. Controlled through v-model:search when the app wants it —
 * a nav whose query is part of the URL, say — and kept here otherwise, so
 * `searchable` alone is enough to get a working field.
 */
const ownSearch = ref("")
const query = computed({
  get: () => props.search ?? ownSearch.value,
  set: (v) => {
    ownSearch.value = v
    emit("update:search", v)
  },
})

/** Case- and accent-insensitive, so "reglas" finds "Reglas" and "Règles". */
function normalise(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

function matches(item: SidebarItem, needle: string): boolean {
  if (normalise(item.label).includes(needle)) return true
  return (item.keywords ?? []).some((k) => normalise(k).includes(needle))
}

const groups = computed<SidebarSection[]>(() => {
  const needle = normalise(query.value.trim())
  if (!needle) return allGroups.value
  // A section with no surviving items is dropped whole: a heading with nothing
  // under it reads as a section that failed to load rather than one that
  // matched nothing.
  return allGroups.value
    .map((section) => ({ ...section, items: section.items.filter((i) => matches(i, needle)) }))
    .filter((section) => section.items.length > 0)
})

/** True while a query is narrowing the list — used to force groups open. */
const filtering = computed(() => query.value.trim().length > 0)

function itemActive(item: SidebarItem): boolean {
  return props.isActive ? props.isActive(item) : item.id === props.modelValue
}

function keyOf(section: SidebarSection): string {
  return section.key ?? section.title ?? ""
}

/*
 * Folded state. The app may own it (v-model:collapsed) — that is how a stored
 * setting survives a reload; otherwise the sidebar keeps it for the session.
 */
const ownCollapsed = ref<string[] | null>(null)

/** Headings + items: what the eye actually has to walk past. */
const navLength = computed(
  () => groups.value.reduce((n, g) => n + g.items.length + (g.title ? 1 : 0), 0),
)

/*
 * Nothing chosen yet and the nav is long: fold the collapsible groups, except
 * the one the reader is standing in. Once anything is toggled the choice is a
 * decision and this stops second-guessing it.
 */
const autoCollapsed = computed<string[]>(() => {
  const limit = props.autoCollapseAfter
  if (!limit || navLength.value <= limit) return []
  return groups.value
    .filter((g) => g.collapsible && !g.items.some(itemActive))
    .map(keyOf)
    .filter(Boolean)
})

const collapsedKeys = computed<string[]>(() =>
  // Nothing stays folded while a query is on: a section that matched but is
  // closed looks exactly like a section that did not match, and the person is
  // typing precisely because they cannot find the thing by eye.
  filtering.value ? [] : (props.collapsed ?? ownCollapsed.value ?? autoCollapsed.value),
)

function toggleSection(key: string, collapsed: boolean) {
  const next = collapsed
    ? [...new Set([...collapsedKeys.value, key])]
    : collapsedKeys.value.filter((k) => k !== key)
  ownCollapsed.value = next
  emit("update:collapsed", next)
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

// Chrome is per variant, not per consumer: a `class` cannot cancel a border the
// component already put on (the kit does not merge conflicting Tailwind classes),
// so the two looks are spelled out here instead.
const chromeClass = computed(() =>
  props.variant === "panel"
    ? "rounded-card border border-line bg-surface-raised"
    : "border-r border-line bg-surface-raised",
)

// This component has a fragment root (the desktop <nav> + the mobile drawer), so
// Vue can't auto-inherit a consumer-passed `class`. Take attrs over manually and
// land them on the desktop rail (where a layout class like `shrink-0` belongs).
defineOptions({ inheritAttrs: false })
</script>

<template>
  <!-- Desktop / always-on rail -->
  <nav
    class="h-full flex-col gap-1 p-3"
    :class="[railClass, chromeClass, width ? '' : 'w-60']"
    :style="width ? { width } : undefined"
    aria-label="Sidebar"
    v-bind="$attrs"
  >
    <!-- Rail: edge-to-edge (negative margins cancel the p-3) and h-16 to match
         the app header, so its bottom hairline continues the header's border-b.
         Panel: kept inside the padding — bleeding to the edge would cut across
         the rounded corners. -->
    <div
      v-if="$slots.header"
      class="mb-3 flex shrink-0 items-center"
      :class="[
        variant === 'panel' ? 'pb-3' : '-mx-3 -mt-3 h-16 px-3',
        divider ? 'border-b border-line' : '',
      ]"
    >
      <slot name="header" />
    </div>

    <!-- The filter sits between the brand and the nav: it belongs to the list,
         not to the header, and a person reaching for it is already looking at
         the items. -->
    <LpInput
      v-if="searchable"
      v-model="query"
      size="sm"
      icon="lucide:search"
      class="mb-2 shrink-0"
      :placeholder="searchPlaceholder"
      :aria-label="searchPlaceholder"
    />
    <LpSidebarNav
      :groups="groups"
      :pill-id="railPillId"
      :item-active="itemActive"
      :loading="loading"
      :skeleton-rows="skeletonRows"
      :skeleton-header="skeletonHeader"
      :collapsed-keys="collapsedKeys"
      @activate="activate"
      @toggle-section="toggleSection"
    >
      <template v-if="$slots.item" #item="slotProps">
        <slot name="item" v-bind="slotProps" />
      </template>
    </LpSidebarNav>

    <!-- Actions (search, "new …") sit just above the footer, pinned to the
         bottom of the rail and outside the scroll region — not trailing the
         nav list. -->
    <div v-if="$slots.actions" class="mt-2 flex shrink-0 flex-col gap-2">
      <slot name="actions" />
    </div>

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
    :edge-breakpoint="mobileBreakpoint"
    @update:open="(v) => emit('update:open', v)"
  >
    <div class="flex h-full flex-col gap-1">
      <div
        v-if="$slots.header"
        class="shrink-0"
        :class="divider ? 'mb-3 border-b border-line pb-3' : 'mb-2'"
      >
        <slot name="header" />
      </div>

      <!-- The filter sits between the brand and the nav: it belongs to the list,
           not to the header, and a person reaching for it is already looking at
           the items. -->
      <LpInput
        v-if="searchable"
        v-model="query"
        size="sm"
        icon="lucide:search"
        class="mb-2 shrink-0"
        :placeholder="searchPlaceholder"
        :aria-label="searchPlaceholder"
      />
      <LpSidebarNav
        :groups="groups"
        :pill-id="drawerPillId"
        :item-active="itemActive"
        :loading="loading"
        :skeleton-rows="skeletonRows"
        :skeleton-header="skeletonHeader"
        :collapsed-keys="collapsedKeys"
        @activate="activate"
        @toggle-section="toggleSection"
      >
        <template v-if="$slots.item" #item="slotProps">
          <slot name="item" v-bind="slotProps" />
        </template>
      </LpSidebarNav>

      <div v-if="$slots.actions" class="mt-2 flex shrink-0 flex-col gap-2">
        <slot name="actions" />
      </div>

      <div v-if="$slots.footer" class="mt-2 shrink-0 border-t border-line pt-3">
        <slot name="footer" />
      </div>
    </div>
  </LpDrawer>
</template>
