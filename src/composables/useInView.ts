import { onBeforeUnmount, ref, watch, type Ref } from "vue"

/*
 * "Is this element on screen RIGHT NOW, in a tab someone is looking at?"
 *
 * useReveal answers a one-way question (has it ever been seen) for entrances.
 * A looping effect needs the live answer: a sheen sweeping text below the fold
 * or a typewriter cycling in a background tab spends frames and battery on
 * nothing, and on a dashboard of them that adds up. So this flips both ways,
 * and the loop pauses while it is false.
 *
 * Without IntersectionObserver (old WebKitGTK, tests) the element counts as on
 * screen: better a loop that runs than one that never starts.
 */
export interface UseInView {
  /** Attach to the element to watch. */
  el: Ref<Element | null>
  /** On screen and the page visible. */
  inView: Ref<boolean>
}

export function useInView(options: { rootMargin?: string; threshold?: number } = {}): UseInView {
  const el = ref<Element | null>(null)
  const intersecting = ref(typeof IntersectionObserver === "undefined")
  const pageVisible = ref(typeof document === "undefined" || document.visibilityState === "visible")
  const inView = ref(false)
  let observer: IntersectionObserver | null = null

  const sync = () => (inView.value = intersecting.value && pageVisible.value)
  const onVisibility = () => {
    pageVisible.value = document.visibilityState === "visible"
    sync()
  }

  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility)

  watch(
    el,
    (node) => {
      observer?.disconnect()
      observer = null
      if (!node || typeof IntersectionObserver === "undefined") return sync()
      observer = new IntersectionObserver(
        (entries) => {
          intersecting.value = entries.some((entry) => entry.isIntersecting)
          sync()
        },
        { rootMargin: options.rootMargin ?? "0px", threshold: options.threshold ?? 0 },
      )
      observer.observe(node)
    },
    { immediate: true, flush: "post" },
  )

  onBeforeUnmount(() => {
    observer?.disconnect()
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility)
  })

  return { el, inView }
}
