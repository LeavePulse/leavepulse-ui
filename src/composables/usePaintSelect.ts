import { toValue, type MaybeRefOrGetter, type Ref } from "vue"
import { useDragPress } from "./dragPress"
import { useHotkeys, type HotkeyHelp } from "./useHotkeys"

/*
 * Paint selection: press on one item's tick and sweep across the others, and
 * every item the pointer passes takes the state the first one is switching
 * to. Starting on an unticked item ticks the run, starting on a ticked one
 * clears it, and sweeping back un-paints what the stroke covered, restoring
 * the items as they were before it. Near the edge of the scrolling box the list
 * scrolls on its own, so a stroke can run past what is visible.
 *
 * Items are found in the DOM by `data-paint-key`, in document order, so the
 * run follows what the user sees (sorted, filtered, collapsed groups skipped).
 * A mouse or pen paints at once. A finger holds still for HOLD_TO_DRAG_MS first, so a
 * swipe through the list still scrolls it.
 *
 * The press itself ticks the first item, so the click the browser sends after
 * the stroke is swallowed before the item's own handler sees it; otherwise the
 * first item would toggle back.
 *
 * `onPointerDown(event, key, { hold })` makes any pointer hold first. That is
 * how a list without visible ticks enters selection: a quick click on the row
 * stays the row's click, a long press selects it and the same press goes on
 * painting.
 */
export interface UsePaintSelectOptions<K> {
  /** The element that holds the items. */
  root: Ref<HTMLElement | null>
  selection: () => readonly K[]
  set: (keys: K[]) => void
  /** Turn painting off without unmounting (e.g. selection mode is off). */
  enabled?: MaybeRefOrGetter<boolean>
  /** Map an item's `data-paint-key` back to its key. Defaults to the string itself. */
  resolve?: (raw: string) => K | undefined
  /** Every key, for Ctrl+A while the focus is inside `root`. Omit to leave Ctrl+A alone. */
  selectAll?: () => K[]
  /** How Ctrl+A is listed in the shortcuts reference. */
  help?: MaybeRefOrGetter<HotkeyHelp | undefined>
}

interface Stroke<K> {
  keys: K[]
  anchor: number
  paint: boolean
  before: Set<K>
  x: number
  y: number
}

export function usePaintSelect<K = string>(options: UsePaintSelectOptions<K>) {
  const resolve = options.resolve ?? ((raw: string) => raw as unknown as K)
  let stroke: Stroke<K> | null = null
  const enabled = () => toValue(options.enabled) ?? true

  function keysInView(): K[] {
    const items = options.root.value?.querySelectorAll<HTMLElement>("[data-paint-key]") ?? []
    const out: K[] = []
    for (const item of items) {
      if (item.offsetParent === null) continue
      const key = resolve(item.dataset.paintKey ?? "")
      if (key !== undefined) out.push(key)
    }
    return out
  }

  function keyAt(x: number, y: number): K | undefined {
    const item = options.root.value?.ownerDocument.elementFromPoint(x, y)?.closest<HTMLElement>("[data-paint-key]")
    if (!item || !options.root.value?.contains(item)) return undefined
    return resolve(item.dataset.paintKey ?? "")
  }

  function extend() {
    if (!stroke) return
    const key = keyAt(stroke.x, stroke.y)
    const at = key === undefined ? -1 : stroke.keys.indexOf(key)
    if (at < 0) return
    const [lo, hi] = at < stroke.anchor ? [at, stroke.anchor] : [stroke.anchor, at]
    const next = new Set(stroke.before)
    for (let i = lo; i <= hi; i++) {
      const k = stroke.keys[i]!
      if (stroke.paint) next.add(k)
      else next.delete(k)
    }
    options.set([...next])
  }

  const press = useDragPress({
    root: options.root,
    move: (x, y) => {
      if (!stroke) return
      stroke.x = x
      stroke.y = y
      extend()
    },
    end: () => {
      stroke = null
    },
  })

  /** Bind to `pointerdown` on the item's tick (or the whole item). */
  function onPointerDown(event: PointerEvent, key: K, behaviour: { hold?: number } = {}) {
    if (!enabled()) return
    press.start(
      event,
      (x, y) => {
        const keys = keysInView()
        const anchor = keys.indexOf(key)
        if (anchor < 0) return false
        const before = new Set(options.selection())
        stroke = { keys, anchor, paint: !before.has(key), before, x, y }
        extend()
        return true
      },
      { hold: behaviour.hold },
    )
  }

  useHotkeys(
    () =>
      options.selectAll && enabled()
        ? [
            {
              key: "a",
              code: "KeyA",
              ctrl: true,
              help: toValue(options.help),
              handler: () => options.set(options.selectAll!()),
            },
          ]
        : [],
    { scope: options.root },
  )

  /** True while a stroke is painting, for UI that reacts to it (a tick column revealing). */
  return { onPointerDown, painting: press.active }
}
