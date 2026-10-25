import { computed, inject, provide, type ComputedRef, type InjectionKey } from "vue"

/*
 * Which window a component lives in. Almost always the page's own, but inside
 * an LpFrame it is the frame's: a document of its own with its own width, so
 * a breakpoint, an overlay and a click outside are all measured there.
 * Everything in the kit that reaches for the screen (media queries, portals,
 * the viewport size, page-wide listeners) asks here instead of the globals,
 * and so stays inside the frame it was rendered in.
 */
export interface LpView {
  window: Window
  document: Document
  /** Where overlays teleport to: the frame's body. */
  portal: HTMLElement
}

const LP_VIEW: InjectionKey<ComputedRef<LpView | null>> = Symbol.for("lp-view")

export function provideView(view: ComputedRef<LpView | null>): void {
  provide(LP_VIEW, view)
}

/** The view the calling component renders in; the page itself outside any frame. */
export function useView(): ComputedRef<LpView | null> {
  return inject(
    LP_VIEW,
    computed(() => null),
  )
}

/** The window to measure and listen on: the frame's inside one, the page's otherwise. */
export function viewWindow(view: LpView | null | undefined): Window {
  return view?.window ?? window
}

export function viewDocument(view: LpView | null | undefined): Document {
  return view?.document ?? document
}

/** The `to` of a portal: the frame's body inside one, `body` otherwise. */
export function usePortalTarget(): ComputedRef<HTMLElement | "body"> {
  const view = useView()
  return computed(() => view.value?.portal ?? "body")
}

/*
 * reka's layers listen for "outside" presses, focus and Escape on the
 * document that was current when they were set up, which inside an LpFrame
 * is still the page's: a click on the page closed a menu open in the frame,
 * while a click or Escape inside the frame never reached the layer at all.
 * The frame forwards those events from its document to the page's, marked
 * with where they came from, and every kit layer drops the ones from a
 * document other than its own (useOutsideGuard).
 */
const ORIGIN = "lpViewDocument"
type Marked = Event & { [ORIGIN]?: Document }

const FORWARDED = ["pointerdown", "pointerup", "click", "focusin", "keydown"] as const

export function forwardViewEvents(from: Document, to: Document): () => void {
  const forward = (event: Event) => {
    if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return
    const Copy = event.constructor as new (type: string, init: Event) => Event
    const copy = new Copy(event.type, event) as Marked
    copy[ORIGIN] = from
    to.dispatchEvent(copy)
  }
  for (const type of FORWARDED) from.addEventListener(type, forward)
  return () => {
    for (const type of FORWARDED) from.removeEventListener(type, forward)
  }
}

function originOf(event: Event): Document | null {
  const detail = (event as CustomEvent<{ originalEvent?: Event }>).detail
  const inner = detail && typeof detail === "object" && detail.originalEvent ? detail.originalEvent : event
  const marked = (inner as Marked)[ORIGIN]
  if (marked) return marked
  const target = inner.target as Node | null
  // Not `instanceof`: a node of the frame is another realm's Node.
  if (!target || typeof target.nodeType !== "number") return null
  return target.nodeType === 9 ? (target as Document) : target.ownerDocument
}

/** A layer's outside and Escape handler: ignores what happened in another document. */
export function useOutsideGuard(): (event: Event) => void {
  const view = useView()
  return (event) => {
    const origin = originOf(event)
    if (origin && origin !== viewDocument(view.value)) event.preventDefault()
  }
}
