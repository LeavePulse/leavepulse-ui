import { onScopeDispose, ref, watch, type MaybeRefOrGetter, toValue } from "vue"

/*
 * "Has the opening animation had the frame to itself yet?"
 *
 * A panel that mounts something expensive — a few hundred rows, each carrying
 * its own components — spends the opening frame building DOM instead of
 * animating, and the overlay snaps into place instead of easing in. The fix is
 * always the same shape: hold the expensive part back, let the animation run,
 * put the content up right after. That reads as the panel filling in rather
 * than the window stuttering.
 *
 * Consumers were writing this as a bare `setTimeout(260)` with the duration
 * copied from the kit's `--duration-medium` — a number that has to be kept in
 * step by hand, in every caller, forever. This owns it instead.
 *
 * The flag goes false as soon as `open` does, so reopening starts from the top
 * rather than inheriting the previous pass's answer.
 */

/** Overlay animations run at `--duration-medium`; the margin covers the frame
 *  the browser spends scheduling them. Kept here so callers don't guess. */
const SETTLE_MS = 260

export interface UseSettledOptions {
  /** Override the wait. Defaults to the kit's overlay animation duration. */
  delay?: MaybeRefOrGetter<number>
}

/**
 * Returns a ref that flips true once `open` has been truthy for the length of
 * the overlay's opening animation. Gate expensive content on it:
 *
 * ```ts
 * const settled = useSettled(() => isOpen.value)
 * ```
 * ```vue
 * <RowList v-if="settled" :rows="rows" />
 * <RowSkeletons v-else />
 * ```
 *
 * Anything truthy counts as open, so an id can be passed instead of a boolean.
 * That is the useful form when the same panel is reused for different subjects:
 * the wait restarts when the id changes, because the panel is mounting a whole
 * new body without ever having closed.
 *
 * With reduced motion there is no animation to protect, so it resolves on the
 * next tick rather than making the user wait for a delay that buys nothing.
 */
export function useSettled(
  open: MaybeRefOrGetter<unknown>,
  options: UseSettledOptions = {},
) {
  const settled = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  watch(
    () => toValue(open),
    (value) => {
      clear()
      if (!value) {
        settled.value = false
        return
      }
      // Restarted on the value, not on open/closed: a panel handed a different
      // id stays open while its whole body is replaced, and that second mount
      // is as expensive as the first.
      settled.value = false
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      const wait = reduced ? 0 : (toValue(options.delay) ?? SETTLE_MS)
      timer = setTimeout(() => {
        settled.value = true
        timer = undefined
      }, wait)
    },
    { immediate: true },
  )

  onScopeDispose(clear)

  return settled
}
