/*
 * Moving focus by direction rather than by document order: what a D-pad, a
 * stick or a TV remote needs, where "next" means "the thing to the right", not
 * "the thing after it in the markup".
 */

export type Direction = "up" | "down" | "left" | "right"

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/*
 * How far off the line of travel a candidate may sit, relative to how far
 * along it is. A move right should prefer the button beside, not the one
 * further right and a row below; the weight makes a sideways offset cost more
 * than the same distance straight ahead.
 */
const SIDEWAYS_WEIGHT = 2

/**
 * The index of the box to move to from `from` in `direction`, or -1 when
 * nothing lies that way. Only boxes whose near edge is past `from`'s far edge
 * in that direction count (so a move never goes backwards or sideways only);
 * among those the nearest wins, measured between the facing edges along the
 * direction plus the weighted offset across it, which picks the neighbour in
 * the same row or column over one diagonally closer.
 */
export function nextInDirection(from: Box, candidates: Box[], direction: Direction): number {
  let best = -1
  let bestScore = Number.POSITIVE_INFINITY
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  candidates.forEach((box, index) => {
    const ahead = distanceAhead(from, box, direction)
    if (ahead < 0) return
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const across = direction === "left" || direction === "right"
      ? overlapGap(from.y, from.height, box.y, box.height, fromCenter.y, center.y)
      : overlapGap(from.x, from.width, box.x, box.width, fromCenter.x, center.x)
    const score = ahead + across * SIDEWAYS_WEIGHT
    if (score < bestScore) {
      bestScore = score
      best = index
    }
  })
  return best
}

/** Gap between the facing edges along `direction`; negative when `box` is not ahead. */
function distanceAhead(from: Box, box: Box, direction: Direction): number {
  // A small tolerance, so boxes that touch or overlap by a pixel still count.
  const slack = 1
  switch (direction) {
    case "right":
      return box.x + slack >= from.x + from.width ? box.x - (from.x + from.width) : -1
    case "left":
      return box.x + box.width - slack <= from.x ? from.x - (box.x + box.width) : -1
    case "down":
      return box.y + slack >= from.y + from.height ? box.y - (from.y + from.height) : -1
    case "up":
      return box.y + box.height - slack <= from.y ? from.y - (box.y + box.height) : -1
  }
}

/**
 * How far apart two spans are across the line of travel: zero when they
 * overlap (the same row or column), otherwise the distance between their
 * centres, so a box straight ahead always beats one beside the line.
 */
function overlapGap(start: number, size: number, otherStart: number, otherSize: number, center: number, otherCenter: number) {
  const overlaps = otherStart < start + size && start < otherStart + otherSize
  return overlaps ? 0 : Math.abs(otherCenter - center)
}

const FOCUSABLE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[tabindex]",
  "[contenteditable='true']",
].join(",")

const ROVING_ITEMS = [
  "button",
  "a[href]",
  "[role=option]",
  "[role=menuitem]",
  "[role=menuitemcheckbox]",
  "[role=menuitemradio]",
  "[role=tab]",
  "[role=radio]",
  "[role=row]",
  "[role=gridcell]",
  "[role=treeitem]",
].join(",")

/**
 * The elements under `root` a directional move can land on: focusable, not
 * disabled, not taken out of the tab order on purpose, not inert, and
 * actually on screen.
 */
export function focusableIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.matches(":disabled") || element.closest("[inert]")) return false
    // Out of the tab order on purpose, unless it is an item of a widget that
    // moves its own focus (a roving list, tabs, a menu): those are reachable.
    if (element.getAttribute("tabindex") === "-1" && !element.matches(ROVING_ITEMS)) return false
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    const style = getComputedStyle(element)
    return style.visibility !== "hidden" && style.display !== "none"
  })
}
