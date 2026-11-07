import type { ContextMenuItemDef } from "./LpContextMenu.vue"
import type { ToneName } from "./tone"

/**
 * A button on a notification itself: "Approve", "Reply", "View invoice". The
 * thing the notification asks for, done where it is read instead of a page away.
 */
export interface NotificationAction {
  label: string
  /**
   * `primary` is the one answer the notification is waiting for; `danger` a
   * destructive one ("Decline", "Revoke"). Unset is a quiet secondary button.
   */
  variant?: "primary" | "secondary" | "danger"
  icon?: string
  /** A destination instead of a handler: the button is a link. */
  href?: string
  /**
   * Runs on press. A returned promise shows the button busy, and holds the
   * row's other actions, until it settles; a rejection is left to the caller
   * (toast it), and the row stays as it was.
   */
  onSelect?: (item: NotificationItem) => unknown
}

/** Who a notification is from, drawn as their avatar in place of the icon. */
export interface NotificationActor {
  name: string
  /** Picture URL; the initials of `name` show without one. */
  avatar?: string
}

export interface NotificationItem {
  id: string
  title: string
  body?: string
  /** Optional icon name (e.g. "lucide:check-circle"). With an `actor`, it is a small badge on the avatar. */
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
  /** Who it is from; the row leads with their avatar. */
  actor?: NotificationActor
  /** Optional deep link; the row becomes a link when set. */
  link?: string
  /** ISO-8601 creation time; rendered as a relative label and used for the day groups. */
  createdAt?: string
  /** Whether the notification has been read. */
  read?: boolean
  /** Buttons on the notification itself. See `NotificationAction`. */
  actions?: NotificationAction[]
  /**
   * What became of it, once acted on ("Approved", "Declined by Anna"). Shown
   * in place of the actions, so a handled request reads as handled.
   */
  outcome?: string
  /** Which of the feed's `categories` tabs it belongs to. */
  category?: string
}

/** A tab of the feed beside All and Unread, keyed by `NotificationItem.category`. */
export interface NotificationCategory {
  value: string
  label: string
  icon?: string
}

/**
 * Every user-facing string the feed and the bell render on their own. Apps
 * with i18n pass their translations in (or set the `notifications` scope in
 * the kit config); the English defaults keep the components usable bare.
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
  /** The Unread tab's empty state. */
  emptyUnread?: string
  ariaLabel?: string
  /** Appended to the button's name while there is unread news; `{count}` is filled in. */
  unread?: string
  /** Screen-reader marker on an unread row. */
  unreadItem?: string
  /** Tabs. */
  all?: string
  unreadTab?: string
  /** Day groups. */
  today?: string
  yesterday?: string
  earlier?: string
  /** The header's settings button. */
  settings?: string
  /** The footer link (`allLink`). */
  viewAll?: string
  loadMore?: string
  /** Actions of a row, as a group. */
  actions?: string
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

export const NOTIFICATION_LABELS = {
  title: "Notifications",
  markAllRead: "Mark all read",
  clear: "Clear",
  markAsRead: "Mark as read",
  markAsUnread: "Mark as unread",
  open: "Open",
  dismiss: "Dismiss",
  empty: "No notifications",
  emptyUnread: "You're all caught up",
  ariaLabel: "",
  unread: "{count} unread",
  unreadItem: "Unread",
  all: "All",
  unreadTab: "Unread",
  today: "Today",
  yesterday: "Yesterday",
  earlier: "Earlier",
  settings: "Notification settings",
  viewAll: "View all notifications",
  loadMore: "Load more",
  actions: "Actions",
}

/** Extra right-click entries for a row, after the built-in ones. */
export type NotificationMenu = (item: NotificationItem) => ContextMenuItemDef[]

const DAY_MS = 86_400_000

function dayStart(time: number): number {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** today | yesterday | earlier, in the viewer's own calendar. */
export function dayOf(iso: string | undefined, now: number): "today" | "yesterday" | "earlier" {
  const time = iso ? Date.parse(iso) : Number.NaN
  if (Number.isNaN(time)) return "earlier"
  const today = dayStart(now)
  if (time >= today) return "today"
  // Not today - DAY_MS: a day across a clock change is 23 or 25 hours.
  if (time >= dayStart(today - DAY_MS / 2)) return "yesterday"
  return "earlier"
}

export interface NotificationGroup {
  key: string
  day: "today" | "yesterday" | "earlier" | null
  items: NotificationItem[]
}

/**
 * Runs of consecutive items from the same day. Consecutive, not sorted: the
 * feed keeps the caller's order, and an out-of-order item opens a new run
 * rather than being moved away from where the caller put it.
 */
export function groupByDay(items: NotificationItem[], now: number, grouped: boolean): NotificationGroup[] {
  if (!grouped || !items.some((item) => item.createdAt)) return [{ key: "all", day: null, items }]
  const groups: NotificationGroup[] = []
  for (const item of items) {
    const day = dayOf(item.createdAt, now)
    const last = groups.at(-1)
    if (last?.day === day) last.items.push(item)
    else groups.push({ key: `${day}-${groups.length}`, day, items: [item] })
  }
  return groups
}

/** The milliseconds until the next local midnight, when the day groups move. */
export function untilMidnight(now: number): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return Math.max(1_000, next.getTime() - now)
}
