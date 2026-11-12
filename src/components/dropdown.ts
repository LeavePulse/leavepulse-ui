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


import { staggerDelay } from "./reveal"

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
 * Keeps a free-form panel (popover, menu, hover card) inside the window. Its
 * width stops 0.5rem short of each edge, so a w-96 panel or a long menu label
 * no longer runs off a phone; its height stops at the room reka measured on the
 * side it opened, and the rest scrolls. A date picker opened in landscape used
 * to hang off the top of the screen with its first weeks out of reach.
 */
export const PANEL_FIT = "max-w-[calc(100vw-1rem)] max-h-(--reka-popper-available-height) overflow-y-auto"

/**
 * A selectable option row: layout, highlight state, and the staggered cascade.
 * Cascades downward by default and upward when the panel is flipped above the
 * trigger (group-data-[side=top]). Pair with an inline animationDelay for the
 * stagger (optionStagger). `flex` + gap are included; add justify/extra layout if needed.
 */
export const OPTION_ITEM =
  "flex cursor-pointer items-center gap-2 rounded-inner px-2.5 py-1.5 text-sm text-ink outline-none " +
  "animate-[rise-in_180ms_var(--ease-emphasized)_both] [--rise:-6px] group-data-[side=top]:[--rise:6px] " +
  "data-[highlighted]:bg-brand-soft data-[highlighted]:text-brand"

/**
 * The cascade's delay for the option at `index`, as an inline style for the
 * row: 22 ms apart, and from the 12th on every option arrives together, so a
 * long list still lands at once. Select, Autocomplete, PhoneInput and
 * TagsInput each had this formula written out.
 */
export const optionStagger = (index: number): { animationDelay: string } => ({
  animationDelay: `${staggerDelay(index, 0, 22, 12)}ms`,
})

/**
 * Micro-animation for a close / clear "✕" icon: a quarter-turn on hover and a
 * dip on press. Put on the <LpIcon>, with `group` on its button. Shared by
 * Modal, Drawer, Toaster and the Autocomplete clear button.
 */
/* Where a combobox list sits under its field. */
export const COMBOBOX_PANEL = { collisionPadding: 8, position: "popper", sideOffset: 6 } as const

/*
 * A combobox list's height: 18rem, or less where reka measured less room on the
 * side it opened (a phone in landscape has about 170px under a field). The
 * panel is a column so its option list, which carries `min-h-0 flex-1`, is what
 * shrinks and scrolls; the search field above it stays.
 */
export const COMBOBOX_FIT = "flex flex-col max-h-[min(18rem,var(--reka-popper-available-height,18rem))]"

export const CLOSE_ICON =
  "transition-transform duration-medium ease-[var(--ease-emphasized)] " +
  "group-hover:rotate-90 group-active:scale-90 motion-reduce:group-hover:rotate-0"
