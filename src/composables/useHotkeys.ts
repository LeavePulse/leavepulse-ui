import { computed, onBeforeUnmount, onMounted, shallowReactive, type MaybeRefOrGetter, toValue } from "vue"

/*
 * One keydown listener over a registry of bindings, so a shortcut is declared
 * next to the action it runs instead of growing another window-level handler.
 *
 * Three things every hand-rolled shortcut handler tends to get wrong, and the
 * reason this is worth sharing rather than rewriting per app:
 *
 *   layout — a binding names its key twice over. `key` is what the layout
 *     produced, `code` is the physical position, and either matching counts. On
 *     a Cyrillic layout Ctrl+K arrives under a different `key` with `code: "KeyK"`, and a
 *     user pressing the key printed "K" expects it to work either way.
 *
 *   IME — a composing input delivers every keystroke as its own event, so
 *     acting on them fires shortcuts mid-word.
 *
 *   text entry — a shortcut that steals a key from someone typing is a bug,
 *     except for the few that mean something in a field (Escape, a palette).
 *
 * Modifier note: Ctrl and Meta are one modifier here, since macOS binds ⌘ where
 * the rest bind Ctrl. Label the difference in the UI, not in the binding.
 */

export interface HotkeyBinding {
  /** Layout-produced key, compared case-insensitively ("l", "f2", "escape"). */
  key: string
  /**
   * Physical key position ("KeyL", "F2", "Digit1"). Matches on its own, which
   * is what makes non-Latin layouts work.
   */
  code?: string
  /** Ctrl on Windows/Linux, ⌘ on macOS — the two are treated as one. */
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  /**
   * Runs even while a text field has focus. Only for shortcuts that mean
   * something there — Escape, and the palette the user reaches from anywhere.
   */
  allowInInput?: boolean
  /**
   * How the key reference lists this binding while it is mounted. Bindings
   * without it still work, they just stay out of `activeShortcuts`.
   */
  help?: HotkeyHelp
  /**
   * Returning `false` declines the key: the event keeps its default and the
   * search moves on. This is what lets a binding defer to a layer that owns the
   * key better than it does — Escape belongs to whichever overlay is on top,
   * and swallowing it here would close all of them. The event is passed for
   * the checks only it can answer: where the focus is, whether an inner
   * control already took the key.
   */
  handler: (event: KeyboardEvent) => void | boolean
}

export interface HotkeyHelp {
  /** Section of the reference the entry goes under. */
  group: string
  label: string
  /**
   * Written the way it reads, "+"-separated. Defaults to one built from the
   * binding; set it where the binding is not the whole story, such as the
   * second key of a chord ("G+D") or a key that needs Shift to type ("?").
   */
  combo?: string
}

export interface ShortcutEntry {
  /** Rendered one <kbd> per "+"-separated key, so write it the way it reads. */
  combo: string
  label: string
}

export interface ShortcutGroup {
  title: string
  entries: ShortcutEntry[]
}

/**
 * Whether this machine prints ⌘ where the rest print Ctrl. Read once: the
 * keyboard does not change under a running window, and the check is only ever
 * used to pick a label.
 */
export const isAppleKeyboard =
  typeof navigator !== "undefined"
  && /Mac|iPhone|iPad|iPod/.test(navigator.platform || "")

/**
 * The symbol to print for a modifier on this platform. Bindings treat Ctrl and
 * Meta as one modifier, so only the label may differ — never the binding.
 */
export function appleModifierLabel(key: string): string {
  if (!isAppleKeyboard) return key
  if (key === "Ctrl") return "⌘"
  if (key === "Alt") return "⌥"
  return key
}

const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "number",
  "password",
  "tel",
  "url",
])

/**
 * Whether the event lands in something the user is typing into. Checked off the
 * event target rather than `document.activeElement` so it stays right inside a
 * dialog's focus trap.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type)
  }
  return false
}

function matches(event: KeyboardEvent, binding: HotkeyBinding): boolean {
  const ctrlHeld = event.ctrlKey || event.metaKey
  if (ctrlHeld !== Boolean(binding.ctrl)) return false
  if (event.shiftKey !== Boolean(binding.shift)) return false
  if (event.altKey !== Boolean(binding.alt)) return false
  return (
    event.key.toLowerCase() === binding.key.toLowerCase()
    || (binding.code !== undefined && event.code === binding.code)
  )
}

/**
 * Bind a list of hotkeys for as long as the calling component is mounted.
 *
 * The list is read on every keystroke rather than captured once, so bindings
 * may come and go with the state that owns them — a getter is the point, not a
 * formality.
 */
export interface UseHotkeysOptions {
  enabled?: MaybeRefOrGetter<boolean>
  priority?: MaybeRefOrGetter<number>
  /**
   * Only act while the focus is inside this element.
   *
   * The default is the whole window, which is right for a command palette and
   * wrong for a control: two of the same component on one page would both
   * answer the same key, and a control beside a form would answer keys aimed
   * at the form. Scoping it here rather than in each component because every
   * one of them was about to write the same `document.activeElement` check and
   * decline by hand.
   *
   * Undefined or null means the window, so the palette case stays the default.
   */
  scope?: MaybeRefOrGetter<HTMLElement | null | undefined>
}

interface MountedHotkeys {
  read: () => HotkeyBinding[]
  scope: MaybeRefOrGetter<HTMLElement | null | undefined> | undefined
  enabled: MaybeRefOrGetter<boolean> | undefined
  priority: MaybeRefOrGetter<number> | undefined
  order: number
}

const mounted = shallowReactive(new Set<MountedHotkeys>())
let mountOrder = 0
let listening = false

function inScope(target: EventTarget | null, scope: MountedHotkeys["scope"]): boolean {
  const el = toValue(scope)
  if (!el) return true
  const node = target instanceof Node ? target : null
  return !!node && (el === node || el.contains(node))
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  const inTextEntry = isTextEntry(event.target)
  const entries = [...mounted].sort(
    (a, b) => Number(toValue(b.priority) || 0) - Number(toValue(a.priority) || 0) || b.order - a.order,
  )
  for (const entry of entries) {
    if (toValue(entry.enabled) === false || !inScope(event.target, entry.scope)) continue
    for (const binding of entry.read()) {
      if (inTextEntry && !binding.allowInInput) continue
      if (!matches(event, binding)) continue
      if (binding.handler(event) === false) continue
      event.preventDefault()
      return
    }
  }
}

export function useHotkeys(
  bindings: MaybeRefOrGetter<HotkeyBinding[]>,
  options: UseHotkeysOptions = {},
) {
  const entry: MountedHotkeys = {
    read: () => toValue(bindings),
    scope: options.scope,
    enabled: options.enabled,
    priority: options.priority,
    order: ++mountOrder,
  }
  onMounted(() => {
    mounted.add(entry)
    if (!listening) {
      window.addEventListener("keydown", onKeydown)
      listening = true
    }
  })
  onBeforeUnmount(() => {
    mounted.delete(entry)
    if (!mounted.size && listening) {
      window.removeEventListener("keydown", onKeydown)
      listening = false
    }
  })
}

const KEY_NAMES: Record<string, string> = {
  escape: "Esc",
  enter: "Enter",
  backspace: "Backspace",
  delete: "Delete",
  tab: "Tab",
  " ": "Space",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
}

function comboOf(binding: HotkeyBinding): string {
  const key = binding.key.toLowerCase()
  const name = KEY_NAMES[key] ?? (key.length === 1 || /^f\d+$/.test(key) ? key.toUpperCase() : binding.key)
  return [binding.ctrl && "Ctrl", binding.alt && "Alt", binding.shift && "Shift", name].filter(Boolean).join("+")
}

/**
 * The shortcuts that work right now, grouped for `LpShortcutsDialog`: every
 * binding with `help` from every mounted `useHotkeys`. A screen that binds its
 * own keys adds its section while it is open, so the reference never lists a
 * key that does nothing here or misses one that does.
 */
export const activeShortcuts = computed<ShortcutGroup[]>(() => {
  const groups = new Map<string, ShortcutEntry[]>()
  for (const entry of mounted) {
    if (toValue(entry.enabled) === false) continue
    for (const binding of entry.read()) {
      if (!binding.help) continue
      const combo = binding.help.combo ?? comboOf(binding)
      const entries = groups.get(binding.help.group) ?? []
      if (!entries.some((e) => e.combo === combo)) entries.push({ combo, label: binding.help.label })
      groups.set(binding.help.group, entries)
    }
  }
  return [...groups].map(([title, entries]) => ({ title, entries }))
})

/**
 * Groups merged by title, entries kept once per combo: what a reference shows
 * when it lists both its own entries and the live ones.
 */
export function mergeShortcutGroups(...lists: ShortcutGroup[][]): ShortcutGroup[] {
  const groups = new Map<string, ShortcutEntry[]>()
  for (const list of lists) {
    for (const group of list) {
      const entries = groups.get(group.title) ?? []
      for (const entry of group.entries) {
        if (!entries.some((e) => e.combo === entry.combo)) entries.push(entry)
      }
      groups.set(group.title, entries)
    }
  }
  return [...groups].map(([title, entries]) => ({ title, entries }))
}
