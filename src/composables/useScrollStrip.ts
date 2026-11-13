import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import { prefersReducedMotion } from "./easing"
import { momentumDistance, wheelPixels } from "./gesture"
import { isHTMLElement, nodeWindow } from "./realm"
import { scrollToElement } from "./scroll"
import { useGesture } from "./useGesture"

/*
 * A row that scrolls sideways, made reachable without a touch screen. A
 * hidden scrollbar leaves a mouse with no way to the items off to the right,
 * so:
 *
 * - The wheel scrolls the row while the row can still move that way. At
 *   either end it does nothing, and the page scrolls on as usual; a sideways
 *   wheel or touchpad is left to the browser. Notches ease on a frame loop of
 *   our own, so quick notches add up instead of restarting.
 * - A mouse or pen drags the row. A press that stays within a few pixels is
 *   an ordinary click on the item under it; a drag past that swallows the
 *   click, and a release while moving coasts on.
 * - The focused item is kept in view, scrolling the row and nothing else
 *   (scrollIntoView would move every scrollable ancestor too).
 * - Touch keeps the browser's own scrolling and scroll snap; a snapping row
 *   lets the browser snap the wheel and the end of a drag.
 *
 * `atStart`/`atEnd`/`overflowing` drive the edge fades and the buttons.
 */

export interface ScrollStripOptions {
  /** Map a vertical wheel to sideways scrolling. Default true. */
  wheel?: MaybeRefOrGetter<boolean | undefined>
  /** Drag to scroll with a mouse or pen. Default true. */
  drag?: MaybeRefOrGetter<boolean | undefined>
  /** Room kept beside a focused item, so it clears the fade. Default 24. */
  focusMargin?: number
}

export interface ScrollStrip {
  overflowing: Ref<boolean>
  atStart: Ref<boolean>
  atEnd: Ref<boolean>
  dragging: Ref<boolean>
  /** Scroll most of a view's width toward the start (-1) or the end (1). */
  page: (direction: -1 | 1) => void
  /** Scroll by `px`, eased unless reduced motion asks otherwise. */
  scrollBy: (px: number) => void
  /** Bring `el` into view within the strip only (`center` puts it in the middle). */
  reveal: (el: Element | null | undefined, options?: { smooth?: boolean; block?: "nearest" | "center" }) => void
  /** Measure again (after content changed in a way nothing observed). */
  measure: () => void
}

const PAGE_SHARE = 0.8

export function useScrollStrip(target: MaybeRefOrGetter<HTMLElement | null | undefined>, options: ScrollStripOptions = {}): ScrollStrip {
  const overflowing = ref(false)
  const atStart = ref(true)
  const atEnd = ref(true)
  const el = () => {
    const box = toValue(target)
    return isHTMLElement(box) ? box : null
  }

  function measure() {
    const box = el()
    if (!box) return
    const max = box.scrollWidth - box.clientWidth
    const left = Math.abs(box.scrollLeft)
    overflowing.value = max > 1
    atStart.value = left <= 1
    atEnd.value = left >= max - 1
  }

  const maxScroll = (box: HTMLElement) => Math.max(0, box.scrollWidth - box.clientWidth)
  const snaps = (box: HTMLElement) => {
    const type = nodeWindow(box).getComputedStyle(box).scrollSnapType
    return !!type && type !== "none"
  }

  let frame = 0
  let goal: number | null = null
  let restoreBehavior: (() => void) | null = null

  function stopEase() {
    const box = el()
    if (frame && box) nodeWindow(box).cancelAnimationFrame(frame)
    frame = 0
    goal = null
    restoreBehavior?.()
    restoreBehavior = null
  }

  function easeTo(box: HTMLElement, to: number) {
    const win = nodeWindow(box)
    goal = Math.max(0, Math.min(maxScroll(box), to))
    if (prefersReducedMotion(win)) {
      box.scrollLeft = goal
      goal = null
      return
    }
    if (frame) return
    let previous = win.performance.now()
    let position = box.scrollLeft
    const behavior = box.style.scrollBehavior
    box.style.scrollBehavior = "auto"
    restoreBehavior = () => (box.style.scrollBehavior = behavior)
    const done = () => {
      frame = 0
      goal = null
      restoreBehavior?.()
      restoreBehavior = null
    }
    const tick = (now: number) => {
      if (goal === null) {
        done()
        return
      }
      const dt = Math.min(now - previous, 32)
      previous = now
      position += (goal - position) * (1 - Math.exp(-dt / 70))
      if (Math.abs(goal - position) < 0.5) position = goal
      box.scrollLeft = position
      if (position === goal) {
        done()
        return
      }
      frame = win.requestAnimationFrame(tick)
    }
    frame = win.requestAnimationFrame(tick)
  }

  function scrollBy(px: number) {
    const box = el()
    if (!box) return
    if (snaps(box)) {
      box.scrollBy({ left: px, behavior: prefersReducedMotion(nodeWindow(box)) ? "auto" : "smooth" })
      return
    }
    easeTo(box, (goal ?? box.scrollLeft) + px)
  }

  function page(direction: -1 | 1) {
    const box = el()
    if (box) scrollBy(direction * box.clientWidth * PAGE_SHARE)
  }

  function reveal(item: Element | null | undefined, { smooth = true, block = "nearest" }: { smooth?: boolean; block?: "nearest" | "center" } = {}) {
    const box = el()
    if (!box || !item || !box.contains(item)) return
    stopEase()
    const behavior = smooth && !prefersReducedMotion(nodeWindow(box)) ? "smooth" : "auto"
    scrollToElement(item, { axis: "x", container: box, margin: options.focusMargin ?? 24, behavior, block })
  }

  function onWheel(e: WheelEvent) {
    const box = el()
    if (!box || toValue(options.wheel) === false || e.ctrlKey || e.defaultPrevented) return
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return
    const max = maxScroll(box)
    if (max <= 1) return
    const px = wheelPixels(e.shiftKey ? e.deltaX || e.deltaY : e.deltaY, e.deltaMode, box.clientWidth)
    const from = goal ?? box.scrollLeft
    if ((px > 0 && from >= max - 1) || (px < 0 && from <= 1)) return
    e.preventDefault()
    const notch = e.deltaMode !== 0 || Math.abs(px) >= 50
    if (notch) scrollBy(px)
    else {
      stopEase()
      box.scrollLeft += px
    }
  }

  function onFocusin(e: FocusEvent) {
    const item = e.target
    if (!isHTMLElement(item) || gesture.dragging.value) return
    try {
      if (!item.matches(":focus-visible")) return
    } catch {}
    reveal(item)
  }

  let snapType: string | null = null
  const gesture = useGesture(el, {
    pointerTypes: ["mouse", "pen"],
    enabled: () => toValue(options.drag) !== false && overflowing.value,
    onDragStart() {
      const box = el()
      if (!box) return
      stopEase()
      if (snaps(box)) {
        snapType = box.style.scrollSnapType
        box.style.scrollSnapType = "none"
      }
      box.style.scrollBehavior = "auto"
    },
    onDrag({ delta }) {
      const box = el()
      if (box) box.scrollLeft -= delta.x
    },
    onDragEnd({ velocity, cancelled }) {
      const box = el()
      if (!box) return
      box.style.scrollBehavior = ""
      const travel = cancelled ? 0 : -momentumDistance(velocity.x)
      if (snapType !== null) {
        box.style.scrollSnapType = snapType
        snapType = null
        box.scrollBy({ left: travel, behavior: prefersReducedMotion(nodeWindow(box)) ? "auto" : "smooth" })
        return
      }
      if (Math.abs(travel) > 4) easeTo(box, box.scrollLeft + travel)
    },
  })

  watch(
    () => el(),
    (box, _, onCleanup) => {
      if (!box) return
      const win = nodeWindow(box)
      const resize = new win.ResizeObserver(measure)
      const observeAll = () => {
        resize.disconnect()
        resize.observe(box)
        for (const child of Array.from(box.children)) resize.observe(child)
      }
      const mutations = new win.MutationObserver(() => {
        observeAll()
        measure()
      })
      observeAll()
      mutations.observe(box, { childList: true })
      box.addEventListener("scroll", measure, { passive: true })
      box.addEventListener("wheel", onWheel, { passive: false })
      box.addEventListener("focusin", onFocusin)
      measure()
      onCleanup(() => {
        resize.disconnect()
        mutations.disconnect()
        box.removeEventListener("scroll", measure)
        box.removeEventListener("wheel", onWheel)
        box.removeEventListener("focusin", onFocusin)
        stopEase()
      })
    },
    { immediate: true, flush: "post" },
  )
  onBeforeUnmount(stopEase)

  return { overflowing, atStart, atEnd, dragging: gesture.dragging, page, scrollBy, reveal, measure }
}
