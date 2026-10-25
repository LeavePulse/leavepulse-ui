/*
 * What the two calendars (LpCalendar, LpRangeCalendar) and the two pickers
 * around them (LpDatePicker, LpDateRangePicker) share. reka draws a single and
 * a range calendar with different components, so the markup cannot be one
 * template; the look and the text can, and keeping them here is what stops the
 * pair drifting apart again (one had translatable month buttons, the other
 * English ones).
 */

export interface CalendarLabels extends Record<string, string> {
  previous: string
  next: string
}

export const CALENDAR_LABELS: CalendarLabels = { previous: "Previous month", next: "Next month" }

/** The card a bare calendar draws; a popover around it removes the frame. */
export const CALENDAR_FRAME = "inline-block rounded-card border border-line bg-surface-raised p-3"

export const CALENDAR_NAV =
  "flex size-8 items-center justify-center rounded-control text-muted outline-none transition-[color,background-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] hover:bg-surface-soft hover:text-ink active:scale-90 motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring"

/** The field a picker shows before it opens. */
export const PICKER_TRIGGER =
  "group flex w-full items-center gap-2 rounded-control border bg-surface-soft px-3 text-left text-ink outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-brand disabled:cursor-not-allowed disabled:opacity-55"

export const PICKER_SIZE = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
  lg: "h-(--size-control-lg) text-sm",
} as const

export function pickerTone(invalid: boolean): string {
  return invalid ? "border-danger focus-visible:ring-danger-soft" : "border-line focus-visible:border-brand"
}

/*
 * The clear button sits beside the trigger, not inside it (a button in a
 * button is invalid and was unreachable by keyboard), positioned over the
 * spacer the trigger leaves for it just before the chevron: gap-2 + 15px
 * chevron + px-3 from the right edge.
 */
export const PICKER_CLEAR =
  "absolute top-1/2 right-[calc(0.75rem+15px+0.5rem)] flex -translate-y-1/2 items-center rounded-sm text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"

/** Presets: a scrolling row over the calendar on a phone, a column beside it from `sm`. */
export const PICKER_PRESETS =
  "flex gap-1 overflow-x-auto border-b border-line p-2 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0"

export const PICKER_PRESET =
  "shrink-0 rounded-control px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-muted outline-none transition-colors duration-[var(--duration-fast)] hover:bg-surface-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-brand-soft aria-pressed:text-ink"
