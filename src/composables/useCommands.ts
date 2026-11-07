import { computed, toValue, type MaybeRefOrGetter } from "vue"
import type { Command } from "../components/LpCommandPalette.vue"
import type { ContextMenuItemDef } from "../components/LpContextMenu.vue"
import { parseCombo, useHotkeys, type HotkeyBinding, type ShortcutGroup, type UseHotkeysOptions } from "./useHotkeys"
import { usePaletteCommands, type PaletteScope } from "./usePaletteCommands"

/*
 * One definition of an application command, read by every place that offers it.
 *
 * Without this an action is written three times: a `useHotkeys` binding, a
 * palette command, a menu item, and the three drift. This adds no registry of
 * its own: the palette's registry (`usePaletteCommands`) lists the command and
 * the hotkey registry (`useHotkeys`) binds it and feeds `activeShortcuts`, so
 * LpShortcutsDialog lists it while it is mounted. A menu takes `menuItems`.
 *
 *   const { menuItems } = useCommands(() => [{
 *     id: "server/restart", label: "Restart", group: "Server",
 *     shortcut: "Ctrl+R", disabled: !canRestart.value, run: restart,
 *   }])
 *
 * The commands are read when asked for, so availability written as a plain
 * expression in the getter stays live.
 */
export interface AppCommand {
  /** Stable: the palette keeps recents and pins by it. */
  id: string
  label: string
  /** Section in the palette and in the key reference. */
  group?: string
  description?: string
  icon?: string
  keywords?: string[]
  /**
   * Written as it reads: "Ctrl+K", "Shift+Alt+N", or spaces for a sequence,
   * "G I". Binds the key and labels it in the palette, the menu and the reference.
   */
  shortcut?: string
  /** Listed but not runnable: greyed in the palette and the menu, the key does nothing. */
  disabled?: boolean
  /** Gone everywhere, key included. For what this user or this page cannot do at all. */
  hidden?: boolean
  /** Marked as dangerous in a menu; the palette has no such mark. */
  danger?: boolean
  /** The key also works while a text field has focus. */
  allowInInput?: boolean
  /** The key also works while an overlay owns the keyboard. */
  overLayers?: boolean
  run: () => unknown | Promise<unknown>
}

const DEFAULT_GROUP = "Commands"

const available = (commands: readonly AppCommand[]) => commands.filter((command) => !command.hidden)

/** What the palette lists for a command. */
export function commandToPalette(command: AppCommand): Command {
  const { id, label, group, description, icon, keywords, shortcut, disabled, run } = command
  return { id, label, group, description, icon, keywords, shortcut, disabled, onSelect: run }
}

/** What a menu shows for a command: LpContextMenu and LpDropdownMenu take these. */
export function commandToMenuItem(command: AppCommand): ContextMenuItemDef {
  const { label, icon, shortcut, disabled, danger, run } = command
  return { label, icon, shortcut, disabled, danger, onSelect: () => void run() }
}

/** The binding for a command, or null when it has no key. */
export function commandToHotkey(command: AppCommand): HotkeyBinding | null {
  const shortcut = command.shortcut?.trim()
  if (!shortcut) return null
  const steps = shortcut.split(/\s+/).map(parseCombo)
  const keys = steps.length > 1 ? { sequence: steps } : steps[0]
  return {
    ...keys,
    allowInInput: command.allowInInput,
    overLayers: command.overLayers,
    help: { group: command.group ?? DEFAULT_GROUP, label: command.label, combo: shortcut },
    // A disabled command leaves the key alone, for the page or the browser.
    handler: () => {
      if (command.disabled) return false
      void command.run()
    },
  }
}

/** The key reference of these commands alone, in LpShortcutsDialog's shape. */
export function commandShortcuts(commands: readonly AppCommand[]): ShortcutGroup[] {
  const groups = new Map<string, ShortcutGroup["entries"]>()
  for (const command of available(commands)) {
    if (!command.shortcut) continue
    const title = command.group ?? DEFAULT_GROUP
    const entries = groups.get(title) ?? []
    entries.push({ combo: command.shortcut, label: command.label })
    groups.set(title, entries)
  }
  return [...groups].map(([title, entries]) => ({ title, entries }))
}

export interface UseCommandsOptions extends Pick<UseHotkeysOptions, "enabled" | "priority" | "scope"> {
  /** The palette scope to list in. Defaults to the one this component sits in. */
  palette?: PaletteScope
}

export function useCommands(commands: MaybeRefOrGetter<readonly AppCommand[]>, options: UseCommandsOptions = {}) {
  const { palette, ...hotkeys } = options
  const current = computed(() => available(toValue(commands)))

  usePaletteCommands(() => current.value.map(commandToPalette), { scope: palette })
  useHotkeys(() => current.value.flatMap((command) => commandToHotkey(command) ?? []), hotkeys)

  return {
    commands: current,
    menuItems: computed(() => current.value.map(commandToMenuItem)),
    shortcuts: computed(() => commandShortcuts(current.value)),
    /** Runs a command by id, unless it is disabled or hidden. Returns whether it ran. */
    run(id: string): boolean {
      const command = current.value.find((candidate) => candidate.id === id)
      if (!command || command.disabled) return false
      void command.run()
      return true
    },
  }
}
