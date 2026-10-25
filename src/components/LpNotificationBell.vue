<script setup lang="ts">
/*
 * Notification bell: an icon button with an unread badge that opens a popover
 * feed on left-click and a quick-action menu on right-click. Each feed row has
 * its own right-click menu too. Presentational and data-driven — the consumer
 * fetches via the SDK, binds `items` / `unread-count` / `v-model:open`, and
 * reacts to `mark-read` / `mark-unread` / `mark-all-read` / `dismiss` /
 * `select`. Mirrors the kit convention (cf. LpSidebar): data in, events out,
 * no data fetching inside.
 */
import { computed, getCurrentInstance } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useNow } from "../composables/useNow"
import LpBadge from "./LpBadge.vue"
import LpButton from "./LpButton.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpIcon from "./LpIcon.vue"
import LpPopover from "./LpPopover.vue"
import LpRelativeTime from "./LpRelativeTime.vue"
import LpRollingText from "./LpRollingText.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpSkeleton from "./LpSkeleton.vue"
import LpShift from "./LpShift.vue"
import { toneLook, type ToneName } from "./tone"

export interface NotificationItem {
  id: string
  title: string
  body?: string
  /** Optional icon name (e.g. "lucide:check-circle"). */
  icon?: string
  /**
   * Colours the row's icon by what KIND of notification it is — a billing
   * notice and a security one should not look alike at a glance.
   *
   * A named tone rather than a class, so the categories stay themeable:
   * consumers were mapping their own types onto raw palette classes, which is
   * the one place a theme cannot follow them.
   */
  tone?: ToneName
  /** Optional deep link; the row becomes clickable when set. */
  link?: string
  /** ISO-8601 creation time; rendered as a relative label. */
  createdAt?: string
  /** Whether the notification has been read. */
  read?: boolean
}

/**
 * Every user-facing string the bell renders on its own. Apps with i18n pass
 * their translations in; the English defaults keep the component usable bare.
 * Without this the header/row menus would be hardcoded English in every locale.
 */
export interface NotificationLabels {
  title?: string
  markAllRead?: string
  clear?: string
  markAsRead?: string
  markAsUnread?: string
  open?: string
  dismiss?: string
  empty?: string
  ariaLabel?: string
  /** Appended to the button's name while there is unread news; `{count}` is filled in. */
  unread?: string
  /** Screen-reader marker on an unread row. */
  unreadItem?: string
  /**
   * No longer read: times are worded by Intl in the app's locale. Still
   * accepted so existing label objects keep type-checking.
   * @deprecated
   */
  justNow?: string
  /** @deprecated See `justNow`. */
  minutes?: string
  /** @deprecated See `justNow`. */
  hours?: string
  /** @deprecated See `justNow`. */
  days?: string
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
    /** Translations for the strings the bell renders itself. */
    labels?: NotificationLabels
    /**
     * Formats `item.createdAt` for display. Defaults to a narrow relative time
     * in the app's locale ("now", "5m ago", "3h ago"); pass your own to word
     * it differently.
     */
    formatTime?: (iso: string) => string
  }>(),
  { items: () => [], maxBadge: 9 },
)

// Single lookup for every label, so the template never repeats the fallbacks.
// `title` stays a top-level prop for compatibility and wins over labels.title.
const text = useLabels(
  "notifications",
  {
    title: "Notifications",
    markAllRead: "Mark all read",
    clear: "Clear",
    markAsRead: "Mark as read",
    markAsUnread: "Mark as unread",
    open: "Open",
    dismiss: "Dismiss",
    empty: "No notifications",
    ariaLabel: "",
    unread: "{count} unread",
    unreadItem: "Unread",
  },
  () => props.labels,
)
const l = computed(() => ({
  ...text.value,
  title: props.title ?? text.value.title,
  empty: props.emptyLabel ?? text.value.empty,
  ariaLabel: text.value.ariaLabel || text.value.title,
}))

// Popover open state. A defineModel (not a plain `open` prop) gives a local
// fallback, so the bell still opens when the consumer only listens to
// @update:open without binding :open — otherwise the popover is stuck in
// controlled-but-uncontrolled limbo and never opens.
const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  (e: "markRead", id: string): void
  (e: "markUnread", id: string): void
  (e: "markAllRead"): void
  /** Empty the whole feed. The header button only appears when this is bound. */
  (e: "clear"): void
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

// The badge is drawn, not read: its count goes into the button's own name.
const buttonLabel = computed(() =>
  hasUnread.value ? `${l.value.ariaLabel}, ${l.value.unread.replace("{count}", String(unread.value))}` : l.value.ariaLabel,
)


/*
 * Which optional actions the consumer actually handles. A button for an event
 * nobody listens to is a button that does nothing when pressed.
 *
 * NOT `useAttrs()`: a listener for a DECLARED emit is removed from `$attrs`, so
 * an `@clear` handler never appears there. The raw vnode props are where it
 * survives.
 */
const instance = getCurrentInstance()
const handlesClear = computed(() => Boolean(instance?.vnode.props?.onClear))

// Right-click quick actions on the bell. "Open" is intentionally omitted — a
// left-click already opens the feed, so the menu only carries actions you
// can't get from the click itself. Because `open` is a defineModel we open on
// left-click ourselves (the popover is anchor-only), which frees the trigger
// button to also host LpContextMenu without the two fighting over the trigger.
const contextMenu = computed<ContextMenuItemDef[]>(() => {
  if (props.menuItems) return props.menuItems
  const items: ContextMenuItemDef[] = [
    {
      label: l.value.markAllRead,
      icon: "lucide:check-check",
      disabled: !hasUnread.value,
      onSelect: () => emit("markAllRead"),
    },
  ]
  // Same rule as the header button: offered only when the caller can act on it.
  if (handlesClear.value) {
    items.push({
      label: l.value.clear,
      icon: "lucide:trash-2",
      disabled: !props.items.length,
      onSelect: () => emit("clear"),
    })
  }
  return items
})

// Picking an item goes somewhere (a page, a dialog, a tour step), so the feed
// steps out of the way: left open it would cover what the item just opened.
function onSelect(item: NotificationItem) {
  if (!item.read) emit("markRead", item.id)
  open.value = false
  emit("select", item)
}

// Per-row right-click actions: toggle read state, open a deep link, dismiss.
// Producers wire the matching @mark-read / @mark-unread / @dismiss handlers; an
// action only appears when it makes sense for that row.
function rowMenu(item: NotificationItem): ContextMenuItemDef[] {
  const actions: ContextMenuItemDef[] = []
  if (item.read) {
    actions.push({
      label: l.value.markAsUnread,
      icon: "lucide:dot",
      onSelect: () => emit("markUnread", item.id),
    })
  } else {
    actions.push({
      label: l.value.markAsRead,
      icon: "lucide:check",
      onSelect: () => emit("markRead", item.id),
    })
  }
  if (item.link) {
    actions.push({
      label: l.value.open,
      icon: "lucide:external-link",
      onSelect: () => onSelect(item),
    })
  }
  actions.push({
    label: l.value.dismiss,
    icon: "lucide:x",
    danger: true,
    separatorBefore: true,
    onSelect: () => emit("dismiss", item.id),
  })
  return actions
}

// A `formatTime` prop takes over the row's time entirely; it is re-asked twice
// a minute so its "5m" keeps moving. Without one, the row renders
// LpRelativeTime, which words the time through Intl in the app's locale and
// wakes only when its own text would change.
const customNow = useNow(() => !!props.formatTime, { nextIn: () => 30_000 })
function customTime(iso: string): string {
  void customNow.value
  return props.formatTime ? props.formatTime(iso) : ""
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
          :aria-label="buttonLabel"
          @click="open = !open"
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

    <header class="flex items-center justify-between gap-2 px-3 py-2.5">
      <span class="text-sm font-semibold">{{ l.title }}</span>
      <span class="flex items-center gap-0.5">
        <!-- Emptying the feed is a different act from reading it, and it is
             destructive, so it is muted and sits away from the primary action.
             Only offered when a listener is bound: a caller with no way to
             clear its feed must not be given a button that does nothing. -->
        <button
          v-if="items.length && handlesClear"
          type="button"
          class="rounded-inner px-1.5 py-0.5 text-xs font-medium text-muted outline-none transition-colors hover:bg-surface-soft hover:text-ink focus-visible:bg-surface-soft"
          @click="emit('clear')"
        >
          {{ l.clear }}
        </button>
        <button
          v-if="hasUnread"
          type="button"
          class="rounded-inner px-1.5 py-0.5 text-xs font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:bg-brand-soft"
          @click="emit('markAllRead')"
        >
          {{ l.markAllRead }}
        </button>
      </span>
    </header>

    <!-- Skeleton → empty → feed are three different heights, so the panel
         jumped as the list loaded and again whenever it emptied. Easing the
         swap keeps the popover from snapping under the bell. -->
    <LpShift axis="height">
      <div v-if="loading" class="space-y-1.5 px-2 pb-2">
        <LpSkeleton v-for="i in 4" :key="i" class="h-12" />
      </div>

      <LpEmptyState
        v-else-if="!items.length"
        icon="lucide:bell-off"
        :title="l.empty"
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
            class="group/notif flex w-full items-start gap-2.5 rounded-control px-2 py-2 text-left outline-none transition-colors hover:bg-surface-soft focus-visible:bg-surface-soft"
            :class="item.read ? '' : 'bg-brand-soft/35'"
            @click="onSelect(item)"
          >
            <!-- A read notification is always muted: the tone says what kind of
                 thing it is, and that only needs to compete for attention while
                 it is still unread. -->
            <span
              class="grid size-7 shrink-0 place-items-center rounded-control"
              :class="item.read ? 'bg-surface-soft text-muted' : toneLook(item.tone, 'brand').chip"
            >
              <LpIcon :name="item.icon || 'lucide:bell'" :size="15" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5">
                <span class="truncate text-sm font-medium" :class="item.read ? 'text-muted-strong' : 'text-ink'">
                  {{ item.title }}
                </span>
                <span v-if="!item.read" class="size-1.5 shrink-0 rounded-full bg-brand" />
                <span v-if="!item.read" class="sr-only">{{ l.unreadItem }}</span>
              </span>
              <span v-if="item.body" class="mt-0.5 line-clamp-2 block text-xs text-muted">
                {{ item.body }}
              </span>
              <span v-if="item.createdAt" class="mt-0.5 block text-[11px] text-muted/70">
                <template v-if="formatTime">{{ customTime(item.createdAt) }}</template>
                <!-- The row is itself a button or link, so the exact date goes
                     to the native title rather than a focusable tooltip. -->
                <LpRelativeTime v-else :date="item.createdAt" format="narrow" :tooltip="false" />
              </span>
            </span>
          </component>
        </LpContextMenu>
      </LpScrollArea>
    </LpShift>
  </LpPopover>
</template>
