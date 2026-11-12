import { onScopeDispose, readonly, ref, type Ref } from "vue"

/*
 * A new build is out and every open tab should run it, without anyone losing
 * what they were doing.
 *
 * The app tells the kit two things: which build this page is (`current`) and
 * how to ask which build is live (`latest`). The kit asks on its own when the
 * tab comes back into view and on a timer, and the app calls `check()` when it
 * has a better hint (a live stream reconnecting usually means the server was
 * redeployed).
 *
 * Reloading is the easy part; the rule is WHEN. A reload is only safe when it
 * cannot take anything with it, so the kit waits until one of these holds:
 * - the tab is hidden (nobody is looking, the next look gets the new build);
 * - the page has been left alone for `idleMs`, no dialog, menu, popover or
 *   listbox is open, focus is not in a text field, and `busy()` (the app's own
 *   "there is unsaved work" answer) is false.
 * What survives the reload: the address (routes keep their state in it), the
 * window scroll position, and anything the app already keeps in storage, such
 * as form drafts. After the reload `restored` is true for the app to say
 * "updated" if it wants to.
 */

export interface AppUpdateOptions {
  /** The build this page is running. */
  current: string
  /** The build that is live now, or null when it cannot be told. */
  latest: () => Promise<string | null>
  /** Unsaved work the kit cannot see, such as a dirty form outside a dialog. */
  busy?: () => boolean
  /** Ms without input before a visible tab may reload. */
  idleMs?: number
  /** Ms between background checks; 0 turns the timer off. */
  everyMs?: number
  /** sessionStorage key for the scroll position carried over the reload. */
  storageKey?: string
}

export interface AppUpdate {
  /** A newer build is live and the tab is waiting for a safe moment. */
  pending: Readonly<Ref<boolean>>
  /** This page load is the reload of an update. */
  restored: Readonly<Ref<boolean>>
  /** Ask the server now. */
  check: () => Promise<void>
  /** Reload at once, keeping the scroll position. */
  reloadNow: () => void
}

const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-state="open"][data-side]'
const INPUT_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "input"] as const
const CARRY_MS = 60_000

interface Carried {
  href: string
  top: number
  at: number
}

function editableFocused(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true
  return el instanceof HTMLInputElement && !["button", "checkbox", "radio", "range", "submit", "reset"].includes(el.type)
}

function overlayOpen(): boolean {
  return [...document.querySelectorAll<HTMLElement>(OVERLAY)].some((el) => el.getClientRects().length > 0)
}

function readCarried(key: string): Carried | null {
  try {
    const raw = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<Carried>
    if (typeof value.href !== "string" || typeof value.top !== "number" || typeof value.at !== "number") return null
    return value as Carried
  } catch {
    return null
  }
}

export function useAppUpdate(options: AppUpdateOptions): AppUpdate {
  const key = options.storageKey ?? "lp:app-update"
  const idleMs = options.idleMs ?? 30_000
  const pending = ref(false)
  const restored = ref(false)
  let lastInput = Date.now()
  let timer: ReturnType<typeof setInterval> | undefined

  const carried = readCarried(key)
  if (carried && carried.href === location.href && Date.now() - carried.at < CARRY_MS) {
    restored.value = true
    const top = carried.top
    const restore = () => window.scrollTo({ top, behavior: "instant" })
    requestAnimationFrame(() => requestAnimationFrame(restore))
    window.addEventListener("load", restore, { once: true })
  }

  function reloadNow(): void {
    try {
      sessionStorage.setItem(key, JSON.stringify({ href: location.href, top: window.scrollY, at: Date.now() }))
    } catch {
      // Storage off: the reload still happens, only the scroll is lost.
    }
    location.reload()
  }

  function safe(): boolean {
    if (document.hidden) return true
    if (Date.now() - lastInput < idleMs) return false
    return !overlayOpen() && !editableFocused() && !options.busy?.()
  }

  function attempt(): void {
    if (pending.value && safe()) reloadNow()
  }

  async function check(): Promise<void> {
    if (pending.value) return attempt()
    let live: string | null = null
    try {
      live = await options.latest()
    } catch {
      return
    }
    if (!live || live === options.current) return
    pending.value = true
    attempt()
  }

  const onInput = () => {
    lastInput = Date.now()
  }
  const onVisibility = () => {
    if (document.hidden) attempt()
    else void check()
  }
  for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { passive: true, capture: true })
  document.addEventListener("visibilitychange", onVisibility)
  const every = options.everyMs ?? 5 * 60_000
  const tick = setInterval(attempt, 5_000)
  if (every > 0) timer = setInterval(() => void check(), every)

  onScopeDispose(() => {
    for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput, { capture: true })
    document.removeEventListener("visibilitychange", onVisibility)
    clearInterval(tick)
    if (timer) clearInterval(timer)
  })

  return { pending: readonly(pending), restored: readonly(restored), check, reloadNow }
}
