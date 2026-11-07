import { prefersReducedMotion } from "../composables/easing"
import { nodeWindow } from "../composables/useView"

/*
 * The kit's overlay scrollbar, shared by LpScrollArea (reka's bar over its own
 * viewport) and LpPageScrollbar (the document's, drawn by the kit), so the two
 * look and answer alike.
 *
 * The bar is a pointer target far wider than it looks: the visible rail is the
 * thumb, while the bar pads it out to a grabbable strip (a 4px-wide hit area is
 * near-impossible to catch with a mouse). Padding, not width, carries the room
 * so the thumb stays flush against the wall. The thumb is sized with
 * min-width/min-height: reka sets an inline width from a variable it never
 * defines for a vertical bar, and a minimum wins over that.
 */
export const BAR_Y = "group flex touch-none select-none justify-end pl-2.5"
export const BAR_X = "group flex flex-col touch-none select-none justify-end pt-2.5"
/* Against a wall, and inside a card or panel (a gap from the edge). */
export const BAR_Y_SIZE = { wall: "w-3.5 py-px pr-px", floating: "w-4 py-1 pr-1" }
export const BAR_X_SIZE = { wall: "h-3.5 px-px pb-px", floating: "h-4 px-1 pb-1" }

export const THUMB_Y =
  "min-w-1 bg-brand/40 before:absolute before:inset-y-0 before:right-0 before:-left-2.5 before:content-[''] transition-[min-width,background-color] duration-[var(--duration-fast)] group-hover:min-w-1.5 group-hover:bg-brand"
export const THUMB_X =
  "min-h-1 bg-brand/40 before:absolute before:inset-x-0 before:bottom-0 before:-top-2.5 before:content-[''] transition-[min-height,background-color] duration-[var(--duration-fast)] group-hover:min-h-1.5 group-hover:bg-brand"
/* Rounded on the outer edge only against a wall; at both ends inside a card. */
export const THUMB_Y_ROUND = { wall: "rounded-l-pill", floating: "rounded-pill" }
export const THUMB_X_ROUND = { wall: "rounded-t-pill", floating: "rounded-pill" }

/* In and out by the bar's `data-state` (visible | hidden), as reka sets it. */
export const BAR_FADE =
  "opacity-0 data-[state=visible]:animate-[fade-in_180ms_ease] data-[state=visible]:opacity-100 data-[state=hidden]:animate-[fade-out_240ms_ease]"

/* How long the bar stays after the last scroll or the pointer leaving it. */
export const SCROLL_HIDE_DELAY_MS = 500

/* A press beside the thumb pages this much of the view towards the pointer. */
const PAGE_FRACTION = 0.85

/**
 * A press on the bar beside the thumb. Like a native bar it pages one view
 * towards the pointer, smoothly, rather than putting the thumb's middle under
 * it (reka's own answer, which yanked the content by half a thumb on a near
 * miss and teleported it on a far press).
 */
export function pageToward(scroller: Element, axis: "x" | "y", before: boolean): void {
  const view = axis === "y" ? scroller.clientHeight : scroller.clientWidth
  const step = view * PAGE_FRACTION * (before ? -1 : 1)
  const behavior = prefersReducedMotion(nodeWindow(scroller)) ? "auto" : "smooth"
  scroller.scrollBy(axis === "y" ? { top: step, behavior } : { left: step, behavior })
}

