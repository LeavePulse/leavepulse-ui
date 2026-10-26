<script setup lang="ts">
/*
 * One row of LpSidebarNav: the link or button, its active pill, icon, label,
 * count and keys, its right-click menu and the card beside it. A page, a page
 * under another and a pinned page are drawn by this one component, so the
 * three never disagree on what a row looks like. Not exported on its own.
 *
 * The card beside the row does two jobs that are one mechanism: in a compact
 * sidebar it is the row's name (and the pages under it), since the row shows
 * only an icon; with a `preview` it is a glance at the page before going there.
 */
import { Motion } from "motion-v"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useLocale } from "../composables/useLocale"
import { usePillTransition } from "../composables/usePillTransition"
import { useLinkComponent } from "../composables/useLpConfig"
import LpBadge from "./LpBadge.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpHoverCard from "./LpHoverCard.vue"
import LpIcon from "./LpIcon.vue"
import LpKeys from "./LpKeys.vue"
import LpNumberFlow from "./LpNumberFlow.vue"
import type { SidebarItem } from "./sidebar"
import { resolveLink, type ResolvedLink } from "./link"

const props = withDefaults(
  defineProps<{
    item: SidebarItem
    active: boolean
    /** The pill sits under this row (active, or hovered while following hover). */
    pill: boolean
    pillId: string
    compact?: boolean
    /** A page under another: indented, a size smaller. */
    nested?: boolean
    menu?: ContextMenuItemDef[]
    /** Has pages under it; `expanded` says whether they show. */
    expandable?: boolean
    expanded?: boolean
    /** One of its pages is the current one: the row reads as on the path. */
    onPath?: boolean
    previewDelay?: number
    hovered?: boolean
    expandLabel?: string
    itemActive?: (item: SidebarItem) => boolean
  }>(),
  { previewDelay: 900, menu: () => [] },
)

const emit = defineEmits<{
  (e: "activate", item: SidebarItem): void
  (e: "hover", item: SidebarItem): void
  (e: "toggle"): void
}>()

const locale = useLocale()
const pillTransition = usePillTransition()
const linkComponent = useLinkComponent()

/*
 * A disabled item is always a disabled button: an anchor cannot be disabled,
 * and the old enabled-button fallback for a disabled link stayed focusable.
 */
function rowOf(item: SidebarItem): ResolvedLink {
  const link = item.disabled ? null : resolveLink(linkComponent.value, { to: item.to, href: item.href })
  if (link) return link
  return { is: "button", props: { type: "button", disabled: item.disabled || undefined } }
}

// A count that grows pulses once: a number that changes in place is easy to
// miss in the corner of the eye, and the nav is exactly the corner of the eye.
const bumped = ref(false)
let bumpTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => props.item.badge,
  (now, was) => {
    if (typeof now !== "number" || typeof was !== "number" || now <= was) return
    bumped.value = true
    clearTimeout(bumpTimer)
    bumpTimer = setTimeout(() => (bumped.value = false), 1200)
  },
)
onBeforeUnmount(() => clearTimeout(bumpTimer))

/** A compact row without an icon shows the first letters of its name. */
const initials = computed(() =>
  props.item.label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0])
    .join(""),
)

const hasBadge = computed(() => props.item.badge != null || props.item.dot)
const card = computed(() => !props.item.disabled && (props.compact || !!props.item.preview))
const delay = computed(() => (props.compact && !props.item.preview ? 250 : props.previewDelay))
</script>

<template>
  <LpHoverCard
      :disabled="!card"
      side="right"
      align="start"
      :side-offset="compact ? 12 : 16"
      :open-delay="delay"
      :close-delay="120"
      touch="none"
      :panel-class="item.preview ? 'w-80 p-0 overflow-hidden' : 'w-56 p-2'"
    >
      <!-- The card anchors on a plain box: the context menu inside it renders a
           fragment, which an as-child trigger cannot take. -->
      <template #trigger>
        <div class="relative flex flex-col">
        <LpContextMenu :items="menu" :title="(item.menuTitle ?? item.label) || undefined" :title-icon="item.icon">
        <component
          :is="rowOf(item).is"
          v-bind="rowOf(item).props"
          :aria-current="active ? 'page' : undefined"
          :aria-disabled="item.disabled || undefined"
          :aria-label="compact ? item.label : undefined"
          data-lp-nav-row
          :aria-keyshortcuts="item.hotkey"
          :aria-busy="item.busy ? true : undefined"
          :data-lp-nav-nested="nested || undefined"
          class="group/item relative flex items-center rounded-control font-medium outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          :class="[
            compact ? ['mx-auto size-10 justify-center', onPath && !active ? 'bg-ink/[0.06]' : ''] : nested ? 'gap-2.5 py-1.5 pl-9 pr-3 text-[13px]' : 'gap-3 px-3 py-2 text-sm',
            item.disabled
              ? 'cursor-not-allowed text-muted/50'
              : active || hovered || onPath
                ? 'text-ink'
                : 'text-muted hover:text-ink',
          ]"
          @click="emit('activate', item)"
          @pointerenter="emit('hover', item)"
        >
          <span
            v-if="item.busy !== undefined && item.busy !== false"
            class="pointer-events-none absolute bottom-0.5 z-10 h-0.5 overflow-hidden rounded-pill bg-brand/15"
            :class="compact ? 'inset-x-2' : 'inset-x-3'"
          >
            <span
              v-if="typeof item.busy === 'number'"
              class="block h-full rounded-pill bg-brand transition-[width] duration-(--duration-medium) ease-[var(--ease-emphasized)]"
              :style="{ width: `${Math.round(Math.min(1, Math.max(0, item.busy)) * 100)}%` }"
            />
            <span v-else class="lp-sweep absolute inset-y-0 left-0 w-2/5 rounded-pill bg-brand" />
          </span>
          <Motion v-if="pill" :layout-id="pillId" :transition="pillTransition" class="absolute inset-0 z-0 rounded-control bg-brand-soft" />
          <slot :item="item" :active="active">
            <span v-if="item.icon" class="relative z-10 shrink-0">
              <LpIcon :name="item.icon" :size="nested ? 15 : 17" class="transition-colors" :class="active ? 'text-brand' : ''" />
              <!-- Compact, the count has no room: a dot on the icon says there is one. -->
              <span
                v-if="compact && hasBadge"
                class="absolute -right-1 -top-1 size-2 rounded-full bg-brand ring-2 ring-surface-raised"
                :class="bumped ? 'animate-pulse' : ''"
              />
            </span>
            <span v-else-if="compact" class="relative z-10 text-xs font-semibold uppercase">{{ initials }}</span>
            <span v-else-if="nested" class="relative z-10 size-1 shrink-0 rounded-full bg-current opacity-50" />
            <template v-if="!compact">
              <span class="relative z-10 min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
              <!-- Over the row's end and only where nothing else sits there: in
                   the flow, keys that show on hover would take the label's
                   width even while hidden. -->
              <LpKeys
                v-if="item.hotkey && !hasBadge && !expandable"
                :combo="item.hotkey"
                size="sm"
                aria-hidden="true"
                class="pointer-events-none absolute right-2 z-10 rounded-small bg-surface-raised/90 opacity-0 transition-opacity duration-(--duration-fast) group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
              />
              <span v-if="item.dot && item.badge == null" class="relative z-10 size-2 shrink-0 rounded-full bg-brand" />
              <LpBadge v-if="item.badge != null" :tone="active ? 'brand' : 'neutral'" class="relative z-10 shrink-0">
                <span v-if="bumped" class="absolute inset-0 animate-ping rounded-pill bg-brand/30" />
                <LpNumberFlow v-if="typeof item.badge === 'number'" :value="item.badge" grouped :locale="locale" />
                <template v-else>{{ item.badge }}</template>
              </LpBadge>
              <span v-if="expandable" class="w-5 shrink-0" aria-hidden="true" />
            </template>
          </slot>
        </component>
        </LpContextMenu>
        <!-- Beside the row, not inside it: a control within the link or button
             would be one control to a screen reader, and the pages under a
             link have to open without following it. -->
        <button
          v-if="expandable && !compact"
          type="button"
          class="absolute right-2 top-1/2 z-20 grid size-6 -translate-y-1/2 place-items-center rounded-small text-muted outline-none transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
          :aria-label="expandLabel"
          :aria-expanded="expanded"
          @click="emit('toggle')"
        >
          <LpIcon
            name="lucide:chevron-right"
            :size="14"
            class="transition-transform duration-(--duration-fast) ease-[var(--ease-emphasized)] motion-reduce:transition-none"
            :class="expanded ? 'rotate-90' : ''"
          />
        </button>
        </div>
      </template>

      <div v-if="item.preview" class="flex flex-col">
        <div v-if="compact" class="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-medium text-ink">
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <LpKeys v-if="item.hotkey" :combo="item.hotkey" size="sm" />
        </div>
        <component :is="item.preview" />
      </div>
      <div v-else class="flex flex-col gap-0.5">
        <div class="flex items-center gap-2 px-2 py-1 text-sm font-medium text-ink">
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <LpBadge v-if="item.badge != null" tone="neutral">{{ typeof item.badge === "number" ? item.badge.toLocaleString(locale) : item.badge }}</LpBadge>
          <LpKeys v-if="item.hotkey" :combo="item.hotkey" size="sm" />
        </div>
        <div v-if="item.children?.length" class="flex max-h-[min(70vh,30rem)] flex-col gap-0.5 overflow-y-auto">
          <component
            :is="rowOf(child).is"
            v-for="child in item.children"
            :key="child.id"
            v-bind="rowOf(child).props"
            :aria-current="itemActive?.(child) ? 'page' : undefined"
            class="flex shrink-0 items-center gap-2 rounded-control px-2 py-1.5 text-left text-[13px] outline-none transition-colors hover:bg-ink/[0.05] focus-visible:ring-2 focus-visible:ring-ring"
            :class="child.disabled ? 'opacity-50' : itemActive?.(child) ? 'text-brand' : 'text-muted hover:text-ink'"
            @click="emit('activate', child)"
          >
            <LpIcon v-if="child.icon" :name="child.icon" :size="15" class="shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ child.label }}</span>
            <LpBadge v-if="child.badge != null" tone="neutral">{{ child.badge }}</LpBadge>
          </component>
        </div>
      </div>
    </LpHoverCard>
</template>
