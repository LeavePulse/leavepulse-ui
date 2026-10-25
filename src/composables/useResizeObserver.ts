import { onScopeDispose, toValue, watch, type MaybeRefOrGetter } from "vue"

/*
 * "Tell me when this element changes size", for as long as the component lives.
 *
 * A dozen components wrote the same scaffolding around a ResizeObserver: a
 * variable for it, a guard for engines without one (old WebKitGTK, tests),
 * disconnect-and-reobserve when the element ref changes, disconnect on unmount.
 * Each copy got one of those slightly different, and a missing guard is a crash
 * rather than a style difference. This is that scaffolding once.
 *
 * `target` is a ref or a getter, so the observed element can be a template ref,
 * a component's exposed element or something found from one (the scroll
 * viewport around a table); a new element is observed in place of the old one
 * and `null` stops observing. `immediate` also calls back right when an element
 * is attached, without an entry, for components that must measure before the
 * first paint: the observer's own first report arrives a frame later.
 */
export interface UseResizeObserverOptions extends ResizeObserverOptions {
  /** Call back once as soon as an element is attached (with no entry), not only on the first report. */
  immediate?: boolean
}

export function useResizeObserver(
  target: MaybeRefOrGetter<Element | null | undefined>,
  callback: (entry: ResizeObserverEntry | undefined, el: Element) => void,
  options: UseResizeObserverOptions = {},
): { stop: () => void } {
  const { immediate = false, ...observe } = options
  let observer: ResizeObserver | undefined

  const disconnect = () => {
    observer?.disconnect()
    observer = undefined
  }

  const stopWatch = watch(
    () => toValue(target),
    (el) => {
      disconnect()
      if (!el) return
      if (immediate) callback(undefined, el)
      if (typeof ResizeObserver === "undefined") return
      observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1]
        if (entry) callback(entry, el)
      })
      observer.observe(el, observe)
    },
    { immediate: true, flush: "post" },
  )

  const stop = () => {
    stopWatch()
    disconnect()
  }
  onScopeDispose(stop)
  return { stop }
}
