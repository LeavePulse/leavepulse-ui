import { defineComponent, type Component } from "vue"
import {
  pendingHotkey,
  useGamepadNav,
  useHotkeys,
} from "../../../src"

export interface ComponentEntry {
  id: string
  name: string
  description: string
  /** Editable Vue template for the live example. */
  template: string
  /** A small static template for the index card: the component's look at a glance, no interaction needed. Rendered with the entry's components and state. */
  thumb?: string
  /** The thumb does not use `state`, and making it has side effects (timers, a hint system): skip it on the index. */
  thumbState?: false
  /**
   * Plays the thumb: every `every` ms the next frame's values are written over
   * the thumb's scope, so a thumb that binds them (`:model-value="view"`) shows
   * the component doing what it is for, a Swap trading views, tabs moving
   * their pill. The first frame is the still one: it is what a card shows
   * before it is on screen and under reduced motion.
   */
  thumbLoop?: { every?: number; frames: Record<string, unknown>[] }
  /** Components in scope for the template. */
  components: Record<string, Component>
  /** Reactive state the template can bind to. */
  state?: () => Record<string, unknown>
}

/*
 * Stands in for a screen with keys of its own: while it is mounted, its
 * bindings are in the live reference, and they leave with it.
 */
export const EditorKeys = defineComponent({
  setup() {
    useHotkeys([
      { key: "z", code: "KeyZ", ctrl: true, help: { group: "Editor", label: "Undo" }, handler: () => {} },
      { key: "z", code: "KeyZ", ctrl: true, shift: true, help: { group: "Editor", label: "Redo" }, handler: () => {} },
      { key: "a", code: "KeyA", ctrl: true, help: { group: "Editor", label: "Select all" }, handler: () => {} },
    ])
    return () => null
  },
})

// Sequences next to a single-key binding on their own first key: "g" alone
// waits for the timeout, "g i" and "g s" run at once. The duplicate Ctrl+S
// shows the conflict marker in the live reference.
export const SequenceKeys = defineComponent({
  emits: ["fired"],
  setup(_, { emit }) {
    useHotkeys([
      { sequence: [{ key: "g", code: "KeyG" }, { key: "i", code: "KeyI" }], help: { group: "Go to", label: "Inbox" }, handler: () => emit("fired", "Inbox") },
      { sequence: [{ key: "g", code: "KeyG" }, { key: "s", code: "KeyS" }], help: { group: "Go to", label: "Settings" }, handler: () => emit("fired", "Settings") },
      { key: "g", code: "KeyG", help: { group: "Go to", label: "Top of the page" }, handler: () => emit("fired", "Top") },
      { key: "s", code: "KeyS", ctrl: true, help: { group: "Editor", label: "Save draft" }, handler: () => emit("fired", "Save draft") },
    ])
    return () => null
  },
})

/*
 * Turns controller navigation on while it is mounted and says whether a pad
 * is connected; B with nothing open, and the bumpers, report what they did.
 */
export const GamepadNav = defineComponent({
  emits: ["fired"],
  setup(_, { emit }) {
    const { connected } = useGamepadNav({
      onBack: () => emit("fired", "Back"),
      onPrevious: () => emit("fired", "Previous section"),
      onNext: () => emit("fired", "Next section"),
      onMenu: () => emit("fired", "Menu"),
    })
    return () => (connected.value ? "Controller connected" : "No controller: connect one and press a button")
  },
})

export const PendingKeys = defineComponent({
  setup() {
    return () => (pendingHotkey.value.length ? `${pendingHotkey.value.join(" ")}…` : "")
  },
})

export const SaveKeys = defineComponent({
  emits: ["fired"],
  setup(_, { emit }) {
    useHotkeys([{ key: "s", code: "KeyS", ctrl: true, help: { group: "Editor", label: "Save" }, handler: () => emit("fired", "Save") }])
    return () => null
  },
})

export const selectOpts = [
  { value: "eu", label: "Europe" },
  { value: "na", label: "North America" },
  { value: "asia", label: "Asia" },
]
export const radioOpts = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
]
export const tabItems = [
  { value: "a", label: "Overview", icon: "lucide:layout-dashboard" },
  { value: "b", label: "Settings", icon: "lucide:settings" },
]
export const bottomTabItems = [
  { value: "home", label: "Home", icon: "lucide:house" },
  { value: "inbox", label: "Inbox", icon: "lucide:inbox", dot: true },
  { value: "search", label: "Search", icon: "lucide:search" },
  { value: "settings", label: "Settings", icon: "lucide:settings" },
]
