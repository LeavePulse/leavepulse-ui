import { HOLD_TO_DRAG_MS, MOUSE_SLOP } from "./gesture"
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
 * the context menu once it has turned into a drag. With `hold` every pointer
 * holds first: items in a row a mouse drags sideways to scroll (LpScrollStrip)
 * move on a held press, and a press that moves at once scrolls the row. Controls inside an item
 * (buttons, links, fields, `data-no-drag`) never start one.
 *
 * While dragging, a copy of the item follows the pointer, the item itself
 * carries `data-drag-source` and the zone under the pointer `data-drop-over`,
 * for styling (`data-[drop-over]:border-brand`). Near the edge of the
 * scrolling box the page scrolls on its own. A drop on the zone the item came
 * from, on a zone `canDrop` refuses or outside every zone is no drop: the copy
 * glides back. Escape cancels.
 *
 * Order: a zone with `data-drop-sort` (`="x"` for a row) keeps its items in
 * order. The kit works out the gap under the pointer, draws a line there, lets
 * an item move within its own zone, and reports the drop with
 * `{ before }`: the item it lands in front of, or `null` for the end.
 * Zones nest: when the inner zone under the pointer refuses the item (a
 * category over a list of channels), the zone around it is asked next.
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
  /**
   * Hold still before a drag starts, a mouse and pen too: true for
   * HOLD_TO_DRAG_MS, or a time in ms. Default: only a finger holds.
   */
  hold?: MaybeRefOrGetter<boolean | number | undefined>
  /** Map an item's `data-drag-key` to the item. Defaults to the string itself. */
  item?: (raw: string) => I | undefined
  /** Map a zone's `data-drop-zone` to the zone. Defaults to the string itself. */
  zone?: (raw: string) => Z | undefined
  /** Whether this item may land in this zone; a refused zone is not highlighted. */
  canDrop?: (item: I, zone: Z) => boolean
  /**
   * The item landed. `before` is the item it lands in front of in a sorted zone
   * (`data-drop-sort`), `null` for the end or for a zone without order.
   */
  onDrop: (item: I, zone: Z, from: Z | undefined, place: DropPlace<I>) => void
}

export interface DropPlace<I> {
  before: I | null
}

const NO_DRAG = "button, a, input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-no-drag]"

interface Spot {
  zone: HTMLElement
  before: HTMLElement | null
}

interface Drag<I, Z> {
  key: string
  next: string | null
  item: I
  from: Z | undefined
  fromKey: string | null
  source: HTMLElement
  ghost: HTMLElement
  dx: number
  dy: number
  over: Spot | null
  line: HTMLElement
}

export function useDragDrop<I = string, Z = string>(options: UseDragDropOptions<I, Z>) {
  const toItem = options.item ?? ((raw: string) => raw as unknown as I)
  const toZone = options.zone ?? ((raw: string) => raw as unknown as Z)
  const enabled = () => toValue(options.enabled) ?? true
  const hostWindow = (): Window => (options.root.value ? nodeWindow(options.root.value) : window)

  let drag: Drag<I, Z> | null = null
  const dragging = ref<I | null>(null) as Ref<I | null>
  const over = ref<Z | null>(null) as Ref<Z | null>

  function zoneOf(el: Element | null | undefined): HTMLElement | null {
    const zone = el?.closest<HTMLElement>("[data-drop-zone]") ?? null
    return zone && options.root.value?.contains(zone) ? zone : null
  }

  // The items that belong to a zone itself, not to a zone nested in it.
  function itemsOf(zone: HTMLElement): HTMLElement[] {
    return [...zone.querySelectorAll<HTMLElement>("[data-drag-key]")].filter((el) => zoneOf(el.parentElement) === zone)
  }

  function spotIn(zone: HTMLElement, x: number, y: number): Spot {
    if (!("dropSort" in zone.dataset) || !drag) return { zone, before: null }
    const across = zone.dataset.dropSort === "x"
    const before = itemsOf(zone).find((el) => {
      if (el === drag?.source) return false
      const box = el.getBoundingClientRect()
      return across ? x < box.left + box.width / 2 : y < box.top + box.height / 2
    })
    return { zone, before: before ?? null }
  }

  function accepts(spot: Spot): Z | undefined {
    if (!drag) return undefined
    const zone = toZone(spot.zone.dataset.dropZone ?? "")
    if (zone === undefined) return undefined
    if (spot.zone.dataset.dropZone === drag.fromKey) {
      if (!("dropSort" in spot.zone.dataset)) return undefined
      if ((spot.before?.dataset.dragKey ?? null) === drag.next) return undefined
    }
    return !options.canDrop || options.canDrop(drag.item, zone) ? zone : undefined
  }

  // The innermost zone under the pointer that takes the item: a channel list
  // refuses a category, and the category list around it takes it instead.
  function spotAt(x: number, y: number): Spot | null {
    if (!drag) return null
    let zone = zoneOf(drag.source.ownerDocument.elementFromPoint(x, y))
    while (zone) {
      const spot = spotIn(zone, x, y)
      if (accepts(spot) !== undefined) return spot
      zone = zoneOf(zone.parentElement)
    }
    return null
  }

  // Where a sorted zone will put the item: a line in the gap, drawn by the kit.
  function mark(spot: Spot | null) {
    if (!drag) return
    const line = drag.line
    if (!spot || !("dropSort" in spot.zone.dataset)) {
      line.style.opacity = "0"
      return
    }
    const across = spot.zone.dataset.dropSort === "x"
    const rest = itemsOf(spot.zone).filter((el) => el !== drag?.source)
    const at = spot.before ?? rest.at(-1) ?? null
    const box = at?.getBoundingClientRect() ?? spot.zone.getBoundingClientRect()
    const end = !spot.before && !!at
    Object.assign(line.style, across
      ? { left: `${(end ? box.right : box.left) - 2}px`, top: `${box.top}px`, width: "2px", height: `${box.height}px` }
      : { left: `${box.left}px`, top: `${(end ? box.bottom : box.top) - 2}px`, width: `${box.width}px`, height: "2px" })
    line.style.opacity = "1"
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
    const line = el.ownerDocument.createElement("div")
    line.setAttribute("aria-hidden", "true")
    Object.assign(line.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "var(--z-tooltip)",
      borderRadius: "999px",
      background: "var(--color-brand)",
      opacity: "0",
      transition: "opacity 120ms ease-out",
    })
    el.ownerDocument.body.append(line, ghost)
    const fromZone = zoneOf(el.parentElement)
    const siblings = fromZone ? itemsOf(fromZone) : []
    drag = {
      key: el.dataset.dragKey ?? "",
      next: siblings[siblings.indexOf(el) + 1]?.dataset.dragKey ?? null,
      line,
      item,
      from: fromZone ? toZone(fromZone.dataset.dropZone ?? "") : undefined,
      fromKey: fromZone?.dataset.dropZone ?? null,
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
    const spot = spotAt(x, y)
    if (spot?.zone !== drag.over?.zone) {
      drag.over?.zone.removeAttribute("data-drop-over")
      spot?.zone.setAttribute("data-drop-over", "")
      over.value = spot ? (toZone(spot.zone.dataset.dropZone ?? "") ?? null) : null
    }
    drag.over = spot
    mark(spot)
  }

  function finish(drop: boolean) {
    const done = drag
    if (!done) return
    drag = null
    done.line.remove()
    done.over?.zone.removeAttribute("data-drop-over")
    done.source.removeAttribute("data-drag-source")
    dragging.value = null
    over.value = null
    const zone = drop && done.over ? toZone(done.over.zone.dataset.dropZone ?? "") : undefined
    if (zone === undefined || !done.over) return settle(done)
    const ahead = done.over.before?.dataset.dragKey
    const before = boxes()
    const landing = done.ghost.getBoundingClientRect()
    options.onDrop(done.item, zone, done.from, { before: ahead === undefined ? null : (toItem(ahead) ?? null) })
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
    if (control && control !== el && el.contains(control)) return
    const hold = toValue(options.hold)
    press.start(event, (x, y) => begin(el, x, y), {
      slop: MOUSE_SLOP,
      hold: hold === true ? HOLD_TO_DRAG_MS : typeof hold === "number" ? hold : undefined,
    })
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
