import { onBeforeUnmount, onMounted, readonly, ref, toValue, type MaybeRefOrGetter, type Ref } from "vue"
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
 * A mouse or pen paints at once. A finger holds still for HOLD_MS first, so a
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

const HOLD_MS = 320
const SLOP_PX = 8
const EDGE_PX = 40
const SCROLL_STEP = 14

interface Stroke<K> {
  keys: K[]
  anchor: number
  paint: boolean
  before: Set<K>
  x: number
  y: number
  scroller: HTMLElement | null
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

export function usePaintSelect<K = string>(options: UsePaintSelectOptions<K>) {
  const resolve = options.resolve ?? ((raw: string) => raw as unknown as K)
  let stroke: Stroke<K> | null = null
  let pending: { key: K; pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null
  let swallowClick = false
  let frame = 0
  /** True while a stroke is painting, for UI that reacts to it (a tick column revealing). */
  const painting = ref(false)

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
    const item = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-paint-key]")
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

  function tick() {
    frame = 0
    if (!stroke) return
    const box = stroke.scroller?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
    const delta = stroke.y > box.bottom - EDGE_PX ? SCROLL_STEP : stroke.y < box.top + EDGE_PX ? -SCROLL_STEP : 0
    if (delta) {
      if (stroke.scroller) stroke.scroller.scrollTop += delta
      else window.scrollBy(0, delta)
      extend()
    }
    frame = requestAnimationFrame(tick)
  }

  function begin(key: K, x: number, y: number) {
    const keys = keysInView()
    const anchor = keys.indexOf(key)
    if (anchor < 0) return
    const before = new Set(options.selection())
    stroke = { keys, anchor, paint: !before.has(key), before, x, y, scroller: scrollParent(options.root.value) }
    painting.value = true
    // A sweep over text would otherwise select it, and a hold that started
    // before the stroke may already have.
    window.getSelection()?.removeAllRanges()
    if (options.root.value) options.root.value.style.userSelect = "none"
    extend()
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function cancelPending() {
    if (pending) clearTimeout(pending.timer)
    pending = null
  }

  /** Bind to `pointerdown` on the item's tick (or the whole item). */
  function onPointerDown(event: PointerEvent, key: K, behaviour: { hold?: number } = {}) {
    if (!enabled() || event.button !== 0) return
    cancelPending()
    if (behaviour.hold === undefined && event.pointerType !== "touch") {
      // Keeps the press from starting a text selection or moving focus mid-stroke.
      event.preventDefault()
      begin(key, event.clientX, event.clientY)
      return
    }
    const { pointerId, clientX: x, clientY: y } = event
    pending = {
      key,
      pointerId,
      x,
      y,
      timer: setTimeout(() => {
        pending = null
        begin(key, x, y)
        navigator.vibrate?.(8)
      }, behaviour.hold ?? HOLD_MS),
    }
  }

  function onMove(event: PointerEvent) {
    if (pending && event.pointerId === pending.pointerId) {
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > SLOP_PX) cancelPending()
      return
    }
    if (!stroke) return
    stroke.x = event.clientX
    stroke.y = event.clientY
    extend()
  }

  function onUp() {
    cancelPending()
    if (!stroke) return
    stroke = null
    painting.value = false
    if (options.root.value) options.root.value.style.userSelect = ""
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    swallowClick = true
    setTimeout(() => (swallowClick = false), 0)
  }

  function onClickCapture(event: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    event.stopPropagation()
    event.preventDefault()
  }

  // A long press is also how a finger asks for the context menu; once it has
  // turned into painting, that menu would open over the stroke.
  function onContextMenu(event: Event) {
    if (!stroke && !swallowClick) return
    event.preventDefault()
    event.stopPropagation()
  }

  // A finger that has started painting must not scroll the page under it.
  function onTouchMove(event: TouchEvent) {
    if (stroke) event.preventDefault()
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

  onMounted(() => {
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    window.addEventListener("click", onClickCapture, true)
    window.addEventListener("contextmenu", onContextMenu, true)
    options.root.value?.addEventListener("touchmove", onTouchMove, { passive: false })
  })
  onBeforeUnmount(() => {
    onUp()
    swallowClick = false
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    window.removeEventListener("click", onClickCapture, true)
    window.removeEventListener("contextmenu", onContextMenu, true)
    options.root.value?.removeEventListener("touchmove", onTouchMove)
  })

  return { onPointerDown, painting: readonly(painting) }
}
