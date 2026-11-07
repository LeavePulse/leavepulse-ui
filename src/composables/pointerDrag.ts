import { nodeWindow } from "./useView"

export interface PointerDragHandlers {
  move: (event: PointerEvent) => void
  /** `completed` is false for a cancelled or lost pointer: nothing should be committed. */
  end: (completed: boolean) => void
  /** Hold this cursor over the whole page for the drag, the way a resize grip wants. */
  cursor?: string
}

/**
 * Follow a pointer from the handle it pressed until it lets go, however that
 * ends: release, a cancelled touch, a lost capture or the returned stop. The
 * end runs once. Everything happens on the handle, which holds the capture, so
 * it works inside an LpFrame, and the body's text selection is off meanwhile,
 * in the handle's own window, and put back as it was.
 */
export function startPointerDrag(event: PointerEvent, handlers: PointerDragHandlers): () => void {
  const handle = event.currentTarget as HTMLElement
  const body = nodeWindow(handle).document.body.style
  const { userSelect, cursor } = body
  let active = true

  const finish = (completed: boolean) => {
    if (!active) return
    active = false
    handle.removeEventListener("pointermove", onMove)
    handle.removeEventListener("pointerup", onUp)
    handle.removeEventListener("pointercancel", onCancel)
    handle.removeEventListener("lostpointercapture", onCancel)
    body.userSelect = userSelect
    body.cursor = cursor
    handlers.end(completed)
  }
  function onMove(ev: PointerEvent) {
    if (ev.pointerId === event.pointerId) handlers.move(ev)
  }
  function onUp(ev: PointerEvent) {
    if (ev.pointerId === event.pointerId) finish(true)
  }
  function onCancel(ev: PointerEvent) {
    if (ev.pointerId === event.pointerId) finish(false)
  }

  event.preventDefault()
  body.userSelect = "none"
  if (handlers.cursor) body.cursor = handlers.cursor
  handle.setPointerCapture(event.pointerId)
  handle.addEventListener("pointermove", onMove)
  handle.addEventListener("pointerup", onUp)
  handle.addEventListener("pointercancel", onCancel)
  handle.addEventListener("lostpointercapture", onCancel)
  return () => finish(false)
}
