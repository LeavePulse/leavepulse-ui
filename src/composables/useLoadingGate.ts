import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"

/*
 * "Should a loading indicator be on screen right now?" — which is not the same
 * question as "is something loading?".
 *
 * Shown the moment work starts, a spinner flashes for 80 ms on every fast
 * request: the page blinks, and blinking reads as instability rather than
 * speed. Hidden the moment work ends, one that did appear can vanish a frame
 * after it arrived — the same blink from the other side. So the indicator
 * waits `delay` before appearing (most loads finish inside it and show
 * nothing), and once up it stays at least `minVisible`, long enough to be seen
 * as a deliberate state rather than a glitch.
 *
 * LpLoader runs on this; it is exported for anything else that gates a
 * placeholder the same way (a skeleton, a dimmed table).
 */

export interface LoadingGateOptions {
  /** Ms of loading before the indicator appears. */
  delay?: MaybeRefOrGetter<number>
  /** Ms the indicator stays once shown, even if loading ends sooner. */
  minVisible?: MaybeRefOrGetter<number>
}

export function useLoadingGate(
  active: MaybeRefOrGetter<boolean>,
  options: LoadingGateOptions = {},
): Ref<boolean> {
  const shown = ref(false)
  let shownAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  const show = () => {
    clear()
    shown.value = true
    shownAt = Date.now()
  }

  const settle = (on: boolean) => {
    clear()
    if (on) {
      if (shown.value) return
      const wait = Math.max(0, toValue(options.delay) ?? 0)
      if (wait === 0) show()
      else timer = setTimeout(show, wait)
      return
    }
    if (!shown.value) return
    const left = Math.max(0, toValue(options.minVisible) ?? 0) - (Date.now() - shownAt)
    if (left <= 0) shown.value = false
    else timer = setTimeout(() => { timer = undefined; shown.value = false }, left)
  }

  watch(() => !!toValue(active), settle, { immediate: true })
  onScopeDispose(clear)
  return shown
}
