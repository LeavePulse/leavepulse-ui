/*
 * The element that actually scrolls, and scrolling it to show a child. Inside an
 * app shell that is a scroll region, not the window, and `scrollIntoView` moves
 * every scrollable ancestor at once, including `overflow: hidden` wrappers that
 * then sit shifted with no way back for the user.
 */

const SCROLLS = /(auto|scroll|overlay)/

export interface ScrollParentOptions {
  /** Which overflow counts: vertical (default), horizontal, or either. */
  axis?: "y" | "x" | "both"
  /** Start the search at the element itself rather than its parent. */
  self?: boolean
}

/** The nearest ancestor that scrolls along `axis` and has something to scroll, or null. */
export function scrollParent(el: Element | null | undefined, { axis = "y", self = false }: ScrollParentOptions = {}): HTMLElement | null {
  for (let node = self ? (el as HTMLElement | null | undefined) : el?.parentElement; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) return null
    const style = getComputedStyle(node)
    const y = axis !== "x" && SCROLLS.test(style.overflowY) && node.scrollHeight > node.clientHeight
    const x = axis !== "y" && SCROLLS.test(style.overflowX) && node.scrollWidth > node.clientWidth
    if (y || x) return node
  }
  return null
}

export interface ScrollToElementOptions {
  /** `nearest` scrolls only when the element is out of view. */
  block?: "nearest" | "center" | "start"
  behavior?: ScrollBehavior
  /** Room kept between the element and the scroller's edge. */
  margin?: number
}

/** Scroll the nearest scroller, and only it, so that `el` is in view. */
export function scrollToElement(
  el: Element | null | undefined,
  { block = "nearest", behavior = "auto", margin = 0 }: ScrollToElementOptions = {},
): void {
  if (!el) return
  const box = scrollParent(el) ?? (document.scrollingElement as HTMLElement | null)
  if (!box) return
  const outer = box === document.scrollingElement ? new DOMRect(0, 0, window.innerWidth, window.innerHeight) : box.getBoundingClientRect()
  const inner = el.getBoundingClientRect()
  const top = inner.top - outer.top + box.scrollTop
  let target = box.scrollTop
  if (block === "start") target = top - margin
  else if (block === "center") target = top - (box.clientHeight - inner.height) / 2
  else if (inner.top < outer.top + margin) target = top - margin
  else if (inner.bottom > outer.bottom - margin) target = top - box.clientHeight + inner.height + margin
  if (target !== box.scrollTop) box.scrollTo({ top: target, behavior })
}
