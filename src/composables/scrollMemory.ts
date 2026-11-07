import { nodeWindow } from "./realm"
import { nextTick, onBeforeUnmount, onMounted, watch } from "vue"
import { scrollMarginTop } from "./scroll"

/*
 * Where a page lands when the shell's own scroll region changes page. The
 * region is not the window, so a router's scrollBehavior never reaches it, and
 * the shell has to answer the questions a browser answers for a plain site:
 *
 *  - back and forward return to where the page was left;
 *  - an address with a hash lands on that anchor, and stays on it while the
 *    page is still growing (a lazily loaded body, images), until the reader
 *    scrolls or a moment has passed;
 *  - a new hash on the same page glides there, once a dialog that started the
 *    jump (a palette, a menu) has let go of the page;
 *  - anything else starts at the top.
 *
 * The router is not needed: what changed is read from the shell's `path` and
 * `hash` props, history position from `popstate`, and positions are keyed by
 * the address the browser shows.
 */

const SETTLE_MS = 1500
const DIALOG_WAIT_MS = 2000
const SETTLE_STOP = ["wheel", "touchstart", "keydown", "pointerdown"] as const
/* Addresses remembered; a long session over /devices/:id must not grow forever. */
const MAX_POSITIONS = 200

const positions = new Map<string, number>()

/** Records a position, dropping the address visited longest ago past `limit`. */
export function rememberPosition(store: Map<string, number>, key: string, top: number, limit = MAX_POSITIONS): void {
  store.delete(key)
  store.set(key, top)
  if (store.size > limit) store.delete(store.keys().next().value as string)
}

/** The element id a hash names. A malformed escape ("#%E0%A4%A") is taken as written. */
export function hashTargetId(value: string): string {
  const id = value.replace(/^#/, "")
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

function addressKey(scope: string): string {
  return `${scope}${location.pathname}${location.search}`
}

export function useScrollMemory(
  viewport: () => HTMLElement | null | undefined,
  path: () => string | undefined,
  hash: () => string | undefined,
  /** Sets a second region's positions apart from the first's on the same address. */
  scope = "",
): void {
  if (typeof window === "undefined") return
  let current = addressKey(scope)
  let shown = path()
  let travelled = false
  let stopHold: (() => void) | undefined
  let pending = 0

  const onPop = () => {
    travelled = true
  }
  window.addEventListener("popstate", onPop)

  function anchor(value: string | undefined): HTMLElement | null {
    if (!value || value === "#") return null
    return document.getElementById(hashTargetId(value))
  }

  function reach(value: string | undefined, behavior: ScrollBehavior): boolean {
    const view = viewport()
    const target = anchor(value)
    if (!view || !target || !view.contains(target)) return false
    const top = target.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop - scrollMarginTop(target)
    view.scrollTo({ top: Math.max(0, top), behavior })
    return true
  }

  // Re-applies a landing while the page below it keeps changing size.
  function hold(land: () => void) {
    stopHold?.()
    const view = viewport()
    const content = view?.firstElementChild
    land()
    if (!content) return
    const watcher = new (nodeWindow(content).ResizeObserver)(land)
    const timer = window.setTimeout(() => stop(), SETTLE_MS)
    const stop = () => {
      watcher.disconnect()
      window.clearTimeout(timer)
      for (const name of SETTLE_STOP) window.removeEventListener(name, stop, true)
      if (stopHold === stop) stopHold = undefined
    }
    for (const name of SETTLE_STOP) window.addEventListener(name, stop, { capture: true, passive: true })
    watcher.observe(content)
    stopHold = stop
  }

  function arrive() {
    const back = travelled
    travelled = false
    current = addressKey(scope)
    shown = path()
    const view = viewport()
    if (!view) return
    const saved = positions.get(current)
    if (back && saved !== undefined) {
      hold(() => view.scrollTo({ top: saved, behavior: "instant" }))
      return
    }
    if (hash()) {
      hold(() => {
        if (!reach(hash(), "instant")) view.scrollTo({ top: 0, behavior: "instant" })
      })
      return
    }
    stopHold?.()
    view.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }

  function afterDialogs(run: () => void) {
    const since = performance.now()
    const mine = ++pending
    const tick = () => {
      if (mine !== pending) return
      // The document the shell scrolls in: a dialog of the page is not one of a frame's.
      const doc = viewport()?.ownerDocument ?? document
      const locked = doc.querySelector('[role="dialog"]') || nodeWindow(doc).getComputedStyle(doc.body).overflow === "hidden"
      if (locked && performance.now() - since < DIALOG_WAIT_MS) requestAnimationFrame(tick)
      else run()
    }
    requestAnimationFrame(tick)
  }

  watch(
    path,
    () => {
      const view = viewport()
      if (view) rememberPosition(positions, current, view.scrollTop)
      void nextTick(() => requestAnimationFrame(arrive))
    },
    { flush: "pre" },
  )

  watch(hash, (next, previous) => {
    if (next === previous) return
    if (path() !== shown) return
    afterDialogs(() => {
      travelled = false
      if (!reach(next, "smooth")) viewport()?.scrollTo({ top: 0, behavior: "smooth" })
    })
  })

  onMounted(() => {
    if (hash()) requestAnimationFrame(() => hold(() => void reach(hash(), "instant")))
  })

  onBeforeUnmount(() => {
    stopHold?.()
    pending += 1
    window.removeEventListener("popstate", onPop)
  })
}
