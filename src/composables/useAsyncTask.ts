import { getCurrentScope, onScopeDispose, ref } from "vue"

/**
 * One debounced, abortable request at a time — the shape every "fetch on input"
 * control in the kit needs: the command palette's `search`, the table's `load`.
 *
 * Two races are lost silently without it: a stale response overwriting a
 * fresher one, and a response landing after the control moved on. The token
 * guards both — the abort signal only asks the consumer to stop, it cannot
 * promise they did.
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
    task: (signal: AbortSignal) => T | Promise<T>,
    options: { delay?: number; apply: (value: T) => void; fail?: (error: unknown) => void },
  ) {
    cancel()
    pending.value = true
    const mine = ++token
    timer = setTimeout(async () => {
      controller = new AbortController()
      try {
        const value = await task(controller.signal)
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
