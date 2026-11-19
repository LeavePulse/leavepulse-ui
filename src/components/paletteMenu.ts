import type { Command } from "./commandPaletteTypes"
import type { ContextMenuItemDef } from "./LpContextMenu.vue"

/*
 * A menu's items as palette commands. Apart from the palette's own logic
 * (commandPalette.ts) because every control that registers commands needs this
 * and nothing else of it.
 */

/** The same action definitions serve a row menu and the command palette. */
export function menuPaletteCommands(items: ContextMenuItemDef[], prefix: string): Command[] {
  return items.map((item, index) => ({
    id: `${prefix}/${index}`, label: item.label, icon: item.icon, disabled: item.disabled,
    onSelect: item.onSelect, keepOpen: item.checked !== undefined,
    children: item.children ? menuPaletteCommands(item.children, `${prefix}/${index}`) : undefined,
  }))
}
