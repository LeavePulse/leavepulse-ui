import { onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"

/*
 * "Ease this box between its own content-derived sizes."
 *
 * A box sized by what's inside it resizes in a single frame: a button appears
 * in a toolbar, a translation swaps a short word for a long one, a placeholder
 * is replaced by the loaded thing — and the layout snaps. Every neighbour it
 * pushes snaps with it.
 *
 * CSS alone cannot smooth this. `width`/`height: auto` are not interpolable,
 * and the keyword-interpolation escape hatches (`interpolate-size`,
 * `calc-size()`) are Chromium-only, so they'd do nothing in the WebKitGTK
 * launcher. Measuring the natural size and pinning it in pixels is what works
 * on every engine.
 *
 * This was first solved inside LpModal, whose panel grows as its body arrives.
 * The mechanism is the same wherever content drives size, so it lives here and
 * LpModal consumes it — see also LpAutoSize, the wrapper form.
 */

export type SizeAxis = "height" | "width" | "both"

export interface UseSizeTransitionOptions {
  /** Which dimension is content-derived. Default `"height"`. */
  axis?: MaybeRefOrGetter<SizeAxis | undefined>
  /** Tween length. Defaults to the kit's `--duration-fast` (160ms). */
  duration?: MaybeRefOrGetter<number | undefined>
  /**
   * Gate: while falsy the element is left entirely alone — no observers, no
   * pinning. Use it for a box that only exists while something is open, so a
   * remounted element starts measuring from scratch rather than easing in from
   * a size it held in a previous life. Default: always active.
   */
  enabled?: MaybeRefOrGetter<unknown>
}

export interface UseSizeTransition {
  /** Attach to the element whose content-derived size should ease. */
  el: Ref<HTMLElement | null>
  /**
   * True while a tween owns the size. Bind the transition utilities off this,
   * so the element is only transition-enabled once it has a size to ease FROM
   * (otherwise the very first pin animates in from zero).
   */
  tweening: Ref<boolean>
  /**
   * True while the element is still catching up to its new size. During the
   * tween the box is briefly smaller than the content it already holds, so any
   * scroll region inside it would raise a bar for an overflow that resolves
   * itself as the tween lands — hide the bar (not the scrolling) on this.
   */
  resizing: Ref<boolean>
  /** Re-measure and ease to the current natural size. Rarely needed by hand. */
  retune: () => void
}

/** Kept in step with the `duration-fast` token the transition utilities use. */
const TWEEN_MS = 160

export function useSizeTransition(
  options: UseSizeTransitionOptions = {},
): UseSizeTransition {
  const el = ref<HTMLElement | null>(null)
  const tweening = ref(false)
  const resizing = ref(false)

  let ro: ResizeObserver | undefined
  let mo: MutationObserver | undefined
  let raf = 0
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  /** Where the box last settled, so a retune has a size to ease FROM. */
  let lastHeight = 0
  let lastWidth = 0
  /** True while a tween owns the size, so observers don't cancel it midway. */
  let inFlight = false

  const axisOf = () => toValue(options.axis) ?? "height"
  const wantsHeight = () => axisOf() !== "width"
  const wantsWidth = () => axisOf() !== "height"

  function reducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
  }

  /*
   * The size is driven imperatively rather than through a style binding. By the
   * time replacement content is in the DOM the box has already reflowed to its
   * new size, so a bound value would only ever be written once, with no earlier
   * size for the transition to start from. Writing the OLD size, forcing a
   * reflow, then writing the new one gives the transition both ends.
   */
  function retune() {
    const node = el.value
    if (!node) return
    // One swap wakes both observers — the mutation as content lands, the resize
    // as it reflows — and the second call would clear the pin the first wrote.
    if (inFlight) return

    // Remembered, not measured: by the time either observer fires the box has
    // already reflowed, so the element can only report where it is going.
    const fromHeight = lastHeight
    const fromWidth = lastWidth

    // Measured with any cap lifted, then the clamp is left to CSS. A `max-*`
    // from a class makes the element report the clipped figure once the cap
    // bites, and pinning that would hold the box short of the content it now
    // has to fit.
    if (wantsHeight()) {
      node.style.height = ""
      node.style.maxHeight = "none"
    }
    if (wantsWidth()) {
      node.style.width = ""
      node.style.maxWidth = "none"
    }
    const toHeight = wantsHeight() ? node.offsetHeight : 0
    const toWidth = wantsWidth() ? node.offsetWidth : 0
    if (wantsHeight()) node.style.maxHeight = ""
    if (wantsWidth()) node.style.maxWidth = ""
    lastHeight = toHeight
    lastWidth = toWidth

    // Nothing moved on either axis, so there is nothing to ease — and leaving
    // the size unset keeps the box free to size itself.
    const movesHeight =
      wantsHeight() && toHeight !== 0 && fromHeight !== 0 && toHeight !== fromHeight
    const movesWidth =
      wantsWidth() && toWidth !== 0 && fromWidth !== 0 && toWidth !== fromWidth
    if (!movesHeight && !movesWidth) return

    if (movesHeight) node.style.height = `${fromHeight}px`
    if (movesWidth) node.style.width = `${fromWidth}px`
    void node.offsetHeight
    if (movesHeight) node.style.height = `${toHeight}px`
    if (movesWidth) node.style.width = `${toWidth}px`

    inFlight = true
    resizing.value = true
    clearTimeout(settleTimer)
    const wait = reducedMotion() ? 0 : (toValue(options.duration) ?? TWEEN_MS)
    settleTimer = setTimeout(() => {
      inFlight = false
      resizing.value = false
      // Released once the box has arrived. A size left pinned in pixels stops
      // being a starting point and becomes a cap: content that grows afterwards
      // is clipped, and `max-*` can no longer size the element itself.
      node.style.height = ""
      node.style.width = ""
      // Re-read rather than trusting the target: a `max-*` may have clamped the
      // box short of it, and the next tween has to start from where it sits.
      lastHeight = node.offsetHeight
      lastWidth = node.offsetWidth
    }, wait)
  }

  function teardown() {
    ro?.disconnect()
    mo?.disconnect()
    ro = undefined
    mo = undefined
    cancelAnimationFrame(raf)
    clearTimeout(settleTimer)
    tweening.value = false
    resizing.value = false
    lastHeight = 0
    lastWidth = 0
    inFlight = false
  }

  // Keyed off the element AND the gate: a portalled box remounts on every open,
  // and the teardown has to run on close, when the ref is already gone.
  watch(
    [el, () => toValue(options.enabled) ?? true],
    ([node, enabled]) => {
      teardown()
      if (!enabled || !node) return

      lastHeight = node.offsetHeight
      lastWidth = node.offsetWidth
      if (wantsHeight()) node.style.height = `${lastHeight}px`
      if (wantsWidth()) node.style.width = `${lastWidth}px`
      // A box must not animate in from its pre-content size, so the transition
      // only arms once that first pin has painted. The pin is dropped in the
      // same frame: it exists to give the first `retune` something to start
      // from, and holding it would cap the box at its opening size.
      raf = requestAnimationFrame(() => {
        tweening.value = true
        node.style.height = ""
        node.style.width = ""
      })

      // Two triggers, since either can move the size alone: the resize observer
      // catches a child growing in place (an image decoding, a list filling
      // in), the mutation observer catches one subtree swapped for another,
      // where every observed box may keep its size. Children are observed,
      // never the element itself — that would feed the pin straight back in.
      const watchChildren = () => {
        if (!ro) return
        ro.disconnect()
        for (const child of Array.from(node.children)) ro.observe(child)
      }
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => retune())
        watchChildren()
      }
      if (typeof MutationObserver !== "undefined") {
        mo = new MutationObserver(() => {
          watchChildren()
          retune()
        })
        mo.observe(node, { childList: true, subtree: true, characterData: true })
      }
    },
    { flush: "post" },
  )

  onBeforeUnmount(teardown)

  return { el, tweening, resizing, retune }
}
