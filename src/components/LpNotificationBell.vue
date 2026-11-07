<script setup lang="ts">
/*
 * Notification bell: an icon button with an unread badge that opens the
 * notification feed (LpNotificationFeed) in a popover on left-click and a
 * quick-action menu on right-click. Data in, events out, no fetching inside:
 * the consumer binds `items` / `unread-count` / `v-model:open` and reacts to
 * the feed's events, which the bell passes on.
 *
 * Everything the feed takes, the bell takes too: rows with their own buttons
 * (`item.actions`), senders (`item.actor`), tabs (`categories`, `v-model:filter`),
 * Load more, a link to the whole feed, a settings button.
 */
import { computed, getCurrentInstance } from "vue"
import { useLabels } from "../composables/useLpConfig"
import LpBadge from "./LpBadge.vue"
import LpButton from "./LpButton.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpNotificationFeed from "./LpNotificationFeed.vue"
import LpPopover from "./LpPopover.vue"
import LpRollingText from "./LpRollingText.vue"
import {
  NOTIFICATION_LABELS,
  type NotificationAction,
  type NotificationCategory,
  type NotificationItem,
  type NotificationLabels,
  type NotificationMenu,
} from "./notifications"

export type {
  NotificationAction,
  NotificationActor,
  NotificationCategory,
  NotificationItem,
  NotificationLabels,
  NotificationMenu,
} from "./notifications"

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
    /** Right-click menu on the bell; overrides the built-in quick actions. */
    menuItems?: ContextMenuItemDef[]
    /** Extra right-click entries for a feed row. */
    itemMenu?: NotificationMenu
    /** Tabs after All and Unread, matched against `item.category`. */
    categories?: NotificationCategory[]
    /** Head runs of rows with Today / Yesterday / Earlier. Default true. */
    groupByDay?: boolean
    /** More is waiting: the feed offers Load more (`@load-more`). */
    hasMore?: boolean
    loadingMore?: boolean
    /** The feed's footer link to the whole list ("View all notifications"). */
    allLink?: string
    /** Translations for the strings the bell and its feed render themselves. */
    labels?: NotificationLabels
    /** Formats `item.createdAt`; defaults to a narrow relative time in the app's locale. */
    formatTime?: (iso: string) => string
  }>(),
  { items: () => [], maxBadge: 9, groupByDay: true },
)

// A defineModel (not a plain prop) gives a local fallback, so the bell still
// opens when the consumer only listens to @update:open without binding :open.
const open = defineModel<boolean>("open", { default: false })
const filter = defineModel<string>("filter", { default: "all" })

const emit = defineEmits<{
  (e: "markRead", id: string): void
  (e: "markUnread", id: string): void
  (e: "markAllRead"): void
  /** Empty the whole feed. Only offered when this is bound. */
  (e: "clear"): void
  (e: "dismiss", id: string): void
  (e: "select", item: NotificationItem): void
  (e: "action", item: NotificationItem, action: NotificationAction): void
  /** The feed's gear. Only drawn when this is bound. */
  (e: "settings"): void
  (e: "loadMore"): void
}>()

const text = useLabels("notifications", NOTIFICATION_LABELS, () => props.labels as Partial<typeof NOTIFICATION_LABELS>)
const l = computed(() => {
  const title = props.title ?? text.value.title
  return { ...text.value, title, ariaLabel: text.value.ariaLabel || title }
})

const unread = computed(() => props.unreadCount ?? props.items.filter((n) => !n.read).length)
const hasUnread = computed(() => unread.value > 0)
const badgeLabel = computed(() => (unread.value > props.maxBadge ? `${props.maxBadge}+` : String(unread.value)))

// The badge is drawn, not read: its count goes into the button's own name.
const buttonLabel = computed(() =>
  hasUnread.value ? `${l.value.ariaLabel}, ${l.value.unread.replace("{count}", String(unread.value))}` : l.value.ariaLabel,
)

/*
 * The optional events the consumer handles. NOT `useAttrs()`: a listener for a
 * DECLARED emit is removed from `$attrs`, so it is read off the raw vnode
 * props. Only those are passed on, so the feed draws no button nobody answers.
 */
const instance = getCurrentInstance()
const handlesClear = computed(() => Boolean(instance?.vnode.props?.onClear))
const optional = computed(() => ({
  ...(handlesClear.value ? { clear: () => emit("clear") } : {}),
  ...(instance?.vnode.props?.onSettings
    ? {
        settings: () => {
          open.value = false
          emit("settings")
        },
      }
    : {}),
}))

// Right-click quick actions on the bell. "Open" is left out: a left-click
// already opens the feed. The popover's trigger and the context menu's both
// pass their handlers down to the one button (they forward attributes), so
// the button toggles nothing itself: a click of its own toggled twice.
const contextMenu = computed<ContextMenuItemDef[]>(() => {
  if (props.menuItems) return props.menuItems
  const items: ContextMenuItemDef[] = [
    { label: l.value.markAllRead, icon: "lucide:check-check", disabled: !hasUnread.value, onSelect: () => emit("markAllRead") },
  ]
  if (handlesClear.value) {
    items.push({ label: l.value.clear, icon: "lucide:trash-2", disabled: !props.items.length, onSelect: () => emit("clear") })
  }
  return items
})

// Picking an item goes somewhere (a page, a dialog), so the feed steps out of
// the way: left open it would cover what the item just opened.
function onSelect(item: NotificationItem) {
  open.value = false
  emit("select", item)
}
</script>

<template>
  <LpPopover
    v-model:open="open"
    side="bottom"
    align="end"
    :side-offset="8"
    panel-class="w-[min(24rem,calc(100vw-1rem))] p-0"
  >
    <template #trigger>
      <LpContextMenu :items="contextMenu">
        <LpButton
          variant="ghost"
          size="sm"
          class="relative"
          :aria-label="buttonLabel"
        >
          <LpIcon name="lucide:bell" :size="18" />
          <!-- The badge pops in and out, and its count rolls rather than
               swapping, so new mail reads as arriving. -->
          <Transition
            enter-active-class="animate-[chip-in_var(--duration-fast)_var(--ease-emphasized)] motion-reduce:animate-none"
            leave-active-class="animate-[chip-out_var(--duration-fast)_ease] motion-reduce:animate-none"
          >
            <LpBadge
              v-if="hasUnread"
              aria-hidden="true"
              tone="danger"
              class="absolute -right-1 -top-1 min-w-4 justify-center px-1 py-0 text-[10px] leading-4"
            >
              <LpRollingText :value="badgeLabel" :duration="220" />
            </LpBadge>
          </Transition>
        </LpButton>
      </LpContextMenu>
    </template>

    <LpNotificationFeed
      v-model:filter="filter"
      :items="items"
      :unread-count="unreadCount"
      :loading="loading"
      :title="title"
      :empty-label="emptyLabel"
      :categories="categories"
      :group-by-day="groupByDay"
      :has-more="hasMore"
      :loading-more="loadingMore"
      :all-link="allLink"
      :item-menu="itemMenu"
      :labels="labels"
      :format-time="formatTime"
      v-on="optional"
      @mark-read="emit('markRead', $event)"
      @mark-unread="emit('markUnread', $event)"
      @mark-all-read="emit('markAllRead')"
      @dismiss="emit('dismiss', $event)"
      @select="onSelect"
      @action="(item, action) => emit('action', item, action)"
      @load-more="emit('loadMore')"
    />
  </LpPopover>
</template>
