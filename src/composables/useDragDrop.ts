import { HOLD_TO_DRAG_MS, MOUSE_SLOP, TOUCH_SLOP } from "./gesture"
import { onBeforeUnmount, onMounted, readonly, ref, toValue, type MaybeRefOrGetter, type Ref } from "vue"
import { durationToken, prefersReducedMotion } from "./easing"
import { scrollParent } from "./scroll"
import { nodeWindow } from "./useView"

/*
 * Moving things between places by dragging them: a person from one team to
 * another, a card to another column, a row back to the pool. The page marks
 * what can be picked up with `data-drag-key` and where it can land with
 * `data-drop-zone`; this composable does the rest and reports a drop as
 * (item, zone, from).
 *
 *   const dnd = useDragDrop({ root, onDrop: (item, zone) => move(item, zone) })
 *   <div ref="root">
 *     <section data-drop-zone="team-a"><div data-drag-key="u1">Ada</div></section>
 *     <section data-drop-zone="pool" />
 *   </div>
 *
 * A mouse or pen starts dragging once it moves a few pixels, so a click on the
 * item stays a click. A finger holds still for HOLD_TO_DRAG_MS first, so a
 * swipe through the list still scrolls it, and the long press does not open
 * the context menu once it has turned into a drag. Controls inside an item
 * (buttons, links, fields, `data-no-drag`) never start one.
 *
 * While dragging, a copy of the item follows the pointer, the item itself
 * carries `data-drag-source` and the zone under the pointer `data-drop-over`,
 * for styling (`data-[drop-over]:border-brand`). Near the edge of the
 * scrolling box the page scrolls on its own. A drop on the zone the item came
 * from, on a zone `canDrop` refuses or outside every zone is no drop: the copy
 * glides back. Escape cancels.
 *
 * Dragging is a shortcut, never the only way: whatever a drop does should also
 * be reachable from a menu or a button, for the keyboard and screen readers.
 */
export interface UseDragDropOptions<I, Z> {
  /** The element that holds the items and the zones. */
  root: Ref<HTMLElement | null>
  /** Turn dragging off without unmounting (e.g. read-only). */
  enabled?: MaybeRefOrGetter<boolean>
  /** Map an item's `data-drag-key` to the item. Defaults to the string itself. */
  item?: (raw: string) => I | undefined
  /** Map a zone's `data-drop-zone` to the zone. Defaults to the string itself. */
  zone?: (raw: string) => Z | undefined
  /** Whether this item may land in this zone; a refused zone is not highlighted. */
  canDrop?: (item: I, zone: Z) => boolean
  /** The item landed in a zone other than the one it came from. */
  onDrop: (item: I, zone: Z, from: Z | undefined) => void
}

const EDGE_PX = 48
const SCROLL_STEP = 14
const NO_DRAG = "button, a, input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-drag]"

interface Drag<I, Z> {
  item: I
  from: Z | undefined
  source: HTMLElement
  ghost: HTMLElement
  dx: number
  dy: number
  x: number
  y: number
  over: HTMLElement | null
  scroller: HTMLElement | null
}

interface Pending {
  el: HTMLElement
  pointerId: number
  x: number
  y: number
  touch: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export function useDragDrop<I = string, Z = string>(options: UseDragDropOptions<I, Z>) {
  const toItem = options.item ?? ((raw: string) => raw as unknown as I)
  const toZone = options.zone ?? ((raw: string) => raw as unknown as Z)
  const enabled = () => toValue(options.enabled) ?? true
  const hostWindow = (): Window => (options.root.value ? nodeWindow(options.root.value) : window)

  let drag: Drag<I, Z> | null = null
  let pending: Pending | null = null
  let swallowClick = false
  let frame = 0
  const dragging = ref<I | null>(null) as Ref<I | null>
  const over = ref<Z | null>(null) as Ref<Z | null>

  function zoneOf(el: Element | null): HTMLElement | null {
    const zone = el?.closest<HTMLElement>("[data-drop-zone]") ?? null
    return zone && options.root.value?.contains(zone) ? zone : null
  }

  function accepts(zoneEl: HTMLElement | null): Z | undefined {
    if (!zoneEl || !drag) return undefined
    const zone = toZone(zoneEl.dataset.dropZone ?? "")
    if (zone === undefined || zone === drag.from) return undefined
    return !options.canDrop || options.canDrop(drag.item, zone) ? zone : undefined
  }

  function cancelPending() {
    if (pending?.timer) clearTimeout(pending.timer)
    pending = null
  }

  function begin(el: HTMLElement, x: number, y: number) {
    const item = toItem(el.dataset.dragKey ?? "")
    if (item === undefined) return
    const box = el.getBoundingClientRect()
    const ghost = el.cloneNode(true) as HTMLElement
    ghost.removeAttribute("data-drag-key")
    ghost.removeAttribute("id")
    ghost.setAttribute("aria-hidden", "true")
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: "0",
      pointerEvents: "none",
      zIndex: "var(--z-tooltip)",
      boxShadow: "var(--shadow-panel)",
      opacity: "0.95",
      transform: "translate3d(0, 0, 0) scale(1.02)",
      transition: "none",
    })
    el.ownerDocument.body.append(ghost)
    const fromZone = zoneOf(el)
    drag = {
      item,
      from: fromZone ? toZone(fromZone.dataset.dropZone ?? "") : undefined,
      source: el,
      ghost,
      dx: x - box.left,
      dy: y - box.top,
      x,
      y,
      over: null,
      scroller: scrollParent(options.root.value),
    }
    el.setAttribute("data-drag-source", "")
    dragging.value = item
    hostWindow().getSelection()?.removeAllRanges()
    if (options.root.value) options.root.value.style.userSelect = "none"
    follow()
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function follow() {
    if (!drag) return
    const box = drag.source.getBoundingClientRect()
    drag.ghost.style.left = `${drag.x - drag.dx}px`
    drag.ghost.style.top = `${drag.y - drag.dy}px`
    drag.ghost.style.width = `${box.width}px`
    const zoneEl = zoneOf(drag.source.ownerDocument.elementFromPoint(drag.x, drag.y))
    const zone = accepts(zoneEl)
    const target = zone === undefined ? null : zoneEl
    if (target !== drag.over) {
      drag.over?.removeAttribute("data-drop-over")
      target?.setAttribute("data-drop-over", "")
      drag.over = target
      over.value = zone ?? null
    }
  }

  function tick() {
    frame = 0
    if (!drag) return
    const box = drag.scroller?.getBoundingClientRect() ?? { top: 0, bottom: hostWindow().innerHeight }
    const delta = drag.y > box.bottom - EDGE_PX ? SCROLL_STEP : drag.y < box.top + EDGE_PX ? -SCROLL_STEP : 0
    if (delta) {
      if (drag.scroller) drag.scroller.scrollTop += delta
      else hostWindow().scrollBy(0, delta)
      follow()
    }
    frame = requestAnimationFrame(tick)
  }

  function finish(drop: boolean) {
    cancelPending()
    const done = drag
    if (!done) return
    drag = null
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (options.root.value) options.root.value.style.userSelect = ""
    done.over?.removeAttribute("data-drop-over")
    done.source.removeAttribute("data-drag-source")
    dragging.value = null
    over.value = null
    swallowClick = true
    setTimeout(() => (swallowClick = false), 0)
    const zone = drop && done.over ? toZone(done.over.dataset.dropZone ?? "") : undefined
    if (zone !== undefined) {
      done.ghost.remove()
      options.onDrop(done.item, zone, done.from)
      return
    }
    settle(done)
  }

  // A drag that landed nowhere glides back to where the item still is.
  function settle(done: Drag<I, Z>) {
    if (prefersReducedMotion(hostWindow()) || !done.source.isConnected) {
      done.ghost.remove()
      return
    }
    const home = done.source.getBoundingClientRect()
    const ghost = done.ghost
    const ms = durationToken("duration-medium", undefined, done.source.ownerDocument)
    ghost.style.transition = `left ${ms}ms var(--ease-emphasized), top ${ms}ms var(--ease-emphasized), opacity ${ms}ms ease-out`
    ghost.style.left = `${home.left}px`
    ghost.style.top = `${home.top}px`
    ghost.style.opacity = "0"
    setTimeout(() => ghost.remove(), ms)
  }

  function onPointerDown(event: PointerEvent) {
    if (!enabled() || event.button !== 0 || drag) return
    const target = event.target as Element | null
    const el = target?.closest<HTMLElement>("[data-drag-key]")
    if (!el || !options.root.value?.contains(el)) return
    const control = target?.closest(NO_DRAG)
    if (control && el.contains(control)) return
    cancelPending()
    const touch = event.pointerType === "touch"
    pending = { el, pointerId: event.pointerId, x: event.clientX, y: event.clientY, touch, timer: null }
    if (!touch) return
    const { clientX: x, clientY: y } = event
    pending.timer = setTimeout(() => {
      if (!pending) return
      const held = pending.el
      pending = null
      begin(held, x, y)
      navigator.vibrate?.(8)
    }, HOLD_TO_DRAG_MS)
  }

  function onMove(event: PointerEvent) {
    if (pending && event.pointerId === pending.pointerId) {
      const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
      if (pending.touch) {
        if (moved > TOUCH_SLOP) cancelPending()
        return
      }
      if (moved <= MOUSE_SLOP) return
      const { el, x, y } = pending
      pending = null
      begin(el, x, y)
    }
    if (!drag) return
    drag.x = event.clientX
    drag.y = event.clientY
    follow()
  }

  function onUp() {
    cancelPending()
    finish(true)
  }

  function onCancel() {
    cancelPending()
    finish(false)
  }

  function onKey(event: KeyboardEvent) {
    if (event.key !== "Escape" || !drag) return
    event.preventDefault()
    event.stopPropagation()
    finish(false)
  }

  function onClickCapture(event: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    event.stopPropagation()
    event.preventDefault()
  }

  // A long press is also how a finger asks for the context menu; once it has
  // turned into a drag, that menu would open over it.
  function onContextMenu(event: Event) {
    if (!drag && !swallowClick) return
    event.preventDefault()
    event.stopPropagation()
  }

  // A finger that has started dragging must not scroll the page under it.
  function onTouchMove(event: TouchEvent) {
    if (drag) event.preventDefault()
  }

  // The browser's own drag of a link or an image would take over the pointer.
  function onNativeDrag(event: DragEvent) {
    if (pending || drag) event.preventDefault()
  }

  let listening: Window | null = null
  let rootEl: HTMLElement | null = null
  onMounted(() => {
    listening = hostWindow()
    rootEl = options.root.value
    rootEl?.addEventListener("pointerdown", onPointerDown)
    rootEl?.addEventListener("touchmove", onTouchMove, { passive: false })
    rootEl?.addEventListener("dragstart", onNativeDrag)
    listening.addEventListener("pointermove", onMove)
    listening.addEventListener("pointerup", onUp)
    listening.addEventListener("pointercancel", onCancel)
    listening.addEventListener("keydown", onKey, true)
    listening.addEventListener("click", onClickCapture, true)
    listening.addEventListener("contextmenu", onContextMenu, true)
  })
  onBeforeUnmount(() => {
    finish(false)
    swallowClick = false
    rootEl?.removeEventListener("pointerdown", onPointerDown)
    rootEl?.removeEventListener("touchmove", onTouchMove)
    rootEl?.removeEventListener("dragstart", onNativeDrag)
    listening?.removeEventListener("pointermove", onMove)
    listening?.removeEventListener("pointerup", onUp)
    listening?.removeEventListener("pointercancel", onCancel)
    listening?.removeEventListener("keydown", onKey, true)
    listening?.removeEventListener("click", onClickCapture, true)
    listening?.removeEventListener("contextmenu", onContextMenu, true)
  })

  return { dragging: readonly(dragging), over: readonly(over) }
}
