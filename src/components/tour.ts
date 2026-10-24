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
  el.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }),
  )
  return () => {
    const outside = { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }
    document.body.dispatchEvent(new PointerEvent("pointerdown", outside))
    document.body.dispatchEvent(new PointerEvent("pointerup", outside))
  }
}
