/*
 * The usage the kit reports by itself to the hint system (see useHintSystem),
 * and the elements a tip points at. Kept apart from the system so a control
 * that reports (a button with a hotkey, a context menu, a dropzone) does not
 * carry the whole system: a report goes through `hints.use`, which nothing
 * hears until an app starts one.
 */

/** Usage the kit reports by itself. */
export const HINT_SIGNALS = {
  /** A context menu was opened (right click or long press). */
  contextMenu: "lp.context-menu",
  /** A "…" menu marked `rightClickToo` was opened: its items were one right click away. */
  menuButton: "lp.menu-button",
  /** A left click on something that also has a context menu. */
  contextTarget: "lp.context-target",
  /** The command palette was opened. */
  palette: "lp.palette",
  /** The current hint page changed: a navigation. */
  navigate: "lp.navigate",
  /** An item's actions were opened in the palette (Tab). */
  paletteActions: "lp.palette-actions",
  /** A button's `hotkey` was pressed instead of clicking it. */
  hotkey: "lp.hotkey",
  /** A button that has a `hotkey` was clicked with the pointer. */
  hotkeyTarget: "lp.hotkey-target",
  /** A dropzone's file dialog was used to pick a file. */
  dropzoneBrowse: "lp.dropzone-browse",
  /** Something was dropped or pasted onto a dropzone. */
  dropzoneDirect: "lp.dropzone-direct",
} as const

let lastContextTarget: WeakRef<Element> | null = null

/** The element a left click just landed on that also has a right-click menu (a table row rather than the table). */
export function noteContextTarget(el: Element): void {
  lastContextTarget = new WeakRef(el)
}

let lastHotkeyTarget: { el: WeakRef<Element>; combo: string } | null = null

/** A button with a hotkey was just clicked with the pointer: what `hotkeyTip` shows. */
export function noteHotkeyTarget(el: Element, combo: string): void {
  lastHotkeyTarget = { el: new WeakRef(el), combo }
}

let lastDropzone: WeakRef<Element> | null = null

/** A dropzone's file dialog was just used: what `dropzoneTip` shows. */
export function noteDropzone(el: Element): void {
  lastDropzone = new WeakRef(el)
}

/** What the last `note*` calls recorded, for the tips that point at it. */
export const notedTargets = {
  context: (): Element | undefined => lastContextTarget?.deref(),
  hotkey: (): { el: Element | undefined; combo: string } | null =>
    lastHotkeyTarget && { el: lastHotkeyTarget.el.deref(), combo: lastHotkeyTarget.combo },
  dropzone: (): Element | undefined => lastDropzone?.deref(),
}
