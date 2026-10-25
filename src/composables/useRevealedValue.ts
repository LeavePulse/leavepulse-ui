import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"
import { easeOut } from "./easing"
import { useReveal } from "./useReveal"
import { lerp, useTween } from "./useTween"

/*
 * A number that waits to be seen before it moves to its value.
 *
 * A meter that fills (LpProgress, LpGauge, LpQuota) or a figure that counts up
 * (LpNumberFlow) is showing a quantity being measured, and that only works if
 * the reader sees the sweep. So the number is held at its starting point until
 * the element is revealed (useReveal), then let go to the real value; every
 * change after that goes straight through. Each of those components used to
 * carry this hold-and-release by hand, and they disagreed in the corners: what
 * a value change before the reveal does, and what the server renders.
 */

export interface UseRevealedValueOptions {
  /** Where the number starts while held: 0 for a bar, the floor for a gauge. */
  from?: MaybeRefOrGetter<number>
  /** False shows the value at once, with nothing held. */
  animateOnMount?: MaybeRefOrGetter<boolean>
  /**
   * Also tween `shown` toward the target over this many ms (eased out), for a
   * component that draws from one interpolated number. Omitted, `shown` is the
   * target itself, for a component that animates in CSS or through LpNumberFlow.
   */
  duration?: MaybeRefOrGetter<number>
  /**
   * Whether a change that arrives before the reveal waits too (default) or
   * goes through at once. A meter waits, so its first sweep is still seen;
   * LpNumberFlow lets it through, because a figure that changes while the user
   * is on the page is news whether or not it is in view.
   */
  holdChanges?: boolean
}

export interface UseRevealedValue {
  /** Attach to the element whose appearance releases the value. */
  el: Ref<Element | null>
  /** False until that element has been seen. */
  revealed: Ref<boolean>
  /** The value released so far: `from` while held, then the source. */
  target: Readonly<Ref<number>>
  /** What to draw: `target`, tweened when a `duration` is given. */
  shown: Readonly<Ref<number>>
}

export function useRevealedValue(
  value: () => number,
  options: UseRevealedValueOptions = {},
): UseRevealedValue {
  const animate = () => toValue(options.animateOnMount) ?? true
  const { el, revealed } = useReveal({ immediate: () => !animate() })

  /*
   * The server has no viewport, so useReveal reports it revealed; releasing
   * there would render the final value and the client, which starts held,
   * would hydrate a different one. The server renders the starting point and
   * the client releases it once the element is seen.
   */
  const canRelease = () => !animate() || typeof window !== "undefined"

  const target = ref(animate() ? (toValue(options.from) ?? 0) : value())

  watch(
    revealed,
    (seen) => {
      if (seen && canRelease()) target.value = value()
    },
    { immediate: true },
  )
  watch(value, (v) => {
    if (revealed.value || options.holdChanges === false) target.value = v
  })

  const duration = options.duration
  const shown =
    duration === undefined
      ? computed(() => target.value)
      : useTween(() => target.value, lerp, { duration: () => toValue(duration), ease: easeOut })

  return { el, revealed, target, shown }
}
