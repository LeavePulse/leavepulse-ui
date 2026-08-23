import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import { prefersReducedMotion } from "./easing"

/*
 * "Has this element actually been SEEN yet?"
 *
 * An entrance animation is a statement about arrival, and mounting is not
 * arrival. A component mounts when Vue builds its subtree — which happens while
 * the tab is still painting its first frame, while the element sits below the
 * fold, inside a panel that is closed, or in a tab nobody has switched to. By
 * the time any of those become visible the animation has already run to the
 * end, and the user sees the finished state and wonders why the thing they were
 * told animates does not.
 *
 * The gap is easy to miss in development, because a hot reload remounts an
 * element that is already on screen — the one case where mount and arrival do
 * coincide. It shows up on a cold page load, which is the only load a user ever
 * performs.
 *
 * So the trigger is intersection, not lifecycle: the flag flips the first time
 * the element is both in the viewport and in a visible subtree, and never
 * flips back. Entrances do not replay — an element that scrolls away and
 * returns has already arrived, and re-drawing it every time it crosses the
 * fold reads as a page that will not settle.
 *
 * Reduced motion resolves immediately: there is no entrance to protect, and
 * making the content wait for an observer would only delay it.
 *
 * Every animated element in the kit routes through this, so "animate on
 * appearance" means the same thing in a sparkline, a chart and a progress bar,
 * and a consumer scrolling a dashboard sees each of them draw as it comes into
 * view rather than finding them all already finished.
 */

export interface UseRevealOptions {
  /**
   * Skip the wait and reveal at once. For a caller that has switched its
   * entrance off — there is nothing to gate, and holding content back for an
   * observer that no longer guards anything only delays the first paint.
   */
  immediate?: MaybeRefOrGetter<boolean | undefined>
  /**
   * Fraction of the element that must be on screen. A sliver of a tall chart
   * scrolling into view is not yet an arrival; a quarter of it is.
   */
  threshold?: number
  /**
   * Grow the viewport for the test, so an element just past the fold starts
   * drawing as it is scrolled toward rather than after it lands.
   */
  rootMargin?: string
}

export interface UseReveal {
  /** Attach to the element whose appearance starts the animation. */
  el: Ref<Element | null>
  /** False until that element has been seen; true forever after. */
  revealed: Ref<boolean>
}

export function useReveal(options: UseRevealOptions = {}): UseReveal {
  const { threshold = 0.25, rootMargin = "0px 0px -10% 0px" } = options

  const el = ref<Element | null>(null)
  // SSR has no viewport to intersect with, and no animation runs there either;
  // the client takes over on hydration and gates it properly then.
  const revealed = ref(typeof window === "undefined")

  let observer: IntersectionObserver | null = null

  function stop() {
    observer?.disconnect()
    observer = null
  }

  function reveal() {
    revealed.value = true
    stop()
  }

  watch(
    [el, () => toValue(options.immediate)],
    ([node, immediate]) => {
      if (revealed.value) return
      if (immediate || prefersReducedMotion()) {
        reveal()
        return
      }
      stop()
      if (!node) return

      // No IntersectionObserver (older WebKitGTK in the launcher shell, jsdom
      // under test): show the animation rather than withholding the content.
      if (typeof IntersectionObserver === "undefined") {
        reveal()
        return
      }

      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) reveal()
        },
        { threshold, rootMargin },
      )
      observer.observe(node)
    },
    { immediate: true, flush: "post" },
  )

  onBeforeUnmount(stop)

  return { el, revealed }
}
