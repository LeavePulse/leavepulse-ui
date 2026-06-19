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
    /** Popover open state (v-model:open). */
    open?: boolean
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

const emit = defineEmits<{
  (e: "update:open", open: boolean): void
  (e: "markRead", id: string): void
  (e: "markAllRead"): void
  (e: "select", item: NotificationItem): void
}>()

const unread = computed(() =>
  props.unreadCount ?? props.items.filter((n) => !n.read).length,
)
const badgeLabel = computed(() =>
  unread.value > props.maxBadge ? `${props.maxBadge}+` : String(unread.value),
)
const hasUnread = computed(() => unread.value > 0)

// Forward open changes (v-model:open) so the consumer can lazy-load the feed
// when the popover opens. When `open` is left unbound LpPopover stays
// uncontrolled and reka manages it on trigger click.
function onOpenChange(open: boolean | undefined) {
  emit("update:open", !!open)
}

// Right-click quick actions on the bell. Defaults to "open feed" + "mark all
// read"; a consumer can replace the whole list via `menuItems`.
const contextMenu = computed<ContextMenuItemDef[]>(() =>
  props.menuItems ?? [
    {
      label: "Open notifications",
      icon: "lucide:bell",
      onSelect: () => emit("update:open", true),
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
    side="bottom"
    align="end"
    :side-offset="8"
    panel-class="w-80 p-0"
    :open="open"
    @update:open="onOpenChange"
  >
    <template #trigger>
      <slot name="trigger" :unread="unread">
        <LpContextMenu :items="contextMenu">
          <LpButton variant="ghost" size="sm" class="relative" aria-label="Notifications">
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
      </slot>
    </template>

    <header class="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
      <span class="font-semibold">{{ title ?? "Notifications" }}</span>
      <button
        v-if="hasUnread"
        type="button"
        class="text-xs font-medium text-brand outline-none hover:underline focus-visible:underline"
        @click="emit('markAllRead')"
      >
        Mark all read
      </button>
    </header>

    <div v-if="loading" class="space-y-2 p-3">
      <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-control bg-surface-soft" />
    </div>

    <LpEmptyState
      v-else-if="!items.length"
      icon="lucide:bell-off"
      :title="emptyLabel ?? 'No notifications'"
      class="px-3 py-8"
    />

    <LpScrollArea v-else class="max-h-96" content-class="flex flex-col">
      <component
        :is="item.link ? 'a' : 'button'"
        v-for="item in items"
        :key="item.id"
        :href="item.link || undefined"
        :type="item.link ? undefined : 'button'"
        class="group/notif flex items-start gap-3 border-b border-line px-3 py-2.5 text-left outline-none transition-colors last:border-b-0 hover:bg-white/[0.04] focus-visible:bg-white/[0.04]"
        :class="item.read ? '' : 'bg-brand-soft/40'"
        @click="onSelect(item)"
      >
        <span
          class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control"
          :class="item.read ? 'bg-surface-soft text-muted' : 'bg-brand-soft text-brand'"
        >
          <LpIcon :name="item.icon || 'lucide:bell'" :size="16" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="truncate font-medium" :class="item.read ? 'text-muted-strong' : 'text-ink'">
              {{ item.title }}
            </span>
            <span v-if="!item.read" class="size-1.5 shrink-0 rounded-full bg-brand" />
          </span>
          <span v-if="item.body" class="mt-0.5 line-clamp-2 block text-xs text-muted">
            {{ item.body }}
          </span>
          <span v-if="item.createdAt" class="mt-1 block text-[11px] text-muted/80">
            {{ timeAgo(item.createdAt) }}
          </span>
        </span>
      </component>
    </LpScrollArea>
  </LpPopover>
</template>
