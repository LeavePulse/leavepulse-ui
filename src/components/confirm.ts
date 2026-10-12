import { reactive } from "vue"

/*
 * Imperative confirmation: `if (await confirm({ title: "Delete?" })) ...`.
 * Requests queue here and the one mounted LpConfirmHost shows them one at a
 * time. Pinned to a global symbol like the toast queue, so a barrel and a deep
 * import share one host.
 */

export interface ConfirmOptions {
  title: string
  description?: string
  danger?: boolean
  icon?: string
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  /**
   * Work to run on confirm. The dialog stays open with a loading state while it
   * runs and shows the error's message if it rejects; the promise from
   * `confirm()` resolves true only once it succeeded.
   */
  action?: () => unknown
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number
  resolve: (confirmed: boolean) => void
}

const STATE_KEY = Symbol.for("@leavepulse/ui:confirm-queue")
type GlobalWithConfirm = typeof globalThis & {
  [STATE_KEY]?: { queue: ConfirmRequest[]; nextId: number }
}
const g = globalThis as GlobalWithConfirm
const state = (g[STATE_KEY] ??= { queue: reactive<ConfirmRequest[]>([]), nextId: 0 })

export const confirmQueue = state.queue

/** Ask for confirmation. Resolves false when the user cancels or dismisses. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  return new Promise((resolve) => {
    state.queue.push({ ...options, id: state.nextId++, resolve })
  })
}

/** Settle a request and drop it from the queue. Used by the host. */
export function settleConfirm(id: number, confirmed: boolean): void {
  const i = state.queue.findIndex((r) => r.id === id)
  if (i === -1) return
  const [request] = state.queue.splice(i, 1)
  request?.resolve(confirmed)
}

export function useConfirm(): typeof confirm {
  return confirm
}
