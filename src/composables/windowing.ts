import { clamp } from "./clamp"
import { computed, ref, type ComputedRef, type Ref } from "vue"

/*
 * Floating panels: the geometry as plain functions, and one raise-order stack.
 *
 * The stack is apart from the modal one on purpose. A window is not modal: the
 * page keeps working around it, so it must not count for `anyModalOpen`, which
 * turns off edge pulls and shortcuts. Windows paint under dropdowns and modals.
 */

export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowViewport {
  width: number
  height: number
}

export interface WindowBounds {
  minWidth: number
  minHeight: number
}

export type WindowDock = "left" | "right" | "top" | "bottom" | "full"
export type WindowEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

export const WINDOW_DOCKS: readonly WindowDock[] = ["left", "right", "top", "bottom", "full"]

/** True for a stored rectangle that can still be used. */
export function isWindowRect(value: unknown): value is WindowRect {
  const rect = value as WindowRect | null
  return (
    !!rect &&
    [rect.x, rect.y, rect.width, rect.height].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    rect.width > 0 &&
    rect.height > 0
  )
}

const between = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** Fit a rectangle on screen: no smaller than its bounds where there is room, never larger than the view. */
export function clampRect(rect: WindowRect, viewport: WindowViewport, bounds: WindowBounds): WindowRect {
  const width = clamp(rect.width, bounds.minWidth, viewport.width)
  const height = clamp(rect.height, bounds.minHeight, viewport.height)
  return {
    x: between(rect.x, 0, viewport.width - width),
    y: between(rect.y, 0, viewport.height - height),
    width,
    height,
  }
}

function nearest(value: number, candidates: number[], threshold: number): number {
  let best = value
  let distance = threshold
  for (const candidate of candidates) {
    const gap = Math.abs(candidate - value)
    if (gap <= distance) {
      best = candidate
      distance = gap
    }
  }
  return best
}

/** Pull a moved rectangle onto the view's edges and the edges of other windows, when within `threshold`. */
export function snapRect(
  rect: WindowRect,
  viewport: WindowViewport,
  others: readonly WindowRect[],
  threshold: number,
): WindowRect {
  const xs = [0, viewport.width - rect.width]
  const ys = [0, viewport.height - rect.height]
  for (const other of others) {
    xs.push(other.x, other.x + other.width, other.x - rect.width, other.x + other.width - rect.width)
    ys.push(other.y, other.y + other.height, other.y - rect.height, other.y + other.height - rect.height)
  }
  return { ...rect, x: nearest(rect.x, xs, threshold), y: nearest(rect.y, ys, threshold) }
}

/** Which dock a pointer at this point asks for: the top edge fills the view. */
export function dockAt(x: number, y: number, viewport: WindowViewport, edge: number): WindowDock | null {
  if (y <= edge) return "full"
  if (x <= edge) return "left"
  if (x >= viewport.width - edge) return "right"
  if (y >= viewport.height - edge) return "bottom"
  return null
}

/** The rectangle of a dock. `fraction` is the share of the view a side takes. */
export function dockedRect(dock: WindowDock, viewport: WindowViewport, fraction: number): WindowRect {
  const { width, height } = viewport
  const across = Math.round(width * fraction)
  const down = Math.round(height * fraction)
  switch (dock) {
    case "left":
      return { x: 0, y: 0, width: across, height }
    case "right":
      return { x: width - across, y: 0, width: across, height }
    case "top":
      return { x: 0, y: 0, width, height: down }
    case "bottom":
      return { x: 0, y: height - down, width, height: down }
    case "full":
      return { x: 0, y: 0, width, height }
  }
}

/** Drag one edge or corner; the opposite side stays put, also against the bounds and the view. */
export function resizeRect(
  start: WindowRect,
  edge: WindowEdge,
  dx: number,
  dy: number,
  viewport: WindowViewport,
  bounds: WindowBounds,
): WindowRect {
  let { x, y, width, height } = start
  const right = start.x + start.width
  const bottom = start.y + start.height
  if (edge.includes("e")) width = between(start.width + dx, bounds.minWidth, viewport.width - start.x)
  if (edge.includes("s")) height = between(start.height + dy, bounds.minHeight, viewport.height - start.y)
  if (edge.includes("w")) {
    x = between(start.x + dx, 0, right - bounds.minWidth)
    width = right - x
  }
  if (edge.includes("n")) {
    y = between(start.y + dy, 0, bottom - bounds.minHeight)
    height = bottom - y
  }
  return { x, y, width, height }
}

/** Raised windows stay under dropdowns: `--z-dropdown` less this, plus their place in the order. */
const WINDOW_Z_ROOM = 20

/* Pinned to a global symbol like the modal stack: a barrel and a deep import share one order. */
const STATE_KEY = Symbol.for("@leavepulse/ui:window-stack")
type WindowStack = {
  order: Ref<number[]>
  nextId: number
  rects: Map<number, () => WindowRect | null>
}
type GlobalWithWindows = typeof globalThis & { [STATE_KEY]?: WindowStack }
const g = globalThis as GlobalWithWindows
const state = (g[STATE_KEY] ??= { order: ref<number[]>([]), nextId: 0, rects: new Map() })

export interface WindowLayer {
  /** Join the order, or come to its top. Ignored on the server, where nothing would release it. */
  raise: () => void
  release: () => void
  /** Where the other open windows are, for snapping to. */
  others: () => WindowRect[]
  z: ComputedRef<string>
  top: ComputedRef<boolean>
}

export function useWindowLayer(rect: () => WindowRect | null): WindowLayer {
  const id = state.nextId++
  const order = state.order
  return {
    raise: () => {
      if (typeof window === "undefined") return
      state.rects.set(id, rect)
      if (order.value[order.value.length - 1] === id) return
      order.value = [...order.value.filter((x) => x !== id), id]
    },
    release: () => {
      state.rects.delete(id)
      order.value = order.value.filter((x) => x !== id)
    },
    others: () =>
      [...state.rects.entries()].flatMap(([other, read]) => {
        const found = other === id ? null : read()
        return found ? [found] : []
      }),
    z: computed(() => {
      const at = clamp(order.value.indexOf(id), 0, WINDOW_Z_ROOM - 1)
      return `calc(var(--z-dropdown) - ${WINDOW_Z_ROOM - at})`
    }),
    top: computed(() => order.value[order.value.length - 1] === id),
  }
}
