<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Inner body of LpSidebar: the section/item list plus the loading skeleton and
 * the sliding active pill. Split out so LpSidebar can render the exact same nav
 * in two shells — the static desktop rail and the swipeable mobile drawer —
 * without duplicating markup. Not exported on its own; an LpSidebar detail.
 */
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui"
import { computed, ref } from "vue"
import LpBadge from "./LpBadge.vue"
import LpContextMenu from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpSkeleton from "./LpSkeleton.vue"
import LpSidebarRow from "./LpSidebarRow.vue"
import { waiting, type SidebarItem, type SidebarSection } from "./sidebar"
import { useMergedAttrs } from "../composables/useMergedClass"

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
    /**
     * Keys of the groups currently folded away. The owner holds this so the
     * choice can outlive the component (a setting, a stored preference) — the
     * nav itself only reports the intent to change it.
     */
    collapsedKeys?: string[]
    /**
     * The active pill glides under the hovered item and springs back on leave,
     * as in LpTabs and LpTableOfContents. Off by default here, unlike those:
     * a sidebar is tall and the pointer crosses it on the way to the page
     * beside it, so a pill chasing every pass would flicker through a dozen
     * rows and hide the one thing a nav must keep in view, where you are. A
     * short rail (an app switcher, a settings list) can turn it on.
     */
    hoverFollow?: boolean
    /** Icons only, each row's name in a card beside it. */
    compact?: boolean
    /** Rows offer "Pin to top" in their menu; `pinned` are shown first. */
    pinnable?: boolean
    pinned?: SidebarItem[]
    previewDelay?: number
    labels: { pinned: string; pin: string; unpin: string; expand: string }
  }>(),
  { skeletonRows: 6, skeletonHeader: true, collapsedKeys: () => [], hoverFollow: false, pinned: () => [], previewDelay: 900 },
)

const emit = defineEmits<{
  (e: "activate", item: SidebarItem): void
  (e: "toggle-section", key: string, collapsed: boolean): void
  (e: "toggle-pin", id: string): void
}>()

/** `key` when the app set one, else the title — see SidebarSection.key. */
function sectionKey(section: SidebarSection): string {
  return section.key ?? section.title ?? ""
}

/*
 * A group folds only when the app both allows it and is not the group the
 * reader is standing in: folding away the page you are on hides your own
 * location, which is the one row a nav must always show.
 */
const foldedKeys = computed(() => {
  const holdsActive = new Set(
    props.groups
      .filter((g) => g.items.some((i) => props.itemActive(i) || onPath(i)))
      .map(sectionKey),
  )
  return new Set(
    props.collapsedKeys.filter((k) => k && !holdsActive.has(k)),
  )
})

function isOpen(section: SidebarSection): boolean {
  // Compact, a group has no heading to unfold it by.
  return props.compact || !foldedKeys.value.has(sectionKey(section))
}

const hovered = ref<string | null>(null)

function hover(item: SidebarItem) {
  if (props.hoverFollow && !item.disabled) hovered.value = item.id
}

/** The pill sits under the hovered item while following hover, else the active one. */
function pillUnder(item: SidebarItem): boolean {
  return hovered.value ? hovered.value === item.id : props.itemActive(item)
}

/** One of the item's pages is the current one. */
function onPath(item: SidebarItem): boolean {
  return !!item.children?.some((c) => props.itemActive(c))
}

// Pages under a row open with the current page among them and otherwise when
// asked; the asked-for ones are remembered for as long as the nav lives.
const opened = ref(new Set<string>())
function expanded(item: SidebarItem): boolean {
  return onPath(item) || opened.value.has(item.id)
}
function toggle(item: SidebarItem) {
  const next = new Set(opened.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  opened.value = next
}

const pinnedIds = computed(() => new Set(props.pinned.map((i) => i.id)))
function menuOf(item: SidebarItem) {
  const own = item.menu ?? []
  if (!props.pinnable) return own
  const pinned = pinnedIds.value.has(item.id)
  return [
    ...own,
    {
      label: pinned ? props.labels.unpin : props.labels.pin,
      icon: pinned ? "lucide:pin-off" : "lucide:pin",
      separatorBefore: own.length > 0,
      onSelect: () => emit("toggle-pin", item.id),
    },
  ]
}

/*
 * The keyboard, as a tree: arrows walk the rows that are showing, right and
 * left open and close a group or the pages under a row (left from such a page
 * goes back to its row), Home and End jump to the ends, and typing jumps to the
 * next row starting with what was typed. Tab still reaches every row, so this
 * only adds a faster way through a long nav.
 */
let typed = ""
let typedAt = 0

function onKey(event: KeyboardEvent) {
  const box = event.currentTarget as HTMLElement
  const list = [...box.querySelectorAll<HTMLElement>("[data-lp-nav-row]")].filter((r) => r.offsetParent !== null)
  const at = list.indexOf(document.activeElement as HTMLElement)
  if (at < 0) return
  const row = list[at]!
  const go = (i: number) => {
    event.preventDefault()
    list[(i + list.length) % list.length]?.focus()
  }
  switch (event.key) {
    case "ArrowDown":
      return go(at + 1)
    case "ArrowUp":
      return go(at - 1)
    case "Home":
      return go(0)
    case "End":
      return go(list.length - 1)
    case "ArrowRight":
    case "ArrowLeft": {
      const open = event.key === "ArrowRight"
      const toggle = row.hasAttribute("aria-expanded")
        ? row
        : row.parentElement?.querySelector<HTMLElement>(":scope > button[aria-expanded]")
      if (toggle && (toggle.getAttribute("aria-expanded") === "true") !== open) {
        event.preventDefault()
        toggle.click()
        return
      }
      if (!open && row.dataset.lpNavNested !== undefined) {
        for (let i = at - 1; i >= 0; i--) if (list[i]!.dataset.lpNavNested === undefined) return go(i)
      }
      return
    }
  }
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
  const now = Date.now()
  typed = now - typedAt > 700 ? event.key : typed + event.key
  typedAt = now
  const needle = typed.toLocaleLowerCase()
  for (let k = 1; k <= list.length; k++) {
    const next = list[(at + k) % list.length]!
    if ((next.textContent ?? "").trim().toLocaleLowerCase().startsWith(needle)) return go(at + k)
  }
}

const SECTION = "lp-section:"
function sectionItem(section: SidebarSection): SidebarItem {
  const icon = section.icon ?? section.items.find((i) => i.icon)?.icon
  return {
    id: `${SECTION}${sectionKey(section)}`,
    label: section.title ?? "",
    icon,
    children: section.items,
  }
}

function activate(item: SidebarItem) {
  if (item.id.startsWith(SECTION)) return
  if (item.children?.length && !item.to && !item.href) toggle(item)
  emit("activate", item)
}

// The nav fills the remaining height with a fixed gap between groups; a short sidebar needs both under the consumer's control.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex min-h-0 flex-1 flex-col gap-4",
)
</script>

<template>
  <!-- Loading skeleton: an optional identity row + a run of item rows, as an
       LpSkeleton wrapper so it pulses in phase with every other placeholder
       on the page and stops under reduced motion. -->
  <LpSkeleton v-if="loading"
    :class="rootClass"
    v-bind="rest">
    <div v-if="skeletonHeader" class="flex items-center gap-3 px-1">
      <div class="lp-skeleton-item size-10 shrink-0 rounded-pill bg-surface-soft" />
      <div class="flex-1 space-y-2">
        <div class="lp-skeleton-item h-3.5 w-24 rounded-small bg-surface-soft" />
        <div class="lp-skeleton-item h-3 w-16 rounded-small bg-surface-soft/60" />
      </div>
    </div>
    <div class="space-y-1">
      <div
        v-for="n in skeletonRows"
        :key="n"
        class="lp-skeleton-item h-9 rounded-control bg-surface-soft"
      />
    </div>
  </LpSkeleton>

  <!-- min-h-full keeps the content as tall as the viewport so the #actions
       block's mt-auto can still pin it to the bottom. -->
  <LpScrollArea
    v-else
    class="min-h-0 flex-1"
    :content-class="compact ? 'flex min-h-full flex-col gap-1' : 'flex min-h-full flex-col gap-4'"
    @pointerleave="hovered = null"
  >
    <!-- `contents`: no box of its own, only somewhere for the rows' keys to bubble to. -->
    <div class="contents" @keydown="onKey">
    <!-- Pinned pages come first and carry no pill: the same page further down
         already holds it, and one pill shared by two rows would jump between
         them. -->
    <div v-if="pinned.length" class="flex flex-col gap-0.5">
      <p v-if="!compact" class="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {{ labels.pinned }}
      </p>
      <LpSidebarRow
        v-for="item in pinned"
        :key="`pinned:${item.id}`"
        :item="item"
        :active="itemActive(item)"
        :pill="false"
        :pill-id="pillId"
        :compact="compact"
        :menu="menuOf(item)"
        :preview-delay="previewDelay"
        :item-active="itemActive"
        @activate="activate"
      />
    </div>
    <template v-for="(section, si) in groups" :key="si">
    <!-- Compact, a group that folds is one icon: its pages open in the card
         beside it, as a page's own pages do. A hundred initials in a column
         would be no nav at all. -->
    <div v-if="compact && section.collapsible && section.title" class="flex flex-col gap-0.5">
      <LpSidebarRow
        :item="sectionItem(section)"
        :active="false"
        :pill="false"
        :pill-id="pillId"
        compact
        group
        :on-path="section.items.some((i) => itemActive(i) || onPath(i))"
        :preview-delay="previewDelay"
        :item-active="itemActive"
        @activate="activate"
      />
    </div>
    <CollapsibleRoot
      v-else
      as="div"
      class="flex flex-col gap-0.5"
      :open="isOpen(section)"
      :disabled="!section.collapsible || !section.title"
      @update:open="(o: boolean) => emit('toggle-section', sectionKey(section), !o)"
    >
      <!-- A plain heading while the group is fixed; a control once it folds,
           because a thing that reacts to a click must look like one. -->
      <div v-if="compact && (si > 0 || pinned.length)" class="mx-3 mb-1 border-t border-line" />
      <CollapsibleTrigger
        v-else-if="!compact && section.title && section.collapsible"
        data-lp-nav-row
        class="group/section mt-2 flex cursor-pointer items-center gap-2 rounded-control px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:bg-ink/[0.04] hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <LpIcon
          v-if="section.icon"
          :name="section.icon"
          :size="14"
          class="shrink-0"
        />
        <span class="min-w-0 flex-1 truncate text-left">{{ section.title }}</span>
        <!-- The count stands in for the items while they are hidden, so a
             folded group still says how much is inside it.

             It is always rendered and merely fades, never removed: taking it
             out of the row changes the heading's height, and a heading that
             resizes under the cursor makes its own click feel like a misfire. -->
        <span
          v-if="section.items.some(waiting)"
          class="size-1.5 shrink-0 rounded-full bg-brand transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none"
          :class="isOpen(section) ? 'opacity-0' : 'opacity-100'"
        />
        <LpBadge
          tone="neutral"
          class="shrink-0 transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none"
          :class="isOpen(section) ? 'opacity-0' : 'opacity-100'"
          :aria-hidden="isOpen(section) || undefined"
        >
          {{ section.items.length }}
        </LpBadge>
        <LpIcon
          name="lucide:chevron-down"
          :size="14"
          class="shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] group-data-[state=closed]/section:-rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <p
        v-else-if="!compact && section.title"
        class="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        {{ section.title }}
      </p>

      <CollapsibleContent
        class="flex flex-col gap-0.5 overflow-hidden data-[state=open]:animate-[collapsible-down_260ms_var(--ease-emphasized)] data-[state=closed]:animate-[collapsible-up_200ms_var(--ease-emphasized)] motion-reduce:animate-none"
      >
      <template v-for="item in section.items" :key="item.id">
        <LpSidebarRow
          :item="item"
          :active="itemActive(item)"
          :pill="pillUnder(item)"
          :pill-id="pillId"
          :compact="compact"
          :menu="menuOf(item)"
          :expandable="!compact && !!item.children?.length"
          :expanded="expanded(item)"
          :on-path="onPath(item)"
          :preview-delay="previewDelay"
          :hovered="hovered === item.id"
          :expand-label="labels.expand"
          :item-active="itemActive"
          @activate="activate"
          @hover="hover"
          @toggle="toggle(item)"
        >
          <template v-if="$slots.item" #default="slotProps"><slot name="item" v-bind="slotProps" /></template>
        </LpSidebarRow>
        <CollapsibleRoot v-if="!compact && item.children?.length" :open="expanded(item)">
          <CollapsibleContent
            class="flex flex-col gap-0.5 overflow-hidden data-[state=open]:animate-[collapsible-down_220ms_var(--ease-emphasized)] data-[state=closed]:animate-[collapsible-up_180ms_var(--ease-emphasized)] motion-reduce:animate-none"
          >
            <LpSidebarRow
              v-for="child in item.children"
              :key="child.id"
              nested
              :item="child"
              :active="itemActive(child)"
              :pill="pillUnder(child)"
              :pill-id="pillId"
              :menu="menuOf(child)"
              :preview-delay="previewDelay"
              :hovered="hovered === child.id"
              :item-active="itemActive"
              @activate="activate"
              @hover="hover"
            />
          </CollapsibleContent>
        </CollapsibleRoot>
      </template>
      </CollapsibleContent>
    </CollapsibleRoot>
    </template>
    </div>
  </LpScrollArea>
</template>
