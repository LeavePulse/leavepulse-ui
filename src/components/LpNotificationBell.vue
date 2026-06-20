<script setup lang="ts">
/*
 * Notification bell: an icon button with an unread badge that opens a popover
 * feed on click, and a quick-action context menu on right-click. Presentational
 * and data-driven — the consumer fetches via the SDK and binds `items` /
 * `unread-count`, and reacts to `mark-read` / `mark-all-read` / `open`. Mirrors
 * the kit convention (cf. LpSidebar): data in, events out, no data fetching
 * inside the component.
 */
import { computed } from "vue"
import LpBadge from "./LpBadge.vue"
import LpButton from "./LpButton.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpIcon from "./LpIcon.vue"
import LpPopover from "./LpPopover.vue"
import LpScrollArea from "./LpScrollArea.vue"

export interface NotificationItem {
  id: string
  title: string
  body?: string
  /** Optional icon name (e.g. "lucide:check-circle"). */
  icon?: string
  /** Optional deep link; the row becomes clickable when set. */
  link?: string
  /** ISO-8601 creation time; rendered as a relative label. */
  createdAt?: string
  /** Whether the notification has been read. */
  read?: boolean
}

const props = withDefaults(
  defineProps<{
    items?: NotificationItem[]
    /** Unread count for the badge; falls back to counting unread items. */
    unreadCount?: number
    loading?: boolean
    emptyLabel?: string
    title?: string
    /** Cap the badge display (e.g. "9+"). */
    maxBadge?: number
    /** Right-click menu items; overrides the built-in quick actions. */
    menuItems?: ContextMenuItemDef[]
  }>(),
  { items: () => [], maxBadge: 9 },
)

// Popover open state. A defineModel (not a plain `open` prop) gives a local
// fallback, so the bell still opens when the consumer only listens to
// @update:open without binding :open — otherwise the popover is stuck in
// controlled-but-uncontrolled limbo and never opens.
const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  (e: "markRead", id: string): void
  (e: "markUnread", id: string): void
  (e: "markAllRead"): void
  (e: "dismiss", id: string): void
  (e: "select", item: NotificationItem): void
}>()

const unread = computed(() =>
  props.unreadCount ?? props.items.filter((n) => !n.read).length,
)
const badgeLabel = computed(() =>
  unread.value > props.maxBadge ? `${props.maxBadge}+` : String(unread.value),
)
const hasUnread = computed(() => unread.value > 0)

// Right-click quick actions. Because `open` is a defineModel we open the feed
// ourselves on left-click (the popover is anchor-only), which frees the trigger
// button to also host LpContextMenu for the right-click menu — the two no
// longer fight over the popover's click trigger.
const contextMenu = computed<ContextMenuItemDef[]>(() =>
  props.menuItems ?? [
    {
      label: "Open notifications",
      icon: "lucide:bell",
      onSelect: () => {
        open.value = true
      },
    },
    {
      label: "Mark all read",
      icon: "lucide:check-check",
      disabled: !hasUnread.value,
      onSelect: () => emit("markAllRead"),
    },
  ],
)

function onSelect(item: NotificationItem) {
  if (!item.read) emit("markRead", item.id)
  emit("select", item)
}

// Per-row right-click actions: toggle read state, open a deep link, dismiss.
// Producers wire the matching @mark-read / @mark-unread / @dismiss handlers; an
// action only appears when it makes sense for that row.
function rowMenu(item: NotificationItem): ContextMenuItemDef[] {
  const actions: ContextMenuItemDef[] = []
  if (item.read) {
    actions.push({
      label: "Mark as unread",
      icon: "lucide:dot",
      onSelect: () => emit("markUnread", item.id),
    })
  } else {
    actions.push({
      label: "Mark as read",
      icon: "lucide:check",
      onSelect: () => emit("markRead", item.id),
    })
  }
  if (item.link) {
    actions.push({
      label: "Open",
      icon: "lucide:external-link",
      onSelect: () => emit("select", item),
    })
  }
  actions.push({
    label: "Dismiss",
    icon: "lucide:x",
    danger: true,
    separatorBefore: true,
    onSelect: () => emit("dismiss", item.id),
  })
  return actions
}

// Compact relative time ("just now", "5m", "3h", "2d"); falls back to a date.
function timeAgo(iso?: string): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 45) return "just now"
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(then).toLocaleDateString()
}
</script>

<template>
  <LpPopover
    v-model:open="open"
    side="bottom"
    align="end"
    :side-offset="8"
    panel-class="w-80 p-0"
  >
    <!-- `open` is controlled via defineModel, so the popover trigger is just an
         anchor: we toggle open on click ourselves. That frees the button to
         also be wrapped in LpContextMenu for the right-click quick-actions menu
         (left-click → feed, right-click → menu) without two triggers clashing. -->
    <template #trigger>
      <LpContextMenu :items="contextMenu">
        <LpButton
          variant="ghost"
          size="sm"
          class="relative"
          aria-label="Notifications"
          @click="open = !open"
        >
          <LpIcon name="lucide:bell" :size="18" />
          <LpBadge
            v-if="hasUnread"
            tone="danger"
            class="absolute -right-1 -top-1 min-w-4 justify-center px-1 py-0 text-[10px] leading-4"
          >
            {{ badgeLabel }}
          </LpBadge>
        </LpButton>
      </LpContextMenu>
    </template>

    <header class="flex items-center justify-between gap-2 px-3 py-2.5">
      <span class="text-sm font-semibold">{{ title ?? "Notifications" }}</span>
      <button
        v-if="hasUnread"
        type="button"
        class="rounded-md px-1.5 py-0.5 text-xs font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft"
        @click="emit('markAllRead')"
      >
        Mark all read
      </button>
    </header>

    <div v-if="loading" class="space-y-1.5 px-2 pb-2">
      <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-control bg-surface-soft" />
    </div>

    <LpEmptyState
      v-else-if="!items.length"
      icon="lucide:bell-off"
      :title="emptyLabel ?? 'No notifications'"
      class="px-3 py-10"
    />

    <!-- The feed sits in a thin gutter; rows are self-contained tiles (rounded,
         hover-lit) instead of full-width strips with hard dividers — lighter and
         easier to scan. Each row carries its own right-click action menu. -->
    <LpScrollArea v-else class="max-h-96" content-class="flex flex-col gap-0.5 px-2 pb-2">
      <LpContextMenu v-for="item in items" :key="item.id" :items="rowMenu(item)">
        <component
          :is="item.link ? 'a' : 'button'"
          :href="item.link || undefined"
          :type="item.link ? undefined : 'button'"
          class="group/notif flex w-full items-start gap-2.5 rounded-control px-2 py-2 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05]"
          :class="item.read ? '' : 'bg-brand-soft/35'"
          @click="onSelect(item)"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-control"
            :class="item.read ? 'bg-surface-soft text-muted' : 'bg-brand-soft text-brand'"
          >
            <LpIcon :name="item.icon || 'lucide:bell'" :size="15" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1.5">
              <span class="truncate text-sm font-medium" :class="item.read ? 'text-muted-strong' : 'text-ink'">
                {{ item.title }}
              </span>
              <span v-if="!item.read" class="size-1.5 shrink-0 rounded-full bg-brand" />
            </span>
            <span v-if="item.body" class="mt-0.5 line-clamp-2 block text-xs text-muted">
              {{ item.body }}
            </span>
            <span v-if="item.createdAt" class="mt-0.5 block text-[11px] text-muted/70">
              {{ timeAgo(item.createdAt) }}
            </span>
          </span>
        </component>
      </LpContextMenu>
    </LpScrollArea>
  </LpPopover>
</template>
