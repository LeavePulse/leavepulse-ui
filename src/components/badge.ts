/*
 * The remove control on a chip (LpBadge `removable`): a small round ✕ that
 * tints on hover. Exported for a chip whose remove control has to be another
 * primitive's (reka's TagsInputItemDelete in LpTagsInput, which owns the
 * keyboard handling), so it still looks like the badge's own.
 */
export const BADGE_REMOVE =
  "grid size-4 shrink-0 place-items-center rounded-pill text-muted outline-none transition-colors duration-fast hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
