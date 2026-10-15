import { onBeforeUnmount, onMounted, ref, type MaybeRefOrGetter, toValue } from "vue"
import { focusableIn, nextInDirection, type Direction } from "./spatialNav"

/*
 * A game controller driving the interface: the D-pad and the left stick move
 * focus to the nearest control in that direction, A presses it, B backs out
 * (closing the open dialog first), the bumpers and Start are the app's to
 * use, and the right stick scrolls whatever the focus sits in. Uses the
 * Gamepad API's standard mapping, which Chromium (desktop and Android web
 * views) and Firefox give the common pads.
 *
 * While a controller is in use the root carries `data-input="gamepad"`, so
 * focus can be drawn more boldly than for a mouse; touching the mouse, the
 * screen or the keyboard takes it off again.
 */

export interface UseGamepadNavOptions {
  enabled?: MaybeRefOrGetter<boolean>
  /** B with no dialog open: go back, as a browser's back would. */
  onBack?: () => void
  /** Left and right bumpers: the previous and next section, tab or page. */
  onPrevious?: () => void
  onNext?: () => void
  /** Start (the menu button): a menu or search, say. */
  onMenu?: () => void
}

/** Standard-mapping button indices (W3C Gamepad, "standard" layout). */
const BUTTON = { a: 0, b: 1, lb: 4, rb: 5, start: 9, up: 12, down: 13, left: 14, right: 15 } as const

/** How far a stick goes before it counts as a direction. */
const STICK_THRESHOLD = 0.55
/** Held, a direction repeats after this long, then every REPEAT_MS. */
const REPEAT_DELAY_MS = 380
const REPEAT_MS = 110
/** Pixels the right stick scrolls per frame at full tilt. */
const SCROLL_SPEED = 18

const OPEN_DIALOG = "[role=dialog][data-state=open], [role=alertdialog][data-state=open], [role=menu][data-state=open], [role=listbox][data-state=open]"

export function useGamepadNav(options: UseGamepadNavOptions = {}) {
  /** A controller is connected. */
  const connected = ref(false)
  let frame = 0
  const held = new Map<string, number>()

  function enabled() {
    return options.enabled === undefined ? true : toValue(options.enabled)
  }

  /** Where focus moves: the open dialog or menu on top, else the page. */
  function scope(): ParentNode {
    const layers = document.querySelectorAll<HTMLElement>(OPEN_DIALOG)
    return layers[layers.length - 1] ?? document.body
  }

  function markGamepad() {
    document.documentElement.dataset.input = "gamepad"
  }

  function focus(element: HTMLElement) {
    // Focus placed by code gets no :focus-visible; the kit's own marker for
    // moved focus draws the ring, and goes with the focus.
    element.setAttribute("data-lp-focus-ring", "")
    element.addEventListener("blur", () => element.removeAttribute("data-lp-focus-ring"), { once: true })
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

  function move(direction: Direction) {
    const candidates = focusableIn(scope())
    if (!candidates.length) return
    const current = document.activeElement as HTMLElement | null
    if (!current || !candidates.includes(current)) {
      focus(candidates[0]!)
      return
    }
    const others = candidates.filter((element) => element !== current)
    const next = nextInDirection(
      current.getBoundingClientRect(),
      others.map((element) => element.getBoundingClientRect()),
      direction,
    )
    if (next >= 0) focus(others[next]!)
  }

  function press() {
    const current = document.activeElement as HTMLElement | null
    if (!current || current === document.body) return
    if (current.matches("input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]")) {
      current.focus()
      return
    }
    current.click()
  }

  function back() {
    if (document.querySelector(OPEN_DIALOG)) {
      // The dialog libraries close on Escape; a synthetic one reaches them
      // the way the key would.
      const target = (document.activeElement as HTMLElement | null) ?? document.body
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }))
      return
    }
    options.onBack?.()
  }

  /** Fires `act` on a press, and again on a repeat schedule while held. */
  function edge(key: string, down: boolean, now: number, act: () => void, repeats: boolean) {
    const since = held.get(key)
    if (!down) {
      held.delete(key)
      return
    }
    if (since === undefined) {
      held.set(key, now)
      act()
      return
    }
    if (repeats && now - since >= REPEAT_DELAY_MS) {
      held.set(key, now - REPEAT_DELAY_MS + REPEAT_MS)
      act()
    }
  }

  function scrollBy(dx: number, dy: number) {
    let element = document.activeElement as HTMLElement | null
    while (element && element !== document.body) {
      const style = getComputedStyle(element)
      if (/(auto|scroll)/.test(style.overflowY + style.overflowX) && element.scrollHeight > element.clientHeight) break
      element = element.parentElement
    }
    ;(element && element !== document.body ? element : document.scrollingElement)?.scrollBy(dx, dy)
  }

  function poll(now: number) {
    frame = requestAnimationFrame(poll)
    if (!enabled() || document.hidden) return
    const pad = [...navigator.getGamepads()].find((entry) => entry?.connected && entry.mapping === "standard")
    if (!pad) return
    const pressed = (index: number) => pad.buttons[index]?.pressed ?? false
    const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes
    const before = held.size
    edge("up", pressed(BUTTON.up) || ly < -STICK_THRESHOLD, now, () => move("up"), true)
    edge("down", pressed(BUTTON.down) || ly > STICK_THRESHOLD, now, () => move("down"), true)
    edge("left", pressed(BUTTON.left) || lx < -STICK_THRESHOLD, now, () => move("left"), true)
    edge("right", pressed(BUTTON.right) || lx > STICK_THRESHOLD, now, () => move("right"), true)
    edge("a", pressed(BUTTON.a), now, press, false)
    edge("b", pressed(BUTTON.b), now, back, false)
    edge("lb", pressed(BUTTON.lb), now, () => options.onPrevious?.(), false)
    edge("rb", pressed(BUTTON.rb), now, () => options.onNext?.(), false)
    edge("start", pressed(BUTTON.start), now, () => options.onMenu?.(), false)
    const scrollX = Math.abs(rx) > 0.2 ? rx * SCROLL_SPEED : 0
    const scrollY = Math.abs(ry) > 0.2 ? ry * SCROLL_SPEED : 0
    if (scrollX || scrollY) scrollBy(scrollX, scrollY)
    if (held.size > before || scrollX || scrollY) markGamepad()
  }

  function onConnect() {
    connected.value = [...navigator.getGamepads()].some((entry) => entry?.connected)
    cancelAnimationFrame(frame)
    if (connected.value) frame = requestAnimationFrame(poll)
  }

  function onOtherInput(event: Event) {
    // Our own Escape for B is synthetic; only a real key or touch hands over.
    if (!event.isTrusted) return
    if (document.documentElement.dataset.input === "gamepad") delete document.documentElement.dataset.input
  }

  onMounted(() => {
    if (typeof navigator === "undefined" || !("getGamepads" in navigator)) return
    window.addEventListener("gamepadconnected", onConnect)
    window.addEventListener("gamepaddisconnected", onConnect)
    window.addEventListener("pointerdown", onOtherInput, { capture: true, passive: true })
    window.addEventListener("keydown", onOtherInput, { capture: true, passive: true })
    onConnect()
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    window.removeEventListener("gamepadconnected", onConnect)
    window.removeEventListener("gamepaddisconnected", onConnect)
    window.removeEventListener("pointerdown", onOtherInput, { capture: true })
    window.removeEventListener("keydown", onOtherInput, { capture: true })
  })

  return { connected }
}
