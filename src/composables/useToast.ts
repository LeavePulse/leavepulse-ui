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
  /** Bumped when a toast with the same `key` replaces this one in place. */
  rev: number
  key?: string
  title?: string
  message: string
  variant: ToastVariant
  duration: number
  /** Epoch ms when this toast auto-dismisses, or null if it never does. */
  dismissAt: number | null
  actions?: ToastAction[]
  /** Whole-toast click handler (UAProject-style clickable toast). */
  onClick?: () => void | Promise<void>
  /** Copied with the message, not shown: what a bug report needs (request, status, ids). */
  details?: string
}

export interface ToastOptions {
  /**
   * A toast with the same key replaces the one on screen instead of stacking
   * beside it: "Saved" ten times is one toast, and a progress toast can turn
   * into its result.
   */
  key?: string
  title?: string
  duration?: number
  actions?: ToastAction[]
  onClick?: () => void | Promise<void>
  /** Copied with the message, not shown. An Error passed to `error()` brings its own `details`. */
  details?: string
  /** The error behind a hand-written message ("Not saved: " + e.message): its `details` ride along. */
  cause?: unknown
}

/*
 * What a toast can be made from. An Error shows its message; a `details`
 * string on it (an API error's request, status and ids) rides along to the
 * copy button, so "copy" yields something worth pasting into a bug report
 * instead of the same one line the user already sees.
 */
export type ToastMessage = string | (Error & { details?: string })

// Follows the native `Error.cause` chain too: an app that wraps an API error
// in its own ("Not saved", { cause }) keeps the request details on copy.
function detailsOf(source: unknown, depth = 0): string | undefined {
  if (!source || typeof source !== "object" || depth > 4) return undefined
  const { details, cause } = source as { details?: unknown; cause?: unknown }
  if (typeof details === "string" && details) return details
  return detailsOf(cause, depth + 1)
}

function split(message: ToastMessage, options: ToastOptions): [string, ToastOptions] {
  const text = typeof message === "string" ? message : message.message
  const details = options.details ?? (typeof message === "string" ? undefined : detailsOf(message)) ?? detailsOf(options.cause)
  return [text, { ...options, details }]
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
  input: ToastMessage,
  given: ToastOptions = {},
): number {
  const [message, options] = split(input, given)
  // A server render has no one to show it to, and the queue would outlive the
  // request and surface in the next visitor's page.
  if (typeof window === "undefined") return -1
  const duration = options.duration ?? DEFAULT_DURATION
  const fields = {
    key: options.key,
    title: options.title,
    message,
    variant,
    duration,
    dismissAt: duration > 0 ? Date.now() + duration : null,
    actions: options.actions,
    onClick: options.onClick,
    details: options.details,
  }

  const same = options.key === undefined ? -1 : queue.findIndex((t) => t.key === options.key)
  const existing = queue[same]
  if (existing) {
    queue.splice(same, 1, { ...fields, id: existing.id, rev: existing.rev + 1 })
    return existing.id
  }

  const id = state.nextId++
  // Cap the active count: drop the oldest beyond the limit.
  const overflow = queue.length - (MAX_ACTIVE - 1)
  if (overflow > 0) queue.splice(0, overflow)
  queue.push({ ...fields, id, rev: 0 })

  return id
}

export interface ToastPromiseMessages<T> {
  loading: string
  success: string | ((value: T) => string)
  error: string | ((error: unknown) => ToastMessage)
}

let promiseKey = 0

/**
 * One toast that follows a promise: a persistent "loading" toast that turns
 * into the success or error toast when it settles. Returns the promise itself.
 */
function promise<T>(
  task: Promise<T>,
  messages: ToastPromiseMessages<T>,
  options: ToastOptions = {},
): Promise<T> {
  const key = options.key ?? `@leavepulse/ui:promise-${promiseKey++}`
  push("info", messages.loading, { ...options, key, duration: 0, actions: undefined })
  task.then(
    (value) => {
      const text = typeof messages.success === "function" ? messages.success(value) : messages.success
      push("success", text, { ...options, key })
    },
    (error: unknown) => {
      const text = typeof messages.error === "function" ? messages.error(error) : messages.error
      push("error", text, { ...options, key, cause: options.cause ?? error })
    },
  )
  return task
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
    warning: (message: ToastMessage, o?: ToastOptions) => push("warning", message, o),
    error: (message: ToastMessage, o?: ToastOptions) => push("error", message, o),
    promise,
    /** Low-level push for bridges (e.g. @leavepulse/ui-sdk apiError). */
    push,
    dismiss,
    clear,
  }
}
