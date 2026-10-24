import { shallowReactive, type Directive } from "vue"

/*
 * Which parts of the interface the user can see right now, and which ones they
 * actually use — the ground truth a tour, a "new" badge or a nudge needs.
 *
 * The element carries its own id (`v-hint="'branches.remind'"`), so a tour is
 * built from what is on screen, in whatever order the app wants: a button the
 * user has no right to is not rendered, therefore not hinted, and nobody keeps
 * a second list of steps that drifts away from the page.
 *
 * Three signals, all per id:
 *   mounted — the element is in the DOM (reactive, for "is it here at all");
 *   seen    — it stayed at least half on screen for SEEN_MS, once per mount,
 *             so scrolling past a row of buttons does not count as seeing them;
 *   used    — the user clicked it. Non-click use (a shortcut, a saved view) is
 *             reported with `hints.use(id)`.
 *
 * The kit decides nothing beyond that. Whether to badge, explain or nudge is
 * the app's call, made from these events.
 */

export type HintEvent = "seen" | "used" | "hover"
type Listener = (id: string, el: HTMLElement) => void

const SEEN_MS = 800
const SEEN_RATIO = 0.5

const mounted = shallowReactive(new Map<string, Set<HTMLElement>>())
const listeners: Record<HintEvent, Set<Listener>> = { seen: new Set(), used: new Set(), hover: new Set() }
const idOf = new WeakMap<HTMLElement, string>()
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()
const seenOnce = new WeakSet<HTMLElement>()

function emit(event: HintEvent, id: string, el: HTMLElement) {
  for (const listener of listeners[event]) listener(id, el)
}

let observer: IntersectionObserver | null = null

function watchSight(el: HTMLElement) {
  if (typeof IntersectionObserver === "undefined") {
    seenOnce.add(el)
    emit("seen", idOf.get(el)!, el)
    return
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement
        const id = idOf.get(target)
        if (!id || seenOnce.has(target)) continue
        clearTimeout(timers.get(target))
        if (entry.intersectionRatio >= SEEN_RATIO) {
          timers.set(
            target,
            setTimeout(() => {
              seenOnce.add(target)
              observer?.unobserve(target)
              emit("seen", id, target)
            }, SEEN_MS),
          )
        }
      }
    },
    { threshold: [0, SEEN_RATIO] },
  )
  observer.observe(el)
}

function onClick(event: Event) {
  const el = event.currentTarget as HTMLElement
  const id = idOf.get(el)
  if (id) emit("used", id, el)
}

function onHover(event: Event) {
  const el = event.currentTarget as HTMLElement
  const id = idOf.get(el)
  if (id) emit("hover", id, el)
}

function attach(el: HTMLElement, id: string) {
  idOf.set(el, id)
  el.dataset.hint = id
  const set = mounted.get(id) ?? new Set<HTMLElement>()
  set.add(el)
  mounted.set(id, new Set(set))
  el.addEventListener("click", onClick, { capture: true })
  el.addEventListener("pointerenter", onHover)
  el.addEventListener("focusin", onHover)
  watchSight(el)
}

function detach(el: HTMLElement) {
  const id = idOf.get(el)
  if (!id) return
  clearTimeout(timers.get(el))
  observer?.unobserve(el)
  el.removeEventListener("click", onClick, { capture: true })
  el.removeEventListener("pointerenter", onHover)
  el.removeEventListener("focusin", onHover)
  const set = new Set(mounted.get(id))
  set.delete(el)
  if (set.size) mounted.set(id, set)
  else mounted.delete(id)
  idOf.delete(el)
}

/** `v-hint="'page.feature'"` on the element that represents a feature. */
export const vHint: Directive<HTMLElement, string | null | undefined> = {
  mounted(el, binding) {
    if (binding.value) attach(el, binding.value)
  },
  updated(el, binding) {
    if (binding.value === idOf.get(el)) return
    detach(el)
    if (binding.value) attach(el, binding.value)
  },
  beforeUnmount(el) {
    detach(el)
  },
}

export const hints = {
  /** Ids of everything hinted that is in the DOM now. Reactive. */
  ids(): string[] {
    return [...mounted.keys()]
  },
  /** Whether an element with this id is in the DOM. Reactive. */
  present(id: string): boolean {
    return mounted.has(id)
  },
  /** The first connected element with this id that has a box, or null. */
  element(id: string): HTMLElement | null {
    for (const el of mounted.get(id) ?? []) {
      if (el.isConnected && el.getClientRects().length) return el
    }
    return null
  },
  /** Subscribe to a signal; returns the unsubscribe. */
  on(event: HintEvent, listener: Listener): () => void {
    listeners[event].add(listener)
    return () => listeners[event].delete(listener)
  },
  /** Report use that is not a click on the element. */
  use(id: string): void {
    const el = hints.element(id)
    for (const listener of listeners.used) listener(id, el ?? document.body)
  },
}
