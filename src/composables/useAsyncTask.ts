import { getCurrentScope, onScopeDispose, ref } from "vue"

/**
 * One debounced, abortable request at a time — the shape every "fetch on input"
 * control in the kit needs: the command palette's `search`, the table's `load`.
 *
 * Two races are lost silently without it: a stale response overwriting a
 * fresher one, and a response landing after the control moved on. The token
 * guards both — the abort signal only asks the consumer to stop, it cannot
 * promise they did.
 *
 * What is guarded is `apply` and `fail`, not the task: whatever it does past
 * the point it honours the signal (a cache write after the fetch) still runs,
 * and an error from a superseded run is dropped unseen. It is also one slot:
 * a new `run` replaces the last, and `pending` speaks for the latest only, so
 * independent requests each need their own `useAsyncTask`.
 *
 * A task that has something to show before it is done (the command palette's
 * streamed results) calls `emit` with it: that reaches `apply` at once, for
 * the latest run only, while `pending` stays true until the task settles. The
 * value the task finally resolves to is applied as well, after the last emit.
 */
export function useAsyncTask<T>() {
  const pending = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  let token = 0

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = undefined
    controller?.abort()
    controller = undefined
    token += 1
    pending.value = false
  }

  function run(
    task: (signal: AbortSignal, emit: (value: T) => void) => T | Promise<T>,
    options: { delay?: number; apply: (value: T) => void; fail?: (error: unknown) => void },
  ) {
    cancel()
    pending.value = true
    const mine = ++token
    timer = setTimeout(async () => {
      controller = new AbortController()
      try {
        const emit = (value: T) => {
          if (mine === token) options.apply(value)
        }
        const value = await task(controller.signal, emit)
        if (mine === token) options.apply(value)
      } catch (error) {
        if (mine === token) options.fail?.(error)
      } finally {
        if (mine === token) pending.value = false
      }
    }, options.delay ?? 0)
  }

  if (getCurrentScope()) onScopeDispose(cancel)

  return { pending, run, cancel }
}
