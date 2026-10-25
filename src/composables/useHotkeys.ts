import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowReactive,
  toValue,
  type MaybeRefOrGetter,
} from "vue"
import { topModalElement } from "../components/modalDepth"

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
 *
 * Sequences ("g i", as on GitHub and Gmail) are bindings with `sequence`. A key
 * that starts a sequence is held while the next one is awaited: if it
 * continues a sequence, the sequence runs; if not, or after the timeout, the
 * single-key binding on the held key (if any) runs, and the new key is handled
 * as a fresh press. A key that starts no sequence runs at once, so sequences
 * cost nothing to the bindings they do not collide with.
 */

/** One key of a sequence: a bare key ("g") or a full chord. */
export interface HotkeyStep {
  key: string
  code?: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export interface HotkeyBinding {
  /**
   * Layout-produced key, compared case-insensitively ("l", "f2", "escape").
   * Required unless the binding is a `sequence`.
   */
  key?: string
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
   * Keys pressed one after another: `"g i"`, or steps for chords and physical
   * positions (`[{ key: "g", code: "KeyG" }, { key: "i", code: "KeyI" }]`).
   * The string form splits on spaces, so a Space step needs the array form.
   */
  sequence?: string | (string | HotkeyStep)[]
  /** How long a sequence waits for its next key, in ms. Default 1000. */
  timeout?: number
  /** Extra condition checked on every press; `false` leaves the key alone. */
  when?: (event: KeyboardEvent) => boolean
  /**
   * Runs even while a text field has focus. Only for shortcuts that mean
   * something there — Escape, and the palette the user reaches from anywhere.
   */
  allowInInput?: boolean
  /**
   * Runs even while an overlay owns the keyboard. By default a binding declared
   * outside the topmost modal stays quiet while that modal is open, and an
   * Escape binding declared outside the topmost dismissable layer (dialog,
   * popover, menu) leaves Escape to that layer, so a page-level shortcut can
   * neither act behind a dialog nor stop the dialog from closing.
   */
  overLayers?: boolean
  /** Set `false` to ignore auto-repeat while the key is held. */
  repeat?: boolean
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
   * key that needs Shift to type ("?"). Sequences read with spaces: "G I".
   */
  combo?: string
}

export interface ShortcutEntry {
  /**
   * Rendered one <kbd> per "+"-separated key, so write it the way it reads.
   * Spaces separate the steps of a sequence ("G I", "Ctrl+K Ctrl+S").
   */
  combo: string
  label: string
  /** Another mounted binding answers the same keys at the same priority. */
  conflict?: boolean
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
 * `isAppleKeyboard` for render paths: false until mounted, so the server and
 * the hydrating client print the same label and the client switches after.
 */
export function useAppleKeyboard() {
  const apple = ref(false)
  onMounted(() => (apple.value = isAppleKeyboard))
  return apple
}

/**
 * The symbol to print for a modifier on this platform. Bindings treat Ctrl and
 * Meta as one modifier, so only the label may differ — never the binding.
 */
export function appleModifierLabel(key: string, apple = isAppleKeyboard): string {
  if (!apple) return key
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

const MODIFIER_KEYS = new Set(["control", "meta", "shift", "alt"])

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">

export function matchesHotkey(event: KeyLike, binding: HotkeyBinding | HotkeyStep): boolean {
  if (binding.key === undefined) return false
  const key = binding.key.toLowerCase()
  const ctrlHeld = event.ctrlKey || event.metaKey
  const wantsCtrl = Boolean(binding.ctrl) || key === "control" || key === "meta"
  if (ctrlHeld !== wantsCtrl) return false
  // Shift is part of typing a symbol on most layouts ("?", "+"), so a binding
  // on a symbol that does not mention Shift accepts it either way.
  const symbol = key.length === 1 && key.toLowerCase() === key.toUpperCase()
  const shiftFree = key === "shift" || (binding.shift === undefined && symbol)
  if (!shiftFree && event.shiftKey !== Boolean(binding.shift)) return false
  if (key !== "alt" && event.altKey !== Boolean(binding.alt)) return false
  if (MODIFIER_KEYS.has(key)) return event.key.toLowerCase() === key
  return (
    event.key.toLowerCase() === key
    || (binding.code !== undefined && event.code === binding.code)
  )
}

const NAMED_KEYS: Record<string, string> = {
  esc: "escape",
  escape: "escape",
  space: " ",
  enter: "enter",
  return: "enter",
  tab: "tab",
  del: "delete",
  delete: "delete",
  backspace: "backspace",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
}

/**
 * A chord written the way it reads ("Ctrl+S", "Shift+Alt+N", "F2", "Esc") as
 * a binding to pass to useHotkeys, for components that take a `hotkey` string.
 * A letter or digit also matches by physical position, so "Ctrl+S" works on a
 * Cyrillic layout where that key types "ы". Cmd and Meta read as Ctrl: the
 * bindings treat the two as one.
 */
export function parseCombo(combo: string): HotkeyStep {
  const parts = combo.split("+").map((part) => part.trim()).filter(Boolean)
  const step: HotkeyStep = { key: "" }
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === "ctrl" || lower === "cmd" || lower === "meta" || lower === "⌘") step.ctrl = true
    else if (lower === "shift") step.shift = true
    else if (lower === "alt" || lower === "option" || lower === "⌥") step.alt = true
    else step.key = NAMED_KEYS[lower] ?? lower
  }
  if (/^[a-z]$/.test(step.key)) step.code = `Key${step.key.toUpperCase()}`
  else if (/^\d$/.test(step.key)) step.code = `Digit${step.key}`
  return step
}

/** The keys a binding waits for, in order: one step for a plain binding. */
export function hotkeySteps(binding: HotkeyBinding): HotkeyStep[] {
  const raw = binding.sequence
  if (raw === undefined) {
    if (binding.key === undefined) return []
    const { key, code, ctrl, shift, alt } = binding
    return [{ key, code, ctrl, shift, alt }]
  }
  const list = typeof raw === "string" ? raw.trim().split(/\s+/) : raw
  return list.map((step) => (typeof step === "string" ? { key: step } : step))
}

/**
 * Where a run of presses stands against a binding: "full" when they spell it
 * out, "prefix" when more keys would, otherwise null.
 */
export function sequenceProgress(presses: KeyLike[], binding: HotkeyBinding): "full" | "prefix" | null {
  const steps = hotkeySteps(binding)
  if (!steps.length || presses.length > steps.length) return null
  for (let i = 0; i < presses.length; i++) {
    if (!matchesHotkey(presses[i]!, steps[i]!)) return null
  }
  return presses.length === steps.length ? "full" : "prefix"
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
  /** Where the declaring component sits in the DOM, for the overlay check. */
  host: () => Node | null
}

// Pinned to a global symbol for the same reason as the toast queue: a barrel
// and a deep import must not end up with two registries and two listeners.
const STATE_KEY = Symbol.for("@leavepulse/ui:hotkeys")
type GlobalWithHotkeys = typeof globalThis & {
  [STATE_KEY]?: { mounted: Set<MountedHotkeys>; order: number; listening: boolean }
}
const g = globalThis as GlobalWithHotkeys
const state = (g[STATE_KEY] ??= {
  mounted: shallowReactive(new Set<MountedHotkeys>()),
  order: 0,
  listening: false,
})
const mounted = state.mounted

function inScope(target: EventTarget | null, scope: MountedHotkeys["scope"]): boolean {
  const el = toValue(scope)
  if (!el) return true
  const node = target instanceof Node ? target : null
  return !!node && (el === node || el.contains(node))
}

function topLayer(): Element | null {
  const layers = document.querySelectorAll("[data-dismissable-layer]")
  return layers[layers.length - 1] ?? null
}

function insideOf(entry: MountedHotkeys, layer: Element): boolean {
  const scope = toValue(entry.scope)
  const node = scope ?? entry.host()
  return !!node && layer.contains(node)
}

interface Candidate {
  binding: HotkeyBinding
  event: KeyboardEvent
}

const DEFAULT_TIMEOUT = 1000
const pressed: KeyLike[] = []
let held: Candidate[] = []
let holdTimer: ReturnType<typeof setTimeout> | undefined
const pendingKeys = ref<string[]>([])

/**
 * The keys of a sequence typed so far ("G" after the first key of "g i"),
 * empty when nothing is pending. For a "G…" hint while the next key is awaited.
 */
export const pendingHotkey = computed(() => pendingKeys.value)

function snapshot(event: KeyboardEvent): KeyLike {
  const { key, code, ctrlKey, metaKey, shiftKey, altKey } = event
  return { key, code, ctrlKey, metaKey, shiftKey, altKey }
}

function eligible(event: KeyboardEvent): HotkeyBinding[] {
  const inTextEntry = isTextEntry(event.target)
  const blocker = event.key === "Escape" ? topLayer() : topModalElement()
  const entries = [...mounted].sort(
    (a, b) => Number(toValue(b.priority) || 0) - Number(toValue(a.priority) || 0) || b.order - a.order,
  )
  const out: HotkeyBinding[] = []
  for (const entry of entries) {
    if (toValue(entry.enabled) === false || !inScope(event.target, entry.scope)) continue
    const covered = !!blocker && !insideOf(entry, blocker)
    for (const binding of entry.read()) {
      if (inTextEntry && !binding.allowInInput) continue
      if (event.repeat && binding.repeat === false) continue
      if (covered && !binding.overLayers) continue
      if (binding.when && !binding.when(event)) continue
      out.push(binding)
    }
  }
  return out
}

function run(candidates: Candidate[]): boolean {
  for (const { binding, event } of candidates) {
    if (binding.handler(event) !== false) return true
  }
  return false
}

function resetSequence() {
  clearTimeout(holdTimer)
  holdTimer = undefined
  pressed.length = 0
  held = []
  pendingKeys.value = []
}

function flushHeld() {
  const waiting = held
  resetSequence()
  run(waiting)
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.defaultPrevented) return
  if (pressed.length && MODIFIER_KEYS.has(event.key.toLowerCase())) return
  if (pressed.length && event.key === "Escape") {
    resetSequence()
  }
  const presses = [...pressed, snapshot(event)]
  const bindings = eligible(event)
  const full: Candidate[] = []
  let waitFor = 0
  for (const binding of bindings) {
    const progress = sequenceProgress(presses, binding)
    if (progress === "full") full.push({ binding, event })
    else if (progress === "prefix") waitFor = Math.max(waitFor, binding.timeout ?? DEFAULT_TIMEOUT)
  }
  if (waitFor) {
    clearTimeout(holdTimer)
    pressed.push(snapshot(event))
    held = full
    pendingKeys.value = pressed.map(pressLabel)
    holdTimer = setTimeout(flushHeld, waitFor)
    event.preventDefault()
    return
  }
  if (full.length) {
    resetSequence()
    if (run(full)) {
      event.preventDefault()
      return
    }
  }
  if (pressed.length) {
    flushHeld()
    onKeydown(event)
  }
}

function pressLabel(press: KeyLike): string {
  return chordOf({
    key: press.key,
    ctrl: press.ctrlKey || press.metaKey,
    alt: press.altKey,
    shift: press.shiftKey && press.key.length !== 1,
  })
}

export function useHotkeys(
  bindings: MaybeRefOrGetter<HotkeyBinding[]>,
  options: UseHotkeysOptions = {},
) {
  const instance = getCurrentInstance()
  const entry: MountedHotkeys = {
    read: () => toValue(bindings),
    scope: options.scope,
    enabled: options.enabled,
    priority: options.priority,
    order: ++state.order,
    host: () => {
      const el = instance?.vnode.el
      return el instanceof Node ? el : null
    },
  }
  onMounted(() => {
    mounted.add(entry)
    warnConflicts()
    if (!state.listening) {
      window.addEventListener("keydown", onKeydown)
      window.addEventListener("blur", resetSequence)
      state.listening = true
    }
  })
  onBeforeUnmount(() => {
    mounted.delete(entry)
    if (!mounted.size && state.listening) {
      window.removeEventListener("keydown", onKeydown)
      window.removeEventListener("blur", resetSequence)
      state.listening = false
      resetSequence()
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

function chordOf(step: HotkeyStep): string {
  const key = step.key.toLowerCase()
  const name = KEY_NAMES[key] ?? (key.length === 1 || /^f\d+$/.test(key) ? key.toUpperCase() : step.key)
  return [step.ctrl && "Ctrl", step.alt && "Alt", step.shift && "Shift", name].filter(Boolean).join("+")
}

function comboOf(binding: HotkeyBinding): string {
  return hotkeySteps(binding).map(chordOf).join(" ")
}

/** Identity of the keys a binding answers, for telling two of them apart. */
function signatureOf(binding: HotkeyBinding): string {
  return hotkeySteps(binding)
    .map((step) => {
      const key = step.key.toLowerCase()
      const symbol = key.length === 1 && key === key.toUpperCase()
      const shift = step.shift === undefined && symbol ? "*" : String(Boolean(step.shift))
      return `${Boolean(step.ctrl)}:${Boolean(step.alt)}:${shift}:${key}`
    })
    .join(" ")
}

export interface HotkeyConflict {
  /** The keys both answer, written as in the shortcut reference. */
  combo: string
  /** `help` labels of the clashing bindings; unlabelled ones are omitted. */
  labels: string[]
  priority: number
}

/**
 * Pure part of `hotkeyConflicts`: bindings from different `useHotkeys` calls
 * answering the same keys at the same priority within the same scope. Within
 * one call a repeat is deliberate (the first may decline), and a binding with
 * `when` is conditional by design, so neither counts.
 */
export function findHotkeyConflicts(
  groups: { bindings: HotkeyBinding[]; priority: number; scope: unknown }[],
): HotkeyConflict[] {
  const scopeIds = new Map<unknown, number>()
  const seen = new Map<string, { combo: string; labels: string[]; owners: Set<number>; priority: number }>()
  groups.forEach((group, owner) => {
    if (!scopeIds.has(group.scope)) scopeIds.set(group.scope, scopeIds.size)
    for (const binding of group.bindings) {
      if (binding.when || !hotkeySteps(binding).length) continue
      const id = `${group.priority}|${scopeIds.get(group.scope)}|${signatureOf(binding)}`
      const slot = seen.get(id) ?? {
        combo: binding.help?.combo ?? comboOf(binding),
        labels: [],
        owners: new Set<number>(),
        priority: group.priority,
      }
      slot.owners.add(owner)
      if (binding.help && !slot.labels.includes(binding.help.label)) slot.labels.push(binding.help.label)
      seen.set(id, slot)
    }
  })
  return [...seen.values()]
    .filter((slot) => slot.owners.size > 1)
    .map(({ combo, labels, priority }) => ({ combo, labels, priority }))
}

/** Bindings among the mounted ones that answer the same keys. */
export const hotkeyConflicts = computed<HotkeyConflict[]>(() =>
  findHotkeyConflicts(
    [...mounted]
      .filter((entry) => toValue(entry.enabled) !== false)
      .map((entry) => ({
        bindings: entry.read(),
        priority: Number(toValue(entry.priority) || 0),
        scope: toValue(entry.scope) ?? null,
      })),
  ),
)

const warned = new Set<string>()

declare const process: { env: { NODE_ENV?: string } }

/*
 * Written as the literal `process.env.NODE_ENV` so the consumer's bundler
 * replaces it (Vite and webpack both do for dependencies); where nothing
 * replaces it and no `process` exists, the warning simply stays off.
 */
function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== "production"
  } catch {
    return false
  }
}

function warnConflicts() {
  if (!isDev()) return
  for (const conflict of hotkeyConflicts.value) {
    const id = `${conflict.priority}|${conflict.combo}`
    if (warned.has(id)) continue
    warned.add(id)
    console.warn(
      `[@leavepulse/ui] ${conflict.combo} is bound more than once at priority ${conflict.priority}`
        + (conflict.labels.length ? ` (${conflict.labels.join(", ")})` : "")
        + "; only the most recently mounted one runs unless it declines.",
    )
  }
}

/**
 * The shortcuts that work right now, grouped for `LpShortcutsDialog`: every
 * binding with `help` from every mounted `useHotkeys`. A screen that binds its
 * own keys adds its section while it is open, so the reference never lists a
 * key that does nothing here or misses one that does.
 */
export const activeShortcuts = computed<ShortcutGroup[]>(() => {
  const groups = new Map<string, ShortcutEntry[]>()
  const clashing = new Set(hotkeyConflicts.value.map((c) => c.combo))
  for (const entry of mounted) {
    if (toValue(entry.enabled) === false) continue
    for (const binding of entry.read()) {
      if (!binding.help) continue
      const combo = binding.help.combo ?? comboOf(binding)
      const entries = groups.get(binding.help.group) ?? []
      const conflict = clashing.has(combo) || undefined
      if (!entries.some((e) => e.combo === combo)) entries.push({ combo, label: binding.help.label, conflict })
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
