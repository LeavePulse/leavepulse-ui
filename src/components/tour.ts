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

const CORNER_STEPS = 6

/**
 * The dimmed, blurred layer as one clip: the whole viewport with the hole cut
 * out (evenodd), corners rounded like the ring drawn around it. One layer
 * instead of the four panels, because each panel blurred the page on its own
 * and the blur's edges showed as seams where they met. The point count never
 * changes, so the clip eases between steps on every engine; with no target
 * the hole shrinks to a dot in the middle.
 */
export function holeClip(hole: Box | null, viewport: Size, radius: number): string {
  const h = hole ?? { x: viewport.width / 2, y: viewport.height / 2, width: 0, height: 0 }
  const r = Math.max(0, Math.min(radius, h.width / 2, h.height / 2))
  const px = (n: number) => `${Math.round(n * 100) / 100}px`
  const corners: [number, number, number][] = [
    [h.x + h.width - r, h.y + r, -90],
    [h.x + h.width - r, h.y + h.height - r, 0],
    [h.x + r, h.y + h.height - r, 90],
    [h.x + r, h.y + r, 180],
  ]
  const points: string[] = []
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= CORNER_STEPS; i++) {
      const angle = ((start + (90 * i) / CORNER_STEPS) * Math.PI) / 180
      points.push(`${px(cx + r * Math.cos(angle))} ${px(cy + r * Math.sin(angle))}`)
    }
  }
  const outer = [`0px 0px`, `${px(viewport.width)} 0px`, `${px(viewport.width)} ${px(viewport.height)}`, `0px ${px(viewport.height)}`, `0px 0px`]
  return `polygon(evenodd, ${[...outer, ...points, points[0]].join(", ")})`
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
    const body = el.ownerDocument.body
    body.dispatchEvent(new PointerEvent("pointerdown", outside))
    body.dispatchEvent(new PointerEvent("pointerup", outside))
  }
}
