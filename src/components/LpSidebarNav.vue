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
import { Motion } from "motion-v"
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from "reka-ui"
import { computed } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import LpBadge from "./LpBadge.vue"
import LpContextMenu from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpScrollArea from "./LpScrollArea.vue"
import type { SidebarItem, SidebarSection } from "./sidebar"
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
  }>(),
  { skeletonRows: 6, skeletonHeader: true, collapsedKeys: () => [] },
)

const emit = defineEmits<{
  (e: "activate", item: SidebarItem): void
  (e: "toggle-section", key: string, collapsed: boolean): void
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
      .filter((g) => g.items.some((i) => props.itemActive(i)))
      .map(sectionKey),
  )
  return new Set(
    props.collapsedKeys.filter((k) => k && !holdsActive.has(k)),
  )
})

function isOpen(section: SidebarSection): boolean {
  return !foldedKeys.value.has(sectionKey(section))
}

const pillTransition = usePillTransition()

// The nav fills the remaining height with a fixed gap between groups; a short sidebar needs both under the consumer's control.
const { class: rootClass, attrs: rest } = useMergedAttrs(
  "flex min-h-0 flex-1 flex-col gap-4",
)
</script>

<template>
  <!-- Loading skeleton: an optional identity row + a run of item rows. -->
  <div v-if="loading"
    :class="rootClass"
    v-bind="rest">
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

  <!-- min-h-full keeps the content as tall as the viewport so the #actions
       block's mt-auto can still pin it to the bottom. -->
  <LpScrollArea v-else class="min-h-0 flex-1" content-class="flex min-h-full flex-col gap-4">
    <CollapsibleRoot
      v-for="(section, si) in groups"
      :key="si"
      as="div"
      class="flex flex-col gap-0.5"
      :open="isOpen(section)"
      :disabled="!section.collapsible || !section.title"
      @update:open="(o: boolean) => emit('toggle-section', sectionKey(section), !o)"
    >
      <!-- A plain heading while the group is fixed; a control once it folds,
           because a thing that reacts to a click must look like one. -->
      <CollapsibleTrigger
        v-if="section.title && section.collapsible"
        class="group/section mt-2 flex cursor-pointer items-center gap-2 rounded-control px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:bg-white/[0.04] hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
        v-else-if="section.title"
        class="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        {{ section.title }}
      </p>

      <CollapsibleContent
        class="flex flex-col gap-0.5 overflow-hidden data-[state=open]:animate-[collapsible-down_260ms_var(--ease-emphasized)] data-[state=closed]:animate-[collapsible-up_200ms_var(--ease-emphasized)] motion-reduce:animate-none"
      >
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
          class="group/item relative flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
            <span class="relative z-10 min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
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
      </CollapsibleContent>
    </CollapsibleRoot>
  </LpScrollArea>
</template>
