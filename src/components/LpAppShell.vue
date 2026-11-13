<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }

/** Wording of the shell's own controls and landmarks. */
export type AppShellLabels = {
  openMenu: string
  skipToContent: string
  backToTop: string
  aside: string
  contextNav: string
}
</script>

<script setup lang="ts">
/*
 * Full application shell: the side navigation rail, a top header bar and the
 * page, which is what scrolls.
 *
 * By default the page is the document: it scrolls the window, and the rail,
 * the header and the bottom bar are sticky beside and above it. So everything
 * a browser does with a long page keeps working — a full-page screenshot,
 * printing, the phone's address bar folding away, pull to refresh, a tap on
 * the status bar. `scroll="region"` keeps the older frame instead: the shell
 * is exactly the viewport and the page scrolls inside main (LpScrollArea),
 * which suits a shell embedded in a page of its own. A `fullBleed` page is
 * held to the viewport in either.
 *
 * It owns the things every product's cabinet/console layout was re-implementing
 * by hand — and getting subtly wrong:
 *  - the rail is full viewport height and never scrolls with the page, so the
 *    sidebar footer stays pinned;
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
 *
 * Every option below is off until asked for, and the shell's markup without
 * them is what it always was: `headerCollapse`, `backToTop`, `density`,
 * `pageTransition`, `safeArea`, the #aside region and `adaptiveNav`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useSlots, watch } from "vue"
import { easingToken, durationToken, prefersReducedMotion } from "../composables/easing"
import { useLabels } from "../composables/useLpConfig"
import { useResizeObserver } from "../composables/useResizeObserver"
import { useScrollMemory } from "../composables/scrollMemory"
import { useScrollStrip } from "../composables/useScrollStrip"
import { isHTMLElement, nodeWindow, useView, viewWindow } from "../composables/useView"
import AppShellContextNav from "./AppShellContextNav.vue"
import {
  contextNavItems,
  DENSITY_CLASS,
  headerCollapsedAfter,
  NAV_BREAKPOINT_PX,
  resolveNavMode,
  type AdaptiveNav,
  type NavBreakpoint,
  type NavMode,
  type ShellDensity,
} from "./appShell"
import LpBottomNav from "./LpBottomNav.vue"
import LpContextSwitcher from "./LpContextSwitcher.vue"
import LpButton from "./LpButton.vue"
import LpIcon from "./LpIcon.vue"
import LpPageScrollbar from "./LpPageScrollbar.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpShift from "./LpShift.vue"
import LpSidebar from "./LpSidebar.vue"
import type { AppContext, SidebarItem, SidebarSection } from "./sidebar"
import { mergeClass, useMergedAttrs } from "../composables/useMergedClass"

export type { SidebarItem, SidebarSection } from "./sidebar"

/* Past this much scrolled the way back up is worth a button. */
const BACK_TO_TOP_AFTER_PX = 600

// The header actions scroll sideways on a narrow bar; a mouse reaches the ones
// past the edge with the wheel or a drag, and the clipped edge fades.
const headerActions = ref<{ $el: HTMLElement } | null>(null)
const actionStrip = useScrollStrip(() => headerActions.value?.$el)

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
     *
     * A new path also places the page in the shell's scroll region: back and
     * forward return to where it was left, a `hash` lands on that anchor
     * (honouring its `scroll-margin-top`), anything else starts at the top.
     */
    path?: string
    /**
     * The current route hash (`route.hash`). With `path` it lands a page on
     * its anchor; a new hash on the same path glides there, after a dialog
     * that started the jump has closed.
     */
    hash?: string
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
    /**
     * What scrolls. `"document"` (the default): the window, with the rail,
     * header and bottom bar sticky; a page that filled main with `h-full`
     * grows with its content now, so a page meant to fill the screen asks for
     * `min-h-[calc(100dvh-4rem)]` or `fullBleed`. `"region"`: the shell is
     * the viewport and the page scrolls inside main. Read once: changing it
     * remounts the page.
     *
     * A page's own sticky parts keep clear of the shell's with two variables
     * set inside it: `--lp-shell-top`, how much of the window's top the shell
     * covers (the header, 0 while `headerCollapse` has it away, plus the
     * sub-page row), and `--lp-shell-bottom`, how much of its foot (the bottom
     * bar). Both change as those do, and are 0px in `"region"` and on a
     * `fullBleed` page, where nothing of the shell's lies over the page:
     * `position: sticky; top: var(--lp-shell-top)`. Keep the page's sticky
     * layers under `--z-sticky`, the shell's.
     */
    scroll?: "document" | "region"
    /**
     * While the document scrolls, draw the kit's overlay bar for it
     * (LpPageScrollbar) under the header and above the bottom bar, in place of
     * the browser's, which takes width from the page. `false` keeps the
     * browser's. Where the browser's bars float anyway (phones) it draws none.
     */
    pageScrollbar?: boolean
    /** Loading skeleton for the nav. */
    loading?: boolean
    /** Text overrides: the burger's name and the skip link. */
    labels?: Partial<AppShellLabels>
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
    /**
     * The app's contexts — a server, a workspace, a part of the product — each
     * with its own rail. With more than one, the rail's header becomes the
     * switcher between them (v-model:context), and the `logo` slot draws the
     * switcher's face with the current `context` in its props.
     */
    contexts?: AppContext[]
    context?: string
    /** Marks a non-production copy along the top of the rail. Forwarded to LpSidebar. */
    environment?: string | { label: string; tone?: "warning" | "danger" | "action" | "brand" }
    /** The app's hint system; rows with a `hintPage` show unread news as a dot. Forwarded to LpSidebar. */
    hints?: { unreadNews: (page?: string) => readonly unknown[] }
    /**
     * On phones, the main pages along the bottom instead of the burger, with
     * "More" for the rest (it opens the drawer). `true` takes the first four
     * pages, a number that many, a list of ids those pages. Top-level pages
     * only: an id from `children` is ignored, and such a page stays behind "More".
     */
    bottomNav?: boolean | number | string[]
    /**
     * The header leaves as the page scrolls down and returns on the way up,
     * giving a small screen its height back. A keyboard user tabbing into it
     * brings it back too. A full-bleed page owns its scrolling, so the header
     * stays there.
     */
    headerCollapse?: boolean
    /** A button back to the top of a long page; a number sets how far down it appears, in px. */
    backToTop?: boolean | number
    /** How tight the page sits in main. Unset keeps the shell's own padding. */
    density?: ShellDensity
    /**
     * A new `path` fades the page and the header's title and actions in as one,
     * on the same clock, so actions arriving by teleport do not land apart from
     * their page. Nothing is remounted. Skipped under reduced motion.
     */
    pageTransition?: boolean
    /**
     * Keep the header and the page's end clear of a notch and a home bar
     * (`viewport-fit=cover`). The bottom bar always does.
     */
    safeArea?: boolean
    /** Tailwind breakpoint below which the #aside region is hidden. Defaults to `mobileBreakpoint`. */
    asideBreakpoint?: NavBreakpoint
    /** Classes for the #aside region, its width above all. */
    asideClass?: string
    /**
     * One model for the navigation across widths; see `NavMode`. Below
     * `mobileBreakpoint` it is `bottomNav` or the drawer, as ever; this adds the
     * fold to icons in between and the row of sub-pages where the rail is gone.
     * A `compact` the app controls wins, and a person folding the rail by hand
     * holds until the width crosses into another mode.
     */
    adaptiveNav?: AdaptiveNav
  }>(),
  {
    mobileBreakpoint: "lg",
    divider: true,
    contentClass: "mx-auto w-full max-w-6xl",
    scroll: "document",
    pageScrollbar: true,
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
  (e: "update:context", id: string): void
  /** The navigation the width settled on, with `adaptiveNav` or without. */
  (e: "nav-mode", mode: NavMode): void
}>()

const switching = computed(() => (props.contexts?.length ?? 0) > 1)

// Normalise items/sections to a flat list for the title computation.
const flatItems = computed<SidebarItem[]>(() =>
  (props.sections ? props.sections.flatMap((s) => s.items) : (props.items ?? [])).flatMap((i) => [i, ...(i.children ?? [])]),
)

// Compared in one spelling, so "/billing/" and "//billing" are "/billing".
const SLASH_RUN = /\/{2,}/g
const TRAILING_SLASH = /(?<=.)\/$/
const cleanPath = computed(() => props.path?.replace(SLASH_RUN, "/").replace(TRAILING_SLASH, ""))

// Default active test: exact match for "/", prefix match (on a segment
// boundary) otherwise — so "/billing" doesn't light up on "/billing-x".
function matchesPath(item: SidebarItem): boolean {
  if (item.id === "/") return cleanPath.value === "/"
  return cleanPath.value === item.id || cleanPath.value!.startsWith(`${item.id}/`)
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
const text = useLabels<AppShellLabels>(
  "appShell",
  { openMenu: "Open menu", skipToContent: "Skip to content", backToTop: "Back to top", aside: "Details", contextNav: "In this section" },
  () => props.labels,
)

/*
 * The page scrolls inside the shell's own region, not the window, so the
 * router's scroll behaviour never reaches it: without this a route change from
 * a scrolled page landed mid-way down the next one, and back never returned.
 * A full-bleed page owns its scrolling, so the shell leaves it alone.
 */
const scrollArea = ref<{ viewportEl: HTMLElement | null } | null>(null)
const asideArea = ref<{ viewportEl: HTMLElement | null } | null>(null)
const pageEl = ref<HTMLElement | null>(null)
const bleedId = `lp-shell-bleed-${useId()}`
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const bleeding = computed(() => props.fullBleed && mounted.value)
const documentScroll = props.scroll !== "region"
// The window scrolls the page; a full-bleed page holds the shell to the viewport.
const windowScrolls = computed(() => documentScroll && !props.fullBleed)
const mainId = `lp-main-${useId()}`

// Focus instead of following the hash, which a router would treat as a navigation.
const mainEl = ref<HTMLElement | null>(null)
function skipToMain() {
  mainEl.value?.focus()
}

watch(
  () => props.path,
  () => {
    if (drawerOpen.value) drawerOpen.value = false
    headerCollapsed.value = false
  },
)
function pageScroller(): HTMLElement | null | undefined {
  if (bleeding.value) return null
  if (!documentScroll) return scrollArea.value?.viewportEl
  return (pageEl.value?.ownerDocument.scrollingElement as HTMLElement | null | undefined) ?? null
}
useScrollMemory(
  pageScroller,
  () => props.path,
  () => props.hash,
  "",
  // The sticky header and sub-page row cover the top of the window; a region starts below them.
  () => (documentScroll && !bleeding.value ? (headerEl.value?.offsetHeight ?? 0) + contextRowHeight.value : 0),
)
// The side region keeps its own place on the same address.
useScrollMemory(
  () => asideArea.value?.viewportEl,
  () => props.path,
  () => undefined,
  "aside:",
)

const headerCollapsed = ref(false)
const scrolledFar = ref(false)
const backToTopAfter = computed(() => (typeof props.backToTop === "number" ? props.backToTop : BACK_TO_TOP_AFTER_PX))
let lastTop = 0

function onScrolled(top: number, max: number) {
  if (!props.headerCollapse && !props.backToTop) return
  if (props.headerCollapse) headerCollapsed.value = headerCollapsedAfter(headerCollapsed.value, lastTop, top, max)
  scrolledFar.value = top > backToTopAfter.value
  lastTop = top
}
function onMainScroll(event: Event) {
  const view = event.target as HTMLElement
  onScrolled(view.scrollTop, view.scrollHeight - view.clientHeight)
}
function onWindowScroll() {
  const view = pageScroller()
  if (view) onScrolled(view.scrollTop, view.scrollHeight - view.clientHeight)
}

const headerHidden = computed(() => headerCollapsed.value && !bleeding.value)
const HEADER_HEIGHT = "4rem"
const headerHeight = computed(() => (props.safeArea ? `calc(${HEADER_HEIGHT} + env(safe-area-inset-top))` : HEADER_HEIGHT))

/*
 * A full-bleed page shrinks the document to the viewport, which loses the
 * place; it is taken back on the way out, unless the page changed in between.
 *
 * No scroll-padding-top on the document for the sticky header: with it the
 * browser counts the header as covered by itself, and a control in it taking
 * focus scrolled the page (by 350 px, measured). Anchors get the header's
 * height from scroll memory instead.
 */
let bleedTop: number | undefined
watch(
  () => props.path,
  () => (bleedTop = undefined),
)
watch(bleeding, (bleed) => {
  if (!documentScroll) return
  const view = pageEl.value?.ownerDocument.scrollingElement
  if (!view) return
  if (bleed) bleedTop = view.scrollTop
  else if (bleedTop !== undefined) {
    const top = bleedTop
    bleedTop = undefined
    void nextTick(() => view.scrollTo({ top, behavior: "instant" }))
  }
})
/*
 * What the shell's sticky bars cover of the window, for the page: the sub-page
 * row's height (it sits under the header) and the bottom bar's (0 where hidden).
 */
const bottomBarEl = ref<{ $el: HTMLElement } | null>(null)
const bottomBarHeight = ref(0)
useResizeObserver(
  () => (bottomBarEl.value?.$el?.nodeType === 1 ? bottomBarEl.value.$el : null),
  (_, el) => (bottomBarHeight.value = (el as HTMLElement).offsetHeight),
  { immediate: true },
)
const contextRowEl = ref<HTMLElement | null>(null)
const contextRowHeight = ref(0)

let releaseDocument: (() => void) | undefined
onMounted(() => {
  if (!documentScroll || !pageEl.value) return
  const win = nodeWindow(pageEl.value)
  win.addEventListener("scroll", onWindowScroll, { passive: true })
  releaseDocument = () => win.removeEventListener("scroll", onWindowScroll)
})
onBeforeUnmount(() => releaseDocument?.())

function scrollToTop() {
  const view = pageScroller()
  if (!view) return
  view.scrollTo({ top: 0, behavior: prefersReducedMotion(nodeWindow(view)) ? "instant" : "smooth" })
  // The button is about to leave, and focus must not leave with it.
  mainEl.value?.focus()
}

const headerClass = computed(() =>
  mergeClass(
    "relative flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6",
    windowScrolls.value && `${STICKY} top-0`,
    props.headerCollapse &&
      (windowScrolls.value ? "transition-transform" : "transition-[margin-top]") + " duration-[var(--duration-medium)] ease-[var(--ease-settle)]",
    props.safeArea &&
      "h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))]",
  ),
)
const pageClass = computed(() =>
  mergeClass(
    DENSITY_CLASS[props.density ?? "comfortable"],
    props.contentClass,
    props.safeArea && !props.bottomNav && "pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
  ),
)

// Fades on one clock, read from the page's own tokens. Post flush: a teleported
// action arrives with the render that brought the page.
const headerEl = ref<HTMLElement | null>(null)
const bleedEl = ref<HTMLElement | null>(null)
watch(
  () => props.path,
  () => {
    const content = bleeding.value ? bleedEl.value : documentScroll ? pageEl.value : scrollArea.value?.viewportEl
    if (!props.pageTransition || !content || prefersReducedMotion(nodeWindow(content))) return
    const timing = { duration: durationToken("duration-medium", undefined, content), easing: easingToken("ease-settle", undefined, content) }
    // Title and actions; the burger is the frame, not the page.
    const header = headerEl.value?.querySelectorAll(":scope > :not(button)") ?? []
    for (const el of [content, ...header]) el.animate({ opacity: [0, 1] }, timing)
  },
  { flush: "post" },
)

const slots = useSlots()
const hasAside = computed(() => !!slots.aside)
const ASIDE_VISIBLE: Record<NavBreakpoint, string> = {
  sm: "hidden sm:flex",
  md: "hidden md:flex",
  lg: "hidden lg:flex",
  xl: "hidden xl:flex",
  "2xl": "hidden 2xl:flex",
}
const asideClasses = computed(() =>
  mergeClass(
    "min-h-0 w-80 flex-col border-l border-line bg-surface",
    windowScrolls.value &&
      "sticky top-(--lp-shell-top) h-[calc(100dvh-var(--lp-shell-top))] self-start transition-[top,height] duration-[var(--duration-medium)] ease-[var(--ease-settle)]",
    ASIDE_VISIBLE[props.asideBreakpoint ?? props.mobileBreakpoint],
    props.asideClass,
  ),
)

/*
 * The aside takes a grid column rather than a wrapper around main: a wrapper
 * that comes and goes with the slot would remount the page. Header, the
 * sub-page row and the bottom bar span both columns.
 */
const columnClass = computed(() => (hasAside.value ? "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto]" : "flex min-w-0 flex-1 flex-col"))
const columnStyle = computed(() => ({
  ...(hasAside.value ? { gridTemplateRows: `auto ${contextVisible.value ? "auto " : ""}minmax(0,1fr) auto` } : {}),
  ...shellVars.value,
}))
const spanClass = computed(() => (hasAside.value ? "col-span-2" : undefined))

// One width rather than a media query per breakpoint: those report one by one,
// so a jump across two passed through a mode the window was never in.
const view = useView()
const width = ref(0)
const measureWidth = () => (width.value = viewWindow(view.value).innerWidth)
onMounted(() => {
  measureWidth()
  viewWindow(view.value).addEventListener("resize", measureWidth)
})
onBeforeUnmount(() => viewWindow(view.value).removeEventListener("resize", measureWidth))

// Before mount there is no width: a server render is the plain rail.
const navMode = computed<NavMode>(() =>
  mounted.value
    ? resolveNavMode((breakpoint) => width.value >= NAV_BREAKPOINT_PX[breakpoint], {
        mobileBreakpoint: props.mobileBreakpoint,
        bottomNav: !!props.bottomNav,
        compactBelow: props.adaptiveNav?.compactBelow,
      })
    : "rail",
)
watch(navMode, (mode) => emit("nav-mode", mode))

// What a person chose by hand, for as long as the width stays in this mode.
const handCompact = ref<boolean | undefined>()
watch(navMode, () => (handCompact.value = undefined))
const railCompact = computed(() => props.compact ?? handCompact.value ?? (navMode.value === "compact" ? true : undefined))
function onCompact(value: boolean) {
  if (props.adaptiveNav) handCompact.value = value
  emit("update:compact", value)
}

const contextItems = computed(() => (props.adaptiveNav?.contextNav ? contextNavItems(topItems.value, activeTest.value) : []))
const contextVisible = computed(
  () => (navMode.value === "bottom" || navMode.value === "drawer") && (contextItems.value.length > 0 || (!!slots["context-nav"] && !!props.adaptiveNav?.contextNav)),
)
// The row is the app's own slot or the shell's, so it is found where it renders: right after the header.
watch(
  [contextVisible, mounted],
  () => {
    const next = headerEl.value?.nextElementSibling
    contextRowEl.value = contextVisible.value && isHTMLElement(next) && next !== mainEl.value ? next : null
    if (!contextRowEl.value) contextRowHeight.value = 0
  },
  { flush: "post" },
)
useResizeObserver(contextRowEl, (_, el) => (contextRowHeight.value = (el as HTMLElement).offsetHeight), { immediate: true })

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
defineExpose({ openDrawer: _openDrawer, navMode })

// In region mode the shell claims the full viewport height, which is wrong when it is embedded in a page that already has a header of its own.
// The document mode clips sideways with `clip`, not `hidden`: a hidden overflow would make the root the sticky children's scroller.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  windowScrolls.value ? "flex min-h-dvh overflow-x-clip bg-surface text-ink" : "flex h-dvh overflow-hidden bg-surface text-ink",
)

/*
 * What stays in view while the window scrolls the page. The header sits on
 * top; the row of sub-pages sits under it and follows it out when it
 * collapses (--lp-shell-header is how much of the header is showing).
 *
 * Two variables are the page's to use (documented on `scroll`), and set in
 * every mode, so `var(--lp-shell-top)` never needs a fallback:
 * --lp-shell-top is how much of the window's top the shell covers (header
 * plus sub-page row), --lp-shell-bottom how much of its foot (the bottom
 * bar). Both are 0px where the page scrolls in its own region or is full bleed.
 */
const STICKY = "sticky z-(--z-sticky)"
const railClass = computed(() => (windowScrolls.value ? "sticky top-0 flex h-dvh shrink-0 self-start" : "contents"))
const shellHeader = computed(() => (headerHidden.value ? "0px" : headerHeight.value))
const shellVars = computed(() =>
  windowScrolls.value
    ? {
        "--lp-shell-header": shellHeader.value,
        "--lp-shell-top": `calc(${shellHeader.value} + ${contextRowHeight.value}px)`,
        "--lp-shell-bottom": `${bottomBarHeight.value}px`,
      }
    : { "--lp-shell-header": "0px", "--lp-shell-top": "0px", "--lp-shell-bottom": "0px" },
)
const BACK_TO_TOP_ABOVE_BAR: Record<NavBreakpoint, string> = {
  sm: "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
  md: "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
  lg: "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
  xl: "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] xl:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
  "2xl": "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] 2xl:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
}
const backToTopClass = computed(() =>
  windowScrolls.value
    ? ["fixed right-6 z-(--z-sticky)", props.bottomNav ? BACK_TO_TOP_ABOVE_BAR[props.mobileBreakpoint] : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"]
    : "absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-6",
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
    <!-- The rail's own box: a viewport-tall sticky column while the window
         scrolls the page, and no box at all (contents) in the region frame,
         where the rail is the frame's full height already. -->
    <div :class="railClass">
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
      :compact="railCompact"
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
      @update:compact="onCompact"
      @update:pinned="(v) => emit('update:pinned', v)"
      @update:open="(v) => (drawerOpen = v)"
      @update:collapsed="(v) => emit('update:collapsed', v)"
      @select="onSelect"
    >
      <template v-if="switching" #header="{ compact: folded }">
        <LpContextSwitcher
          :contexts="contexts!"
          :model-value="context"
          :compact="folded"
          @update:model-value="(id) => emit('update:context', id)"
        >
          <template v-if="$slots.logo" #default="{ context: shown }">
            <slot name="logo" :compact="folded" :context="shown" />
          </template>
        </LpContextSwitcher>
      </template>
      <template v-else-if="$slots.logo" #header="{ compact: folded }">
        <slot name="logo" :compact="folded" :context="contexts?.[0]" />
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
    </div>

    <!-- Main column: header + the single scroll region. -->
    <div :class="columnClass" :style="columnStyle">
      <!-- `relative` so a consumer can centre something — section tabs, a
           search box — against the WHOLE bar. Centring it inside the title
           block instead makes its position depend on how wide the actions are,
           so the tabs slide sideways every time a button appears: measured at
           59 px off centre with two actions and 77 px with three, which reads
           as the navigation drifting rather than the page changing. -->
      <header
        ref="headerEl"
        :class="[headerClass, spanClass]"
        :style="headerHidden ? (windowScrolls ? { transform: 'translateY(-100%)' } : { marginTop: `calc(-1 * ${headerHeight})` }) : undefined"
        @focusin="headerCollapsed = false"
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
          ref="headerActions"
          axis="width"
          anchor="end"
          presence
          class="lp-strip-fade ml-auto flex max-w-[66%] shrink items-center gap-2 overflow-x-auto lp-scrollbar-none md:max-w-none md:shrink-0 md:overflow-visible"
          :data-lp-more-start="actionStrip.overflowing.value && !actionStrip.atStart.value ? '' : undefined"
          :data-lp-more-end="actionStrip.overflowing.value && !actionStrip.atEnd.value ? '' : undefined"
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
      <template v-if="contextVisible">
        <slot name="context-nav" :items="contextItems" :mode="navMode">
          <AppShellContextNav
            :class="[spanClass, windowScrolls && `${STICKY} top-(--lp-shell-header) transition-[top] duration-[var(--duration-medium)] ease-[var(--ease-settle)]`]"
            :items="contextItems"
            :is-active="activeTest"
            :label="text.contextNav"
            @select="onBottom"
          />
        </slot>
      </template>
      <main ref="mainEl" :id="mainId" tabindex="-1" :data-lp-density="density" :class="['flex min-h-0 flex-1 flex-col outline-none', backToTop && 'relative']">
        <div ref="bleedEl" v-show="bleeding" :id="bleedId" class="min-h-0 flex-1 overflow-hidden" />
        <div v-if="documentScroll" v-show="!bleeding" ref="pageEl" :class="['flex-1', pageClass]">
          <Teleport :to="`#${bleedId}`" :disabled="!bleeding" defer>
            <slot />
          </Teleport>
        </div>
        <LpScrollArea
          v-else
          v-show="!bleeding"
          ref="scrollArea"
          class="min-h-0 flex-1"
          :content-class="pageClass"
          @scroll="onMainScroll"
        >
          <Teleport :to="`#${bleedId}`" :disabled="!bleeding" defer>
            <slot />
          </Teleport>
        </LpScrollArea>
        <LpButton
          v-if="backToTop && scrolledFar && !bleeding"
          :class="backToTopClass"
          variant="outline"
          size="sm"
          square
          :aria-label="text.backToTop"
          @click="scrollToTop"
        >
          <LpIcon name="lucide:arrow-up" :size="16" />
        </LpButton>
      </main>
      <aside v-if="hasAside" :aria-label="text.aside" :class="asideClasses">
        <LpScrollArea ref="asideArea" class="min-h-0 flex-1" content-class="p-4">
          <slot name="aside" />
        </LpScrollArea>
      </aside>
      <LpPageScrollbar v-if="windowScrolls && pageScrollbar" top="var(--lp-shell-top)" bottom="var(--lp-shell-bottom)" />
      <LpBottomNav
        v-if="bottomNav"
        ref="bottomBarEl"
        :class="[burgerHidden[mobileBreakpoint], spanClass, windowScrolls && `${STICKY} bottom-0`]"
        :items="bottomItems"
        :is-active="activeTest"
        more
        :more-active="moreActive"
        :more-expanded="drawerOpen"
        @select="onBottom"
        @more="drawerOpen = true"
      />
    </div>

    <slot name="overlays" />
  </div>
</template>
