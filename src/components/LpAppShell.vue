<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

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
 * The header bar's two content-driven regions — the title block and the actions
 * cluster — ease between sizes rather than snapping (LpShift). Those regions
 * change constantly in normal use: actions teleport in per route or per section
 * tab, and every label is translated, so their measurements move under the
 * user. Without the easing each change re-lays the bar in a single frame.
 *
 * Everything product-specific goes through slots: #logo (brand in the rail
 * header), #sidebar-actions / #sidebar-footer (pass-through to LpSidebar),
 * #header-actions (right side of the top bar — bell, search, theme switch),
 * #header-title (override the computed title), and the default slot (page body).
 * Overlays that aren't part of the frame (command palette, toaster) live in the
 * host next to <LpAppShell>.
 */
import { computed, onMounted, ref, useId, watch } from "vue"
import { useLabels } from "../composables/useLpConfig"
import LpBottomNav from "./LpBottomNav.vue"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpShift from "./LpShift.vue"
import LpSidebar from "./LpSidebar.vue"
import type { SidebarItem, SidebarSection } from "./sidebar"
import { mergeClass, useMergedAttrs } from "../composables/useMergedClass"

export type { SidebarItem, SidebarSection } from "./sidebar"

const props = withDefaults(
  defineProps<{
    /** Flat items, or sections for grouped nav. Forwarded to LpSidebar. */
    items?: SidebarItem[]
    sections?: SidebarSection[]
    /** Folded nav groups (v-model:collapsed). Forwarded to LpSidebar. */
    collapsed?: string[]
    /** Fold long navs automatically; 0 disables. Forwarded to LpSidebar. */
    autoCollapseAfter?: number
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
    /** Text overrides: the burger's name and the skip link. */
    labels?: Partial<{ openMenu: string; skipToContent: string }>
    /** Icon-only rail (v-model:compact). Forwarded to LpSidebar. */
    compact?: boolean
    /** The person sizes the rail and folds it to icons. Forwarded to LpSidebar. */
    resizable?: boolean
    /** Rows can be pinned to the top (v-model:pinned). Forwarded to LpSidebar. */
    pinnable?: boolean
    pinned?: string[]
    /** Remember folded groups, width, compact and pins under this key. Forwarded to LpSidebar. */
    persist?: string
    /** Rest time before a row's `preview` card opens. Forwarded to LpSidebar. */
    previewDelay?: number
    /** The key that folds the rail; false turns it off. Forwarded to LpSidebar. */
    compactHotkey?: string | false
    /** Marks a non-production copy along the top of the rail. Forwarded to LpSidebar. */
    environment?: string | { label: string; tone?: "warning" | "danger" | "action" | "brand" }
    /** The app's hint system; rows with a `hintPage` show unread news as a dot. Forwarded to LpSidebar. */
    hints?: { unreadNews: (page?: string) => readonly unknown[] }
    /**
     * On phones, the main pages along the bottom instead of the burger, with
     * "More" for the rest (it opens the drawer). `true` takes the first four
     * pages, a number that many, a list of ids those pages.
     */
    bottomNav?: boolean | number | string[]
  }>(),
  {
    mobileBreakpoint: "lg",
    divider: true,
    contentClass: "mx-auto w-full max-w-6xl",
    // Unset, not false: an absent boolean would hand the sidebar "expanded"
    // and override the state it remembers.
    compact: undefined,
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", id: string): void
  (e: "update:collapsed", keys: string[]): void
  (e: "select", item: SidebarItem): void
  (e: "update:compact", value: boolean): void
  (e: "update:pinned", ids: string[]): void
}>()

// Normalise items/sections to a flat list for the title computation.
const flatItems = computed<SidebarItem[]>(() =>
  (props.sections ? props.sections.flatMap((s) => s.items) : (props.items ?? [])).flatMap((i) => [i, ...(i.children ?? [])]),
)

// Default active test: exact match for "/", prefix match (on a segment
// boundary) otherwise — so "/billing" doesn't light up on "/billing-x".
function matchesPath(item: SidebarItem): boolean {
  if (item.id === "/") return props.path === "/"
  return props.path === item.id || props.path!.startsWith(`${item.id}/`)
}

// Only the LONGEST match lights up. A parent whose id prefixes its children —
// "/dcim" over "/dcim/power" — otherwise stays lit alongside whichever child is
// open, and two highlighted items read as two current pages.
function defaultActive(item: SidebarItem): boolean {
  if (props.path == null) return item.id === props.modelValue
  if (!matchesPath(item)) return false
  return !flatItems.value.some(
    (other) =>
      other.id !== item.id &&
      other.id.length > item.id.length &&
      matchesPath(other),
  )
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
// Its own state when the app does not bind it: the shell's burger must open
// the drawer either way. v-model:open still controls it from outside.
const drawerOpen = defineModel<boolean>("open", { default: false })
const text = useLabels(
  "appShell",
  { openMenu: "Open menu", skipToContent: "Skip to content" },
  () => props.labels,
)

/*
 * The page scrolls inside the shell's own region, not the window, so the
 * router's scroll behaviour never reaches it: without this a route change from
 * a scrolled page landed mid-way down the next one.
 */
const scrollArea = ref<{ viewportEl: HTMLElement | null } | null>(null)
const bleedId = `lp-shell-bleed-${useId()}`
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const bleeding = computed(() => props.fullBleed && mounted.value)
const mainId = `lp-main-${useId()}`

// Focus instead of following the hash, which a router would treat as a navigation.
function skipToMain() {
  document.getElementById(mainId)?.focus()
}

watch(
  () => props.path,
  () => {
    if (drawerOpen.value) drawerOpen.value = false
    scrollArea.value?.viewportEl?.scrollTo({ top: 0, left: 0, behavior: "instant" })
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
const burgerClass = computed(() => (props.bottomNav ? "hidden" : burgerHidden[props.mobileBreakpoint]))

const topItems = computed<SidebarItem[]>(() => (props.sections ? props.sections.flatMap((s) => s.items) : (props.items ?? [])))
const bottomItems = computed<SidebarItem[]>(() => {
  const want = props.bottomNav
  if (!want) return []
  if (Array.isArray(want)) return want.map((id) => topItems.value.find((i) => i.id === id)).filter((i): i is SidebarItem => !!i)
  return topItems.value.slice(0, want === true ? 4 : want)
})
const moreActive = computed(() => {
  const shown = new Set(bottomItems.value.map((i) => i.id))
  return flatItems.value.some((i) => !shown.has(i.id) && activeTest.value(i)) && !bottomItems.value.some((i) => activeTest.value(i))
})
function onBottom(item: SidebarItem) {
  onModel(item.id)
  onSelect(item)
}

// Expose the burger trigger so a host can omit its own header entirely.
const _openDrawer = () => (drawerOpen.value = true)
defineExpose({ openDrawer: _openDrawer })

// The shell claims the full viewport height, which is wrong when it is embedded in a page that already has a header of its own.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex h-dvh overflow-hidden bg-surface text-ink",
)
</script>

<template>
  <div
    :class="rootClass"
    v-bind="rest">
    <a
      :href="`#${mainId}`"
      @click.prevent="skipToMain"
      class="sr-only z-(--z-toast) rounded-control bg-surface-raised px-3 py-2 text-sm font-medium text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {{ text.skipToContent }}
    </a>
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
      :collapsed="collapsed"
      :auto-collapse-after="autoCollapseAfter"
      :compact="compact"
      :resizable="resizable"
      :pinnable="pinnable"
      :pinned="pinned"
      :persist="persist"
      :preview-delay="previewDelay"
      :compact-hotkey="compactHotkey"
      :environment="environment"
      :hints="hints"
      class="shrink-0"
      @update:model-value="onModel"
      @update:compact="(v) => emit('update:compact', v)"
      @update:pinned="(v) => emit('update:pinned', v)"
      @update:open="(v) => (drawerOpen = v)"
      @update:collapsed="(v) => emit('update:collapsed', v)"
      @select="onSelect"
    >
      <template v-if="$slots.logo" #header="{ compact: folded }">
        <slot name="logo" :compact="folded" />
      </template>
      <template v-if="$slots['sidebar-actions']" #actions>
        <slot name="sidebar-actions" />
      </template>
      <template v-if="$slots['sidebar-footer']" #footer="{ compact: folded }">
        <slot name="sidebar-footer" :compact="folded" />
      </template>
      <template v-if="$slots['sidebar-item']" #item="slotProps">
        <slot name="sidebar-item" v-bind="slotProps" />
      </template>
    </LpSidebar>

    <!-- Main column: header + the single scroll region. -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- `relative` so a consumer can centre something — section tabs, a
           search box — against the WHOLE bar. Centring it inside the title
           block instead makes its position depend on how wide the actions are,
           so the tabs slide sideways every time a button appears: measured at
           59 px off centre with two actions and 77 px with three, which reads
           as the navigation drifting rather than the page changing. -->
      <header
        class="relative flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6"
      >
        <LpButton
          :class="burgerClass"
          variant="ghost"
          size="sm"
          square
          :aria-label="text.openMenu"
          @click="drawerOpen = true"
        >
          <LpIcon name="lucide:menu" :size="18" />
        </LpButton>

        <!-- The title block eases its height: a page that adds a subtitle, or a
             translation that wraps a long title onto a second line, otherwise
             re-lays the whole bar in one frame. Width is left free so the
             truncation still resolves against the space actually available. -->
        <LpShift axis="height" presence class="flex min-w-0 flex-1 items-center">
          <slot name="header-title">
            <h1 class="truncate text-lg font-semibold">{{ pageTitle }}</h1>
          </slot>
        </LpShift>

        <!-- Actions ease their WIDTH. This is the bar's worst offender: page
             actions arrive by teleport, so a button appears or disappears with
             the route or the section tab, and a translation swaps a short label
             for a long one — each snapping every control to its left sideways.
             Kept mounted regardless of the slot, so a page that only teleports
             into it still gets the easing (an empty box measures zero wide and
             costs nothing).

             `max-w` + horizontal scroll rather than `shrink-0`: a phone cannot
             fit a title and three buttons on one line, and an unshrinkable box
             resolved that by pushing its own contents past the right edge —
             where there is nothing to scroll to and nothing to press. The
             actions now cap at two thirds of the bar and scroll within it, so
             the title keeps a third and every button stays reachable. -->
        <LpShift
          axis="width"
          anchor="end"
          presence
          class="ml-auto flex max-w-[66%] shrink items-center gap-2 overflow-x-auto lp-scrollbar-none md:max-w-none md:shrink-0 md:overflow-visible"
        >
          <slot name="header-actions" />
        </LpShift>
      </header>

      <!-- full-bleed: page owns the whole region (canvas/map); otherwise the
           single scroll region with padding. The page is rendered once and
           moved between the two by a teleport rather than drawn in two
           branches: switching branches remounted the whole page, so a section
           tab going from a full-bleed page to a padded one cut instead of
           playing its transition, and lost the page's state. Until mount the
           page stays in the scroll region, which is what a server render has. -->
      <main :id="mainId" tabindex="-1" class="flex min-h-0 flex-1 flex-col outline-none">
        <div v-show="bleeding" :id="bleedId" class="min-h-0 flex-1 overflow-hidden" />
        <LpScrollArea
          v-show="!bleeding"
          ref="scrollArea"
          class="min-h-0 flex-1"
          :content-class="mergeClass('px-4 py-6 md:px-6', contentClass)"
        >
          <Teleport :to="`#${bleedId}`" :disabled="!bleeding" defer>
            <slot />
          </Teleport>
        </LpScrollArea>
      </main>
      <LpBottomNav
        v-if="bottomNav"
        :class="burgerHidden[mobileBreakpoint]"
        :items="bottomItems"
        :is-active="activeTest"
        more
        :more-active="moreActive"
        @select="onBottom"
        @more="drawerOpen = true"
      />
    </div>

    <slot name="overlays" />
  </div>
</template>
