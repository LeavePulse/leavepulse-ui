import { nodeWindow } from "./useView"

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
    if (node === node.ownerDocument.body || node === node.ownerDocument.documentElement) return null
    const style = nodeWindow(node).getComputedStyle(node)
    const y = axis !== "x" && SCROLLS.test(style.overflowY) && node.scrollHeight > node.clientHeight
    const x = axis !== "y" && SCROLLS.test(style.overflowX) && node.scrollWidth > node.clientWidth
    if (y || x) return node
  }
  return null
}

/**
 * Whether `el`'s scroller (or the page) has no more room to scroll down.
 * `slack` absorbs the pixel a rounded-up scrollHeight can sit above the sum.
 */
export function atScrollEnd(el: Element | null | undefined, slack = 2): boolean {
  if (!el) return false
  const box = scrollParent(el) ?? (el.ownerDocument.scrollingElement as HTMLElement | null)
  if (!box) return true
  return box.scrollTop + box.clientHeight >= box.scrollHeight - slack
}

export interface ScrollToElementOptions {
  /** `nearest` scrolls only when the element is out of view. */
  block?: "nearest" | "center" | "start"
  behavior?: ScrollBehavior
  /** Room kept between the element and the scroller's edge. */
  margin?: number
  /** Which way to scroll: vertical (default) or horizontal, for a strip. */
  axis?: "y" | "x"
  /** Scroll this element rather than the nearest scroller along `axis`. */
  container?: HTMLElement | null
}

/** Scroll the nearest scroller, and only it, so that `el` is in view. */
/** The element's own `scroll-margin-top`, the gap it asks to keep above it when scrolled to. */
export function scrollMarginTop(el: Element): number {
  return Number.parseFloat(nodeWindow(el).getComputedStyle(el).scrollMarginTop) || 0
}

export function scrollToElement(
  el: Element | null | undefined,
  { block = "nearest", behavior = "auto", margin = 0, axis = "y", container }: ScrollToElementOptions = {},
): void {
  if (!el) return
  // The element's own document and window: inside an LpFrame they are the frame's.
  const doc = el.ownerDocument
  const win = doc.defaultView ?? window
  const box = container ?? scrollParent(el, { axis }) ?? (doc.scrollingElement as HTMLElement | null)
  if (!box) return
  const outer = box === doc.scrollingElement ? new DOMRect(0, 0, win.innerWidth, win.innerHeight) : box.getBoundingClientRect()
  const inner = el.getBoundingClientRect()
  const x = axis === "x"
  const from = x ? box.scrollLeft : box.scrollTop
  const view = x ? box.clientWidth : box.clientHeight
  const size = x ? inner.width : inner.height
  const lo = x ? inner.left - outer.left : inner.top - outer.top
  const hi = x ? inner.right - outer.right : inner.bottom - outer.bottom
  const at = lo + from
  let target = from
  if (block === "start") target = at - margin
  else if (block === "center") target = at - (view - size) / 2
  else if (lo < margin) target = at - margin
  else if (hi > -margin) target = at - view + size + margin
  if (target === from) return
  box.scrollTo(x ? { left: target, behavior } : { top: target, behavior })
}
