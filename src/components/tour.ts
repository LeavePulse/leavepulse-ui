import { nodeWindow } from "../composables/realm"
/*
 * Geometry for LpTour, kept out of the component so it can be tested without a
 * DOM: where the spotlight hole goes and what the dim panels around it cover.
 * Placing the step card is reka's popper (floating-ui), anchored to the hole.
 */

import type { Box } from "../composables/spatialNav"

type Size = { width: number; height: number }

/** The hole around a target: padded, then clipped to the viewport so a tall
 * target never pushes the dim panels off-screen. */
export function holeOf(target: Box, padding: number, viewport: Size): Box {
  const x = Math.max(0, target.x - padding)
  const y = Math.max(0, target.y - padding)
  const right = Math.min(viewport.width, target.x + target.width + padding)
  const bottom = Math.min(viewport.height, target.y + target.height + padding)
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
}

/** The four dim panels around a hole: top, bottom, left, right. */
export function panelsAround(hole: Box, viewport: Size): Box[] {
  const bottom = hole.y + hole.height
  return [
    { x: 0, y: 0, width: viewport.width, height: hole.y },
    { x: 0, y: bottom, width: viewport.width, height: Math.max(0, viewport.height - bottom) },
    { x: 0, y: hole.y, width: hole.x, height: hole.height },
    { x: hole.x + hole.width, y: hole.y, width: Math.max(0, viewport.width - hole.x - hole.width), height: hole.height },
  ]
}

/** The scrim's mask, as the style properties that carry it. */
export type HoleMask = {
  maskImage: string
  maskSize: string
  maskPosition: string
  maskRepeat: string
  maskComposite: string
}

const FILL = "linear-gradient(#000 0 0)"
// A hard edge one pixel wide: antialiased like the ring drawn over it.
const DOT = "radial-gradient(closest-side, #000 calc(100% - 1px), transparent)"

/**
 * The dimmed, blurred layer as one mask: the whole viewport minus the hole,
 * corners rounded like the ring drawn around it. One layer instead of the
 * four panels, because each panel blurred the page on its own and the blur's
 * edges showed as seams where they met.
 *
 * A mask and not a clip-path: under an ancestor with a rounded clip (a
 * desktop shell's `clip-path: inset(0 round 12px)` on body, or a rounded
 * `overflow: hidden` wrapper) Chromium dropped the scrim's own clip-path from
 * its backdrop-filter, and the lit target came out dimmed and blurred like
 * the rest. The mask is honoured there.
 *
 * The hole is drawn from plain gradients sized and placed in pixels, two bars
 * and four corner dots, and subtracted from a full fill. Sizes and positions
 * are what move between steps, never the images, and the layer count never
 * changes, so the hole eases as a mask-size/mask-position transition on every
 * engine. With no target it shrinks to a dot in the middle.
 */
export function holeMask(hole: Box | null, viewport: Size, radius: number): HoleMask {
  const h = hole ?? { x: viewport.width / 2, y: viewport.height / 2, width: 0, height: 0 }
  const r = Math.max(0, Math.min(radius, h.width / 2, h.height / 2))
  const px = (n: number) => `${Math.round(n * 100) / 100}px`
  const at = (x: number, y: number) => `${px(x)} ${px(y)}`
  const right = h.x + h.width - 2 * r
  const bottom = h.y + h.height - 2 * r
  const layers: [image: string, size: string, position: string][] = [
    [FILL, "100% 100%", "0px 0px"],
    [FILL, at(h.width, h.height - 2 * r), at(h.x, h.y + r)],
    [FILL, at(h.width - 2 * r, h.height), at(h.x + r, h.y)],
    [DOT, at(2 * r, 2 * r), at(h.x, h.y)],
    [DOT, at(2 * r, 2 * r), at(right, h.y)],
    [DOT, at(2 * r, 2 * r), at(h.x, bottom)],
    [DOT, at(2 * r, 2 * r), at(right, bottom)],
  ]
  return {
    maskImage: layers.map((layer) => layer[0]).join(", "),
    maskSize: layers.map((layer) => layer[1]).join(", "),
    maskPosition: layers.map((layer) => layer[2]).join(", "),
    maskRepeat: "no-repeat",
    // The top layer (the full fill) takes away everything under it; the hole's
    // pieces add up into one rounded rectangle first.
    maskComposite: layers.map((_, i) => (i === 0 ? "subtract" : "add")).join(", "),
  }
}

/**
 * Open the context menu of an element as a right-click would, at its centre.
 * Lets a tour step show a row's menu without the user hunting for it; the menu
 * itself is whatever the app already wires to that element.
 *
 * Returns the way to close it again: a press outside the menu, which every
 * dismissable layer honours. Not Escape — that key also closes whatever is on
 * top, a tour included, and would end the walk instead of the menu.
 */
export function openContextMenu(el: Element): () => void {
  const box = el.getBoundingClientRect()
  const win = nodeWindow(el)
  el.dispatchEvent(
    new win.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }),
  )
  return () => {
    const outside = { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }
    const body = el.ownerDocument.body
    body.dispatchEvent(new win.PointerEvent("pointerdown", outside))
    body.dispatchEvent(new win.PointerEvent("pointerup", outside))
  }
}
