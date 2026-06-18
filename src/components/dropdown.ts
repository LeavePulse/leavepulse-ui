/*
 * Shared class strings for floating panels (the dropdown/popover surface) and
 * their option rows. These were copy-pasted across LpSelect, LpAutocomplete,
 * LpPhoneInput, LpPopover and LpDropdownMenu — one source of truth means a tweak
 * to the look or the side-aware enter/exit animation lands everywhere at once.
 *
 * The panel is built on different reka primitives per component (Combobox /
 * Popover / DropdownMenu content), so we share CLASSES, not a wrapper component.
 * Callers still own per-use bits: width, padding, overflow, and which primitive.
 *
 * IMPORTANT: a panel that hosts an option cascade must include `group` (it's in
 * POPOVER_PANEL) so each OPTION_ITEM can read the panel's data-side and cascade
 * the right way when the list flips above the trigger.
 */

/** Enter/exit animation for state-open panels (Select, Popover, Dropdown, …). */
export const POPOVER_ANIM =
  "data-[state=open]:animate-[popover-in_140ms_var(--ease-emphasized)] " +
  "data-[state=closed]:animate-[popover-out_120ms_ease] " +
  "data-[side=top]:data-[state=open]:animate-[popover-in-up_140ms_var(--ease-emphasized)] " +
  "data-[side=top]:data-[state=closed]:animate-[popover-out-up_120ms_ease]"

/** Tooltip variant: faster, and reka uses `delayed-open` instead of `open`. */
export const TOOLTIP_ANIM =
  "data-[state=delayed-open]:animate-[popover-in_120ms_var(--ease-emphasized)] " +
  "data-[state=closed]:animate-[popover-out_100ms_ease] " +
  "data-[side=top]:data-[state=delayed-open]:animate-[popover-in-up_120ms_var(--ease-emphasized)] " +
  "data-[side=top]:data-[state=closed]:animate-[popover-out-up_100ms_ease]"

/**
 * The bare floating surface (border, raised overlay fill, blur, shadow) without
 * any animation — pair with POPOVER_ANIM or TOOLTIP_ANIM. `group` lets option
 * rows read the panel's data-side for the cascade direction.
 */
export const PANEL_SURFACE =
  "group rounded-control border border-line bg-surface-overlay shadow-panel backdrop-blur"

/**
 * Surface + the state-open animation. Add width/padding/overflow and the z-layer
 * at the call-site (z-layer omitted so tooltips can use z-(--z-tooltip) while the
 * rest use z-(--z-popover)).
 */
export const POPOVER_PANEL = PANEL_SURFACE + " " + POPOVER_ANIM

/**
 * A selectable option row: layout, highlight state, and the staggered cascade.
 * Cascades downward by default and upward when the panel is flipped above the
 * trigger (group-data-[side=top]). Pair with an inline animationDelay for the
 * stagger. `flex` + gap are included; add justify/extra layout if needed.
 */
export const OPTION_ITEM =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-ink outline-none " +
  "animate-[option-in_180ms_var(--ease-emphasized)_both] " +
  "group-data-[side=top]:animate-[option-in-up_180ms_var(--ease-emphasized)_both] " +
  "data-[highlighted]:bg-brand-soft data-[highlighted]:text-brand"
