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
import { parseCombo, useHotkeys } from "../composables/useHotkeys"
import { usePersisted } from "../composables/usePersisted"
import { useLabels } from "../composables/useLpConfig"
import LpDrawer from "./LpDrawer.vue"
import LpIcon from "./LpIcon.vue"
import LpInput from "./LpInput.vue"
import LpTooltip from "./LpTooltip.vue"
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
    /** Placeholder for that field (defaults to the `search` label). */
    searchPlaceholder?: string
    /** Text overrides: `nav` names the landmark, `search` the filter field. */
    labels?: Partial<{
      nav: string
      search: string
      pinned: string
      pin: string
      unpin: string
      expand: string
      compact: string
      expandRail: string
      resize: string
    }>
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
     * Remember which groups the user folded, across visits, under this key
     * (the kit's storage, see `usePersisted`). Without it, and without
     * v-model:collapsed, the choice lasts for the session.
     */
    persist?: string
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
    /**
     * The active pill follows the hovered item, as in LpTabs. Off by default;
     * see LpSidebarNav for why a tall nav keeps it pinned.
     */
    hoverFollow?: boolean
    /**
     * Icons only (v-model:compact): each row's name, count and the pages under
     * it move into a card beside the icon. With `resizable` the person decides,
     * and the choice is remembered under `persist`.
     */
    compact?: boolean
    /**
     * The person sizes the rail: drag its edge (double-click resets), drag it
     * narrow enough and it folds to icons, and a button and Ctrl+B fold it
     * outright. One mechanism, not two: a narrow rail that only truncates its
     * labels is the worst of both, so below a point it becomes the icon rail.
     */
    resizable?: boolean
    /** Rail width bounds while resizing, in px. */
    minWidth?: number
    maxWidth?: number
    /** The key that folds the rail when `resizable`. False turns it off. */
    compactHotkey?: string | false
    /**
     * Rows offer "Pin to top" in their menu, and pinned pages lead the nav
     * (v-model:pinned, ids; remembered under `persist` when unbound).
     */
    pinnable?: boolean
    pinned?: string[]
    /** How long the pointer rests on a row with a `preview` before its card opens, in ms. */
    previewDelay?: number
  }>(),
  {
    skeletonRows: 6,
    skeletonHeader: true,
    responsive: false,
    mobileBreakpoint: "md",
    divider: true,
    variant: "rail",
    autoCollapseAfter: 14,
    hoverFollow: false,
    compact: undefined,
    minWidth: 180,
    maxWidth: 420,
    compactHotkey: "Ctrl+B",
    previewDelay: 900,
  },
)

const emit = defineEmits<{
  (e: "update:modelValue", id: string): void
  (e: "update:open", value: boolean): void
  (e: "update:collapsed", keys: string[]): void
  (e: "select", item: SidebarItem): void
  (e: "update:search", value: string): void
  (e: "update:compact", value: boolean): void
  (e: "update:pinned", ids: string[]): void
}>()

defineSlots<{
  /** The brand; `compact` says the rail is down to icons. */
  header?: (props: { compact?: boolean }) => unknown
  actions?: (props: { compact?: boolean }) => unknown
  footer?: (props: { compact?: boolean }) => unknown
  item?: (props: { item: SidebarItem; active: boolean }) => unknown
}>()

const text = useLabels(
  "sidebar",
  {
    nav: "Sidebar",
    search: "Search",
    pinned: "Pinned",
    pin: "Pin to top",
    unpin: "Unpin",
    expand: "Show the pages under it",
    compact: "Collapse the sidebar",
    expandRail: "Expand the sidebar",
    resize: "Drag to resize, double-click to reset",
  },
  () => props.labels,
)
const placeholder = computed(() => props.searchPlaceholder ?? text.value.search)

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

/** The item if it matches, with every page under it; else only the pages under it that match. */
function narrowed(item: SidebarItem, needle: string): SidebarItem | null {
  if (matches(item, needle)) return item
  const children = (item.children ?? []).filter((c) => matches(c, needle))
  return children.length ? { ...item, children } : null
}

const groups = computed<SidebarSection[]>(() => {
  const needle = normalise(query.value.trim())
  if (!needle) return allGroups.value
  // A section with no surviving items is dropped whole: a heading with nothing
  // under it reads as a section that failed to load rather than one that
  // matched nothing.
  return allGroups.value
    .map((section) => ({
      ...section,
      items: section.items.map((i) => narrowed(i, needle)).filter((i): i is SidebarItem => i !== null),
    }))
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
 * Folded state. The app may own it (v-model:collapsed); otherwise the sidebar
 * keeps it, for the session or, under `persist`, across visits. Null until
 * something is toggled, so the automatic folding below still applies.
 */
const ownCollapsed = usePersisted<string[] | null>(
  () => props.persist && `lp-sidebar:${props.persist}`,
  null,
  { validate: (value): value is string[] | null => value === null || (Array.isArray(value) && value.every((k) => typeof k === "string")) },
)

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
    .filter((g) => g.collapsible && !g.items.some((i) => itemActive(i) || !!i.children?.some(itemActive)))
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

/*
 * Compact and width. Bound, the app owns them; unbound, the sidebar keeps them,
 * across visits under `persist`.
 */
const ownCompact = usePersisted<boolean>(() => props.persist && `lp-sidebar:${props.persist}:compact`, false)
const isCompact = computed(() => props.compact ?? ownCompact.value)
function setCompact(value: boolean) {
  ownCompact.value = value
  emit("update:compact", value)
}

const DEFAULT_WIDTH = 240
const COMPACT_WIDTH = 64
const ownWidth = usePersisted<number>(() => props.resizable && props.persist && `lp-sidebar:${props.persist}:width`, DEFAULT_WIDTH)
const dragging = ref(false)

const railWidth = computed(() => {
  if (isCompact.value) return `${COMPACT_WIDTH}px`
  if (props.resizable) return `${ownWidth.value}px`
  return props.width
})

/*
 * Dragging past the narrowest width folds the rail to icons, and dragging a
 * folded rail out unfolds it: below a point labels only truncate to nothing
 * useful, and the icon rail is the honest form of "narrow".
 */
const FOLD_AT = 132
function startResize(event: PointerEvent) {
  if (event.button !== 0) return
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  const from = event.clientX
  const start = isCompact.value ? COMPACT_WIDTH : ownWidth.value
  dragging.value = true
  const move = (e: PointerEvent) => {
    const wanted = start + (e.clientX - from)
    if (wanted < FOLD_AT) {
      // Folded by dragging: the width it unfolds to is the one it had, not
      // the narrowest the drag passed through on its way down.
      if (!isCompact.value) setCompact(true)
      if (start !== COMPACT_WIDTH) ownWidth.value = start
      return
    }
    if (isCompact.value) setCompact(false)
    ownWidth.value = Math.round(Math.min(props.maxWidth, Math.max(props.minWidth, wanted)))
  }
  const stop = () => {
    dragging.value = false
    handle.removeEventListener("pointermove", move)
    handle.removeEventListener("pointerup", stop)
    handle.removeEventListener("pointercancel", stop)
  }
  handle.addEventListener("pointermove", move)
  handle.addEventListener("pointerup", stop)
  handle.addEventListener("pointercancel", stop)
}
function resetWidth() {
  ownWidth.value = DEFAULT_WIDTH
  setCompact(false)
}

useHotkeys(() =>
  props.resizable && props.compactHotkey
    ? [
        {
          ...parseCombo(props.compactHotkey),
          help: { group: text.value.nav, label: text.value.compact, combo: props.compactHotkey },
          handler: () => setCompact(!isCompact.value),
        },
      ]
    : [],
)

/* Pinned pages, by id; unbound they are kept under `persist`. */
const ownPinned = usePersisted<string[]>(() => props.persist && `lp-sidebar:${props.persist}:pinned`, [], {
  validate: (value): value is string[] => Array.isArray(value) && value.every((k) => typeof k === "string"),
})
const pinnedIds = computed(() => props.pinned ?? ownPinned.value)
const everyItem = computed(() => allGroups.value.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])])))
const pinnedItems = computed<SidebarItem[]>(() =>
  props.pinnable
    ? pinnedIds.value.map((id) => everyItem.value.find((i) => i.id === id)).filter((i): i is SidebarItem => !!i)
    : [],
)
function togglePin(id: string) {
  const next = pinnedIds.value.includes(id) ? pinnedIds.value.filter((k) => k !== id) : [...pinnedIds.value, id]
  ownPinned.value = next
  emit("update:pinned", next)
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
    class="relative h-full shrink-0 flex-col gap-1"
    :class="[
      railClass,
      chromeClass,
      isCompact ? 'px-2 py-3' : 'p-3',
      railWidth ? '' : 'w-60',
      dragging ? '' : 'transition-[width] duration-(--duration-medium) ease-[var(--ease-emphasized)] motion-reduce:transition-none',
    ]"
    :style="railWidth ? { width: railWidth } : undefined"
    :data-compact="isCompact || undefined"
    :aria-label="text.nav"
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
        variant === 'panel' ? 'pb-3' : isCompact ? '-mx-2 -mt-3 h-16 overflow-hidden px-[18px] [mask-image:linear-gradient(to_right,black_75%,transparent)]' : '-mx-3 -mt-3 h-16 px-3',
        divider ? 'border-b border-line' : '',
      ]"
    >
      <slot name="header" :compact="isCompact" />
    </div>

    <!-- The filter sits between the brand and the nav: it belongs to the list,
         not to the header, and a person reaching for it is already looking at
         the items. -->
    <LpInput
      v-if="searchable && !isCompact"
      v-model="query"
      size="sm"
      icon="lucide:search"
      clearable
      class="mb-2 shrink-0"
      :placeholder="placeholder"
      :aria-label="placeholder"
    />
    <LpSidebarNav
      :groups="groups"
      :pill-id="railPillId"
      :compact="isCompact"
      :pinnable="pinnable"
      :pinned="pinnedItems"
      :preview-delay="previewDelay"
      :labels="text"
      :item-active="itemActive"
      :loading="loading"
      :skeleton-rows="skeletonRows"
      :skeleton-header="skeletonHeader"
      :collapsed-keys="collapsedKeys"
      :hover-follow="hoverFollow"
      @activate="activate"
      @toggle-section="toggleSection"
      @toggle-pin="togglePin"
    >
      <template v-if="$slots.item" #item="slotProps">
        <slot name="item" v-bind="slotProps" />
      </template>
    </LpSidebarNav>

    <LpTooltip v-if="resizable" :content="isCompact ? text.expandRail : text.compact" side="right">
      <button
        type="button"
        class="mt-1 flex h-8 shrink-0 items-center gap-2 rounded-control px-3 text-xs text-muted outline-none transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        :class="isCompact ? 'mx-auto w-10 justify-center px-0' : ''"
        :aria-label="isCompact ? text.expandRail : text.compact"
        :aria-pressed="isCompact"
        @click="setCompact(!isCompact)"
      >
        <LpIcon :name="isCompact ? 'lucide:panel-left-open' : 'lucide:panel-left-close'" :size="16" class="shrink-0" />
        <span v-if="!isCompact" class="truncate">{{ text.compact }}</span>
      </button>
    </LpTooltip>

    <!-- Actions (search, "new …") sit just above the footer, pinned to the
         bottom of the rail and outside the scroll region — not trailing the
         nav list. -->
    <div v-if="$slots.actions" class="mt-2 flex shrink-0 flex-col gap-2">
      <slot name="actions" :compact="isCompact" />
    </div>

    <div v-if="$slots.footer" class="mt-2 shrink-0 overflow-hidden border-t border-line pt-3">
      <slot name="footer" :compact="isCompact" />
    </div>

    <!-- The edge itself is the handle: a few pixels either side of the
         hairline, a brand line while it is held. -->
    <div
      v-if="resizable && variant === 'rail'"
      role="separator"
      aria-orientation="vertical"
      :aria-label="text.resize"
      :title="text.resize"
      class="group/resize absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none"
      @pointerdown="startResize"
      @dblclick="resetWidth"
    >
      <span
        class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-brand opacity-0 transition-opacity duration-(--duration-fast) group-hover/resize:opacity-60"
        :class="dragging ? '!opacity-100' : ''"
      />
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
    <nav class="flex h-full flex-col gap-1" :aria-label="text.nav">
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
        clearable
        class="mb-2 shrink-0"
        :placeholder="placeholder"
        :aria-label="placeholder"
      />
      <LpSidebarNav
        :groups="groups"
        :pill-id="drawerPillId"
        :pinnable="pinnable"
        :pinned="pinnedItems"
        :preview-delay="previewDelay"
        :labels="text"
        :item-active="itemActive"
        :loading="loading"
        :skeleton-rows="skeletonRows"
        :skeleton-header="skeletonHeader"
        :collapsed-keys="collapsedKeys"
        :hover-follow="hoverFollow"
        @activate="activate"
        @toggle-section="toggleSection"
        @toggle-pin="togglePin"
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
    </nav>
  </LpDrawer>
</template>
