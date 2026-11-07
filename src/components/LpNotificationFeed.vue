<script setup lang="ts">
/*
 * A notification feed: the list behind LpNotificationBell, usable on its own
 * for a full "All notifications" page.
 *
 *   <LpNotificationFeed :items="items" @mark-read="read" @dismiss="dismiss" />
 *
 * Data in, events out, no fetching inside (the kit convention). What it draws:
 *
 *   - a header with All / Unread tabs (plus the caller's `categories`), Mark
 *     all read, and Clear and a settings button where those are handled;
 *   - rows grouped by day (Today, Yesterday, Earlier), each leading with the
 *     sender's avatar or a toned icon, its own buttons (`item.actions`: the
 *     answer the notification is waiting for, done where it is read) or what
 *     became of it (`item.outcome`), and quick actions on hover or focus
 *     (read / unread, dismiss) so the right-click menu is a shortcut, not the
 *     only way;
 *   - a footer: Load more while `hasMore`, and a link to the whole feed.
 *
 * Keyboard: ↑ ↓ move between rows, Home / End to the ends, Delete dismisses
 * the focused one; Tab reaches each row's buttons.
 *
 * Tabs filter `items` here as well, so a caller holding the whole feed needs
 * nothing more; one fetching per tab binds `v-model:filter` and refetches.
 */
import { computed, getCurrentInstance, ref } from "vue"
import { useLabels } from "../composables/useLpConfig"
import { useNow } from "../composables/useNow"
import { isHTMLElement } from "../composables/useView"
import LpAvatar from "./LpAvatar.vue"
import LpButton from "./LpButton.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpEmptyState from "./LpEmptyState.vue"
import LpIcon from "./LpIcon.vue"
import LpRelativeTime from "./LpRelativeTime.vue"
import LpScrollArea from "./LpScrollArea.vue"
import LpShift from "./LpShift.vue"
import LpSkeleton from "./LpSkeleton.vue"
import LpTabs, { type TabItem } from "./LpTabs.vue"
import LpTooltip from "./LpTooltip.vue"
import {
  groupByDay as groupRuns,
  NOTIFICATION_LABELS,
  untilMidnight,
  type NotificationAction,
  type NotificationCategory,
  type NotificationItem,
  type NotificationLabels,
  type NotificationMenu,
} from "./notifications"
import { toneLook } from "./tone"

const props = withDefaults(
  defineProps<{
    items?: NotificationItem[]
    /** Unread count for the Unread tab; falls back to counting unread items. */
    unreadCount?: number
    loading?: boolean
    /** More is waiting past the last row: a Load more button asks for it (`@load-more`). */
    hasMore?: boolean
    /** A `@load-more` is in flight. */
    loadingMore?: boolean
    title?: string
    emptyLabel?: string
    /** Tabs after All and Unread, matched against `item.category`. */
    categories?: NotificationCategory[]
    /** Head runs of rows with Today / Yesterday / Earlier. Default true. */
    groupByDay?: boolean
    /** Drop the title row (tabs and buttons stay). */
    hideTitle?: boolean
    /** The footer's link to the whole feed. */
    allLink?: string
    /**
     * Scroll inside the feed, capped at this height (any CSS length). `false`
     * lets it grow with the page, for a full page of notifications.
     */
    maxHeight?: string | false
    /** Extra right-click entries for a row, after mark read / open / dismiss. */
    itemMenu?: NotificationMenu
    labels?: NotificationLabels
    /**
     * Formats `item.createdAt` for display. Defaults to a narrow relative time
     * in the app's locale ("now", "5m ago", "3h ago").
     */
    formatTime?: (iso: string) => string
  }>(),
  { items: () => [], groupByDay: true, maxHeight: "min(28rem, 70dvh)" },
)

const filter = defineModel<string>("filter", { default: "all" })

const emit = defineEmits<{
  (e: "markRead", id: string): void
  (e: "markUnread", id: string): void
  (e: "markAllRead"): void
  /** Empty the whole feed. The header button only appears when this is bound. */
  (e: "clear"): void
  (e: "dismiss", id: string): void
  (e: "select", item: NotificationItem): void
  /** One of the row's own buttons was pressed (after its `onSelect`, if any, was started). */
  (e: "action", item: NotificationItem, action: NotificationAction): void
  /** The header's gear. Only drawn when this is bound. */
  (e: "settings"): void
  (e: "loadMore"): void
}>()

const text = useLabels("notifications", NOTIFICATION_LABELS, () => props.labels as Partial<typeof NOTIFICATION_LABELS>)
const l = computed(() => ({
  ...text.value,
  title: props.title ?? text.value.title,
  empty: props.emptyLabel ?? text.value.empty,
}))

/*
 * Which optional actions the consumer handles. NOT `useAttrs()`: a listener
 * for a DECLARED emit is removed from `$attrs`; the raw vnode props keep it.
 */
const instance = getCurrentInstance()
const handles = (name: string) => Boolean(instance?.vnode.props?.[name])
const handlesClear = computed(() => handles("onClear"))
const handlesSettings = computed(() => handles("onSettings"))

const unread = computed(() => props.unreadCount ?? props.items.filter((n) => !n.read).length)
const hasUnread = computed(() => unread.value > 0)

const tabs = computed<TabItem[]>(() => [
  { value: "all", label: l.value.all },
  { value: "unread", label: l.value.unreadTab, badge: unread.value || undefined },
  ...(props.categories ?? []).map((c) => ({ value: c.value, label: c.label, icon: c.icon })),
])

const shown = computed(() => {
  const f = filter.value
  if (f === "all") return props.items
  if (f === "unread") return props.items.filter((n) => !n.read)
  return props.items.filter((n) => n.category === f)
})

// The groups move at midnight, not on every render.
const now = useNow(() => props.groupByDay, { nextIn: untilMidnight })
const groups = computed(() => groupRuns(shown.value, now.value, props.groupByDay))

const emptyTitle = computed(() => (filter.value === "unread" && props.items.length ? l.value.emptyUnread : l.value.empty))

function select(item: NotificationItem) {
  if (!item.read) emit("markRead", item.id)
  emit("select", item)
}

function toggleRead(item: NotificationItem) {
  if (item.read) emit("markUnread", item.id)
  else emit("markRead", item.id)
}

/* Rows with an action under way: their buttons wait for it. */
const pending = ref<Record<string, number>>({})
const busy = (item: NotificationItem) => pending.value[item.id] !== undefined

async function runAction(item: NotificationItem, action: NotificationAction, index: number) {
  if (busy(item)) return
  // Answering a notification is reading it.
  if (!item.read) emit("markRead", item.id)
  const result = action.onSelect?.(item)
  emit("action", item, action)
  if (typeof (result as PromiseLike<unknown> | undefined)?.then !== "function") return
  pending.value = { ...pending.value, [item.id]: index }
  try {
    await result
  } finally {
    const { [item.id]: _, ...rest } = pending.value
    pending.value = rest
  }
}

const ACTION_VARIANT = { primary: "solid", secondary: "soft", danger: "danger" } as const

function rowMenu(item: NotificationItem): ContextMenuItemDef[] {
  const actions: ContextMenuItemDef[] = [
    item.read
      ? { label: l.value.markAsUnread, icon: "lucide:mail", onSelect: () => emit("markUnread", item.id) }
      : { label: l.value.markAsRead, icon: "lucide:check", onSelect: () => emit("markRead", item.id) },
  ]
  if (item.link) actions.push({ label: l.value.open, icon: "lucide:external-link", onSelect: () => select(item) })
  const extra = props.itemMenu?.(item) ?? []
  if (extra.length) actions.push({ ...extra[0]!, separatorBefore: true }, ...extra.slice(1))
  actions.push({ label: l.value.dismiss, icon: "lucide:x", danger: true, separatorBefore: true, onSelect: () => emit("dismiss", item.id) })
  return actions
}

// A `formatTime` prop takes over the row's time; it is re-asked twice a minute.
const customNow = useNow(() => !!props.formatTime, { nextIn: () => 30_000 })
function customTime(iso: string): string {
  void customNow.value
  return props.formatTime ? props.formatTime(iso) : ""
}

/* ↑ ↓ Home End between rows, Delete dismisses: the list is one place, not a Tab per row. */
const listEl = ref<HTMLElement | null>(null)
function onListKeydown(event: KeyboardEvent) {
  const target = event.target
  if (!isHTMLElement(target) || !target.matches("[data-lp-notification-main]")) return
  const rows = [...(listEl.value?.querySelectorAll<HTMLElement>("[data-lp-notification-main]") ?? [])]
  const at = rows.indexOf(target)
  const to =
    event.key === "ArrowDown" ? Math.min(rows.length - 1, at + 1)
    : event.key === "ArrowUp" ? Math.max(0, at - 1)
    : event.key === "Home" ? 0
    : event.key === "End" ? rows.length - 1
    : -1
  if (to >= 0) {
    event.preventDefault()
    rows[to]?.focus()
    return
  }
  if (event.key === "Delete") {
    const id = target.dataset.lpNotificationMain
    if (!id) return
    event.preventDefault()
    // Focus the neighbour first: the dismissed row takes its focus with it.
    ;(rows[at + 1] ?? rows[at - 1])?.focus()
    emit("dismiss", id)
  }
}

const QUICK =
  "relative z-1 grid size-7 place-items-center rounded-inner text-muted outline-none transition-colors hover:bg-ink/[0.07] hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
</script>

<template>
  <section class="flex min-w-0 flex-col" :aria-label="l.title">
    <header class="flex flex-col gap-1.5 px-3 pt-2.5">
      <div v-if="!hideTitle" class="flex min-h-7 items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-ink">{{ l.title }}</h2>
        <span class="flex items-center gap-0.5">
          <button
            v-if="hasUnread"
            type="button"
            class="rounded-inner px-1.5 py-1 text-xs font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-ring"
            @click="emit('markAllRead')"
          >
            {{ l.markAllRead }}
          </button>
          <!-- Emptying the feed is destructive and different from reading it:
               an icon, muted, away from the primary action; only when handled. -->
          <LpTooltip v-if="items.length && handlesClear" :content="l.clear" label>
            <button type="button" :class="QUICK" @click="emit('clear')">
              <LpIcon name="lucide:trash-2" :size="15" />
            </button>
          </LpTooltip>
          <LpTooltip v-if="handlesSettings" :content="l.settings" label>
            <button type="button" :class="QUICK" @click="emit('settings')">
              <LpIcon name="lucide:settings" :size="15" />
            </button>
          </LpTooltip>
        </span>
      </div>
      <LpTabs v-model="filter" :items="tabs" variant="underline" :hover-follow="false" :label="l.title" class="-mx-1" />
    </header>

    <!-- Skeleton → empty → feed are different heights; easing the swap keeps
         a popover from snapping under its trigger. -->
    <LpShift axis="height">
      <div v-if="loading" class="space-y-1 p-2">
        <div v-for="i in 4" :key="i" class="flex gap-3 px-2 py-2">
          <LpSkeleton class="size-8 rounded-full" />
          <div class="flex-1 space-y-1.5"><LpSkeleton class="h-3.5 w-2/3" /><LpSkeleton class="h-3 w-full" /></div>
        </div>
      </div>

      <LpEmptyState
        v-else-if="!shown.length"
        :icon="filter === 'unread' && items.length ? 'lucide:check-check' : 'lucide:bell-off'"
        :title="emptyTitle"
        class="px-3 py-10"
      />

      <component
        :is="maxHeight === false ? 'div' : LpScrollArea"
        v-else
        v-bind="maxHeight === false ? {} : { style: { maxHeight }, contentClass: 'py-1' }"
      >
        <div ref="listEl" @keydown="onListKeydown">
          <section v-for="group in groups" :key="group.key" :aria-label="group.day ? l[group.day] : undefined">
            <h3 v-if="group.day" class="px-4 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {{ l[group.day] }}
            </h3>
            <ul class="flex flex-col gap-px px-1.5">
              <LpContextMenu v-for="item in group.items" :key="item.id" :items="rowMenu(item)">
                <li
                  class="group/notif relative flex gap-3 rounded-control px-2.5 py-2.5 transition-colors hover:bg-surface-soft focus-within:bg-surface-soft"
                  :class="item.read ? '' : 'bg-brand-soft/30'"
                  :data-lp-notification="item.id"
                  :data-read="item.read ? '' : undefined"
                >
                  <!-- Leading: who it is from, else what kind of thing it is. A
                       read row's icon goes muted: kind only competes for
                       attention while it is news. -->
                  <span class="relative mt-0.5 flex shrink-0 self-start">
                    <LpAvatar v-if="item.actor" :src="item.actor.avatar" :alt="item.actor.name" size="sm" />
                    <span
                      v-if="!item.actor || item.icon"
                      class="grid place-items-center"
                      :class="[
                        item.actor
                          ? 'absolute -bottom-1 -right-1.5 size-3.5 rounded-full ring-2 ring-surface-overlay'
                          : 'size-7 rounded-control',
                        item.read ? 'bg-surface-soft text-muted' : toneLook(item.tone, 'brand').chip,
                      ]"
                    >
                      <LpIcon :name="item.icon || 'lucide:bell'" :size="item.actor ? 9 : 15" />
                    </span>
                  </span>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-2">
                      <!-- The title is the row's control; its ::after stretches
                           over the tile, so a press anywhere on it opens the
                           notification while the buttons sit above it. -->
                      <component
                        :is="item.link ? 'a' : 'button'"
                        :href="item.link || undefined"
                        :type="item.link ? undefined : 'button'"
                        :data-lp-notification-main="item.id"
                        class="min-w-0 flex-1 truncate text-left text-sm outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        :class="item.read ? 'font-normal text-muted-strong' : 'font-semibold text-ink'"
                        @click="select(item)"
                      >
                        <span v-if="!item.read" class="sr-only">{{ l.unreadItem }}: </span>{{ item.title }}
                      </component>
                      <span
                        v-if="item.createdAt"
                        class="shrink-0 text-[11px] text-muted transition-opacity group-focus-within/notif:opacity-0 group-hover/notif:opacity-0 [@media(hover:none)]:opacity-100!"
                      >
                        <template v-if="formatTime">{{ customTime(item.createdAt) }}</template>
                        <LpRelativeTime v-else :date="item.createdAt" format="narrow" :tooltip="false" />
                      </span>
                      <span v-if="!item.read" aria-hidden="true" class="size-2 shrink-0 self-center rounded-full bg-brand" />
                    </div>
                    <p v-if="item.body" class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{{ item.body }}</p>

                    <p v-if="item.outcome" class="mt-1.5 flex items-center gap-1 text-xs font-medium text-muted-strong">
                      <LpIcon name="lucide:check" :size="13" />{{ item.outcome }}
                    </p>
                    <div
                      v-else-if="item.actions?.length"
                      role="group"
                      :aria-label="l.actions"
                      class="relative z-1 mt-2 flex flex-wrap gap-1.5"
                    >
                      <LpButton
                        v-for="(action, i) in item.actions"
                        :key="action.label"
                        size="xs"
                        class="h-7"
                        :variant="ACTION_VARIANT[action.variant ?? 'secondary']"
                        :href="action.href"
                        :loading="pending[item.id] === i"
                        :disabled="busy(item) && pending[item.id] !== i"
                        @click="runAction(item, action, i)"
                      >
                        <LpIcon v-if="action.icon" :name="action.icon" :size="13" />{{ action.label }}
                      </LpButton>
                    </div>
                  </div>

                  <!-- Quick actions: on hover and focus where there is a pointer,
                       always on touch; they take the time's place. -->
                  <span
                    class="absolute right-2 top-1.5 z-1 flex gap-0.5 rounded-inner bg-surface-soft opacity-0 transition-opacity group-focus-within/notif:opacity-100 group-hover/notif:opacity-100 [@media(hover:none)]:static [@media(hover:none)]:self-start [@media(hover:none)]:bg-transparent [@media(hover:none)]:opacity-100"
                  >
                    <LpTooltip :content="item.read ? l.markAsUnread : l.markAsRead" label>
                      <button type="button" :class="QUICK" @click="toggleRead(item)">
                        <LpIcon :name="item.read ? 'lucide:mail' : 'lucide:check'" :size="15" />
                      </button>
                    </LpTooltip>
                    <LpTooltip :content="l.dismiss" label>
                      <button type="button" :class="QUICK" @click="emit('dismiss', item.id)">
                        <LpIcon name="lucide:x" :size="15" />
                      </button>
                    </LpTooltip>
                  </span>
                </li>
              </LpContextMenu>
            </ul>
          </section>
          <div v-if="hasMore" class="px-3 pb-1 pt-2">
            <LpButton variant="muted" size="sm" block :loading="loadingMore" @click="emit('loadMore')">{{ l.loadMore }}</LpButton>
          </div>
        </div>
      </component>
    </LpShift>

    <footer v-if="allLink || $slots.footer" class="border-t border-line px-2 py-1.5">
      <slot name="footer">
        <a
          :href="allLink"
          class="flex items-center justify-center gap-1 rounded-inner py-1.5 text-xs font-medium text-brand outline-none transition-colors hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-ring"
        >
          {{ l.viewAll }}<LpIcon name="lucide:arrow-right" :size="13" />
        </a>
      </slot>
    </footer>
  </section>
</template>
