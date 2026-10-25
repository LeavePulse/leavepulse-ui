import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue"

/*
 * The current time, as a ref that ticks only while something shows it.
 *
 * A clock on screen (a running job's elapsed time, a countdown) needs `now`
 * once per visible change and not otherwise. Two things go wrong with the
 * obvious `setInterval(1000)`:
 *
 *   - drift: an interval started mid-second shows each value late by that
 *     fraction, and timers fire late under load, so the display slips further
 *     behind the real time the longer it runs. Here every tick is scheduled
 *     for the moment the display next changes (`nextIn`), read from the clock,
 *     so a late tick corrects itself on the next one;
 *   - background tabs: a hidden page gets its timers throttled to once a
 *     minute or worse, then shows a stale value for a frame on return. Here the
 *     ticking stops while the tab is hidden (nothing is looking) and `now` is
 *     re-read the moment it is visible again.
 *
 * Time itself never pauses — it is always read from Date.now() — so a
 * countdown that was hidden for ten minutes comes back ten minutes on.
 */
export interface UseNowOptions {
  /**
   * Ms from `now` until the next tick. Defaults to the next wall-clock
   * second, which is when an elapsed "1m 12s" changes.
   */
  nextIn?: (now: number) => number
  /**
   * Re-read the clock and reschedule whenever this changes. For a `nextIn`
   * that depends on more than the time: a relative date that was "last month"
   * sleeps an hour, and if it is replaced by a date a few seconds old, the
   * wait it scheduled for the old one would leave "now" on screen for an hour.
   */
  restartOn?: MaybeRefOrGetter<unknown>
}

export function useNow(
  active: MaybeRefOrGetter<boolean> = true,
  options: UseNowOptions = {},
): Ref<number> {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setTimeout> | undefined
  const hasDocument = typeof document !== "undefined"

  const stop = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  const delay = (at: number) => {
    const next = options.nextIn ? options.nextIn(at) : 1000 - (at % 1000)
    // Never zero, never negative: a tick that lands on the boundary would
    // otherwise reschedule itself in a tight loop.
    return Math.max(16, Number.isFinite(next) ? next : 1000)
  }

  const tick = () => {
    stop()
    now.value = Date.now()
    if (!toValue(active) || (hasDocument && document.hidden)) return
    // Waking a hair after the boundary rather than before it: a tick that
    // fires 2 ms early would read the old value and show it for another second.
    timer = setTimeout(tick, delay(now.value) + 4)
  }

  const onVisibility = () => {
    if (document.hidden) stop()
    else tick()
  }

  watch(() => !!toValue(active), (on) => (on ? tick() : stop()), { immediate: true })
  if (options.restartOn !== undefined) {
    watch(() => toValue(options.restartOn), () => {
      if (toValue(active)) tick()
    })
  }
  if (hasDocument) document.addEventListener("visibilitychange", onVisibility)
  onScopeDispose(() => {
    stop()
    if (hasDocument) document.removeEventListener("visibilitychange", onVisibility)
  })
  return now
}
