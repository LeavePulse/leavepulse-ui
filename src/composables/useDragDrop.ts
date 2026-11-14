import { MOUSE_SLOP } from "./gesture"
import { nextTick, readonly, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import { useDragPress } from "./dragPress"
import { durationToken, prefersReducedMotion } from "./easing"
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
 * A drop that the page shows by the next tick (move the item in local state,
 * then save) animates: the item flies in from where it was let go and the
 * items it pushed aside slide to their new places.
 *
 * `root` may render after the page mounts (a board behind a loader): the
 * listeners follow it.
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

const NO_DRAG = "button, a, input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-drag]"

interface Drag<I, Z> {
  key: string
  item: I
  from: Z | undefined
  source: HTMLElement
  ghost: HTMLElement
  dx: number
  dy: number
  over: HTMLElement | null
}

export function useDragDrop<I = string, Z = string>(options: UseDragDropOptions<I, Z>) {
  const toItem = options.item ?? ((raw: string) => raw as unknown as I)
  const toZone = options.zone ?? ((raw: string) => raw as unknown as Z)
  const enabled = () => toValue(options.enabled) ?? true
  const hostWindow = (): Window => (options.root.value ? nodeWindow(options.root.value) : window)

  let drag: Drag<I, Z> | null = null
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

  function begin(el: HTMLElement, x: number, y: number): boolean {
    const item = toItem(el.dataset.dragKey ?? "")
    if (item === undefined) return false
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
      key: el.dataset.dragKey ?? "",
      item,
      from: fromZone ? toZone(fromZone.dataset.dropZone ?? "") : undefined,
      source: el,
      ghost,
      dx: x - box.left,
      dy: y - box.top,
      over: null,
    }
    el.setAttribute("data-drag-source", "")
    dragging.value = item
    follow(x, y)
    return true
  }

  function follow(x: number, y: number) {
    if (!drag) return
    drag.ghost.style.left = `${x - drag.dx}px`
    drag.ghost.style.top = `${y - drag.dy}px`
    drag.ghost.style.width = `${drag.source.getBoundingClientRect().width}px`
    const zoneEl = zoneOf(drag.source.ownerDocument.elementFromPoint(x, y))
    const zone = accepts(zoneEl)
    const target = zone === undefined ? null : zoneEl
    if (target !== drag.over) {
      drag.over?.removeAttribute("data-drop-over")
      target?.setAttribute("data-drop-over", "")
      drag.over = target
      over.value = zone ?? null
    }
  }

  function finish(drop: boolean) {
    const done = drag
    if (!done) return
    drag = null
    done.over?.removeAttribute("data-drop-over")
    done.source.removeAttribute("data-drag-source")
    dragging.value = null
    over.value = null
    const zone = drop && done.over ? toZone(done.over.dataset.dropZone ?? "") : undefined
    if (zone === undefined) return settle(done)
    const before = boxes()
    const landing = done.ghost.getBoundingClientRect()
    options.onDrop(done.item, zone, done.from)
    void nextTick(() => {
      done.ghost.remove()
      glide(before, done.key, landing)
    })
  }

  function items(): HTMLElement[] {
    return [...(options.root.value?.querySelectorAll<HTMLElement>("[data-drag-key]") ?? [])]
  }

  function boxes(): Map<string, DOMRect> {
    return new Map(items().map((el) => [el.dataset.dragKey ?? "", el.getBoundingClientRect()]))
  }

  // FLIP: every item the drop moved (the dropped one from where it was let go,
  // its neighbours from where they stood) eases into its new place instead of
  // jumping. Needs the page to show the drop by the next tick: move the item
  // in local state first, then save.
  function glide(before: Map<string, DOMRect>, dropped: string, landing: DOMRect) {
    if (prefersReducedMotion(hostWindow())) return
    const ms = durationToken("duration-medium", undefined, options.root.value?.ownerDocument)
    for (const el of items()) {
      const key = el.dataset.dragKey ?? ""
      const from = key === dropped ? landing : before.get(key)
      if (!from) continue
      const now = el.getBoundingClientRect()
      const dx = from.left - now.left
      const dy = from.top - now.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      el.style.transition = "none"
      el.style.transform = `translate(${dx}px, ${dy}px)`
      void el.offsetWidth
      el.style.transition = `transform ${ms}ms var(--ease-emphasized)`
      el.style.transform = ""
      setTimeout(() => {
        if (!el.style.transform) el.style.transition = ""
      }, ms)
    }
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

  const press = useDragPress({ root: options.root, move: follow, end: finish, escape: true })

  function onPointerDown(event: PointerEvent) {
    if (!enabled()) return
    const target = event.target as Element | null
    const el = target?.closest<HTMLElement>("[data-drag-key]")
    if (!el || !options.root.value?.contains(el)) return
    const control = target?.closest(NO_DRAG)
    if (control && el.contains(control)) return
    press.start(event, (x, y) => begin(el, x, y), { slop: MOUSE_SLOP })
  }

  watch(
    options.root,
    (el, _, onCleanup) => {
      if (!el) return
      el.addEventListener("pointerdown", onPointerDown)
      onCleanup(() => el.removeEventListener("pointerdown", onPointerDown))
    },
    { immediate: true, flush: "post" },
  )

  return { dragging: readonly(dragging), over: readonly(over) }
}
