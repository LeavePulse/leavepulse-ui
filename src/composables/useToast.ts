import { reactive } from "vue"

export type ToastVariant = "info" | "success" | "warning" | "error"

export interface ToastAction {
  label: string
  /** Optional leading icon (any name LpIcon accepts, e.g. "lucide:copy"). */
  icon?: string
  onClick: () => void | Promise<void>
}

export interface ToastItem {
  id: number
  title?: string
  message: string
  variant: ToastVariant
  duration: number
  /** Epoch ms when this toast auto-dismisses, or null if it never does. */
  dismissAt: number | null
  actions?: ToastAction[]
  /** Whole-toast click handler (UAProject-style clickable toast). */
  onClick?: () => void | Promise<void>
}

export interface ToastOptions {
  title?: string
  duration?: number
  actions?: ToastAction[]
  onClick?: () => void | Promise<void>
}

const DEFAULT_DURATION = 4500
const MAX_ACTIVE = 4

// Pin the queue to a global symbol so the singleton survives module
// duplication (a barrel import and a deep import can otherwise resolve to two
// module instances, each with its own state — the toasts-never-show footgun).
const STATE_KEY = Symbol.for("@leavepulse/ui:toast-queue")
type GlobalWithQueue = typeof globalThis & {
  [STATE_KEY]?: { queue: ToastItem[]; nextId: number }
}
const g = globalThis as GlobalWithQueue
const state = (g[STATE_KEY] ??= { queue: reactive<ToastItem[]>([]), nextId: 0 })
const queue = state.queue

function push(
  variant: ToastVariant,
  message: string,
  options: ToastOptions = {},
): number {
  const id = state.nextId++
  const duration = options.duration ?? DEFAULT_DURATION
  const item: ToastItem = {
    id,
    title: options.title,
    message,
    variant,
    duration,
    dismissAt: duration > 0 ? Date.now() + duration : null,
    actions: options.actions,
    onClick: options.onClick,
  }

  // Cap the active count: drop the oldest beyond the limit.
  const overflow = queue.length - (MAX_ACTIVE - 1)
  if (overflow > 0) queue.splice(0, overflow)
  queue.push(item)

  return id
}

function dismiss(id: number): void {
  const i = queue.findIndex((t) => t.id === id)
  if (i !== -1) queue.splice(i, 1)
}

function clear(): void {
  queue.splice(0, queue.length)
}

export function useToast() {
  return {
    queue,
    toast: (message: string, o?: ToastOptions) => push("info", message, o),
    info: (message: string, o?: ToastOptions) => push("info", message, o),
    success: (message: string, o?: ToastOptions) => push("success", message, o),
    warning: (message: string, o?: ToastOptions) => push("warning", message, o),
    error: (message: string, o?: ToastOptions) => push("error", message, o),
    /** Low-level push for bridges (e.g. @leavepulse/ui-sdk apiError). */
    push,
    dismiss,
    clear,
  }
}
