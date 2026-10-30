/*
 * The browser history engine behind `useOverlayHistory`: one stack of entries
 * the kit pushed for open overlays and for tab switches inside them, shared by
 * every component and pinned to a global symbol like the modal stack, so a
 * barrel import and a deep import never keep two stacks.
 *
 * Only `history.pushState`, `history.go` and `popstate` are used. The
 * Navigation API would make this simpler but WebKit (Safari, WebKitGTK in a
 * Tauri shell) does not have it.
 *
 * How it stays out of a router's way:
 *
 *  - An entry copies the state object of the entry under it (vue-router keeps
 *    `back`, `current`, `forward`, `position`, `replaced` and `scroll` there)
 *    and adds one key, so a router reading it finds its own data unchanged.
 *  - The URL never changes. A `popstate` between two entries of the same
 *    address is the kit's own and is stopped where the kit sees it first. A
 *    router registers its listener when it is created, earlier than the kit,
 *    and engines differ on whether a capture listener on `window` runs before
 *    it (WebKit) or not (Chromium), so the router is also handed over as an
 *    adapter and its `listening` switch is off while the page sits on a kit
 *    entry: it neither navigates nor re-renders nor restores its scroll. A
 *    `popstate` that changes the address is always left to the router; when
 *    it was muted for it (a jump of several entries from the Back menu), the
 *    pop is dispatched to it again.
 *  - Someone else's `pushState` to another path (a link, `router.push`) is a
 *    real navigation: the open overlays close and their entries, now buried
 *    under the new page, are skipped when Back or Forward lands on them.
 *    Someone else's `pushState` on the same path (a query or hash, as an app
 *    does when an overlay lives in the route query) leaves them open and the
 *    entries keep working once Back returns past it.
 *  - Someone else's `replaceState` on a kit entry keeps the kit's key, so a
 *    router saving its scroll position does not orphan the entry.
 */

const KEY = "__lpOverlay"
const SETTLE_MS = 300

export interface HistoryEntry {
  /** Back left this entry: undo what it recorded (close the overlay, restore the tab). */
  back: () => void
  /** Forward came back to it: redo it, and say whether that happened. */
  forward?: () => boolean
  /** The page moved on to another path while this entry was live. */
  navigated?: () => void
  /** The component that pushed it is still mounted. */
  alive: boolean
}

interface Mark {
  token: string
  depth: number
}

interface Tracked {
  entry: HistoryEntry
  token: string
  depth: number
}

/**
 * What the kit needs of a router: vue-router's `listening` switch, or the same
 * flag on any router that skips its popstate handling while it is false.
 */
export interface HistoryRouter {
  listening: boolean
}

interface EngineState {
  router: HistoryRouter | null
  replaying: boolean
  /** The pop being dispatched: whether the router was muted for it, and the address before it. */
  popping: { muted: boolean; before: string } | null
  installed: boolean
  live: Tracked[]
  /** Entries Back closed, by token, for Forward to reopen. */
  closed: Map<string, Tracked>
  /** Entries whose owner closed or left while the page sat elsewhere. */
  dead: Map<string, Tracked>
  /** Pops the kit started itself and swallows on arrival. */
  silent: number
  waiting: Array<() => void>
  href: string
  serial: number
  internal: boolean
  settle: number
}

const STATE_KEY = Symbol.for("@leavepulse/ui:overlay-history")
type GlobalWithEngine = typeof globalThis & { [STATE_KEY]?: EngineState }
const g = globalThis as GlobalWithEngine
const fresh: EngineState = {
  router: null,
  replaying: false,
  popping: null,
  installed: false,
  live: [],
  closed: new Map(),
  dead: new Map(),
  silent: 0,
  waiting: [],
  href: "",
  serial: 0,
  internal: false,
  settle: 0,
}
const s = (g[STATE_KEY] ??= fresh)

function markOf(state: unknown): Mark | null {
  if (!state || typeof state !== "object") return null
  const mark = (state as Record<string, unknown>)[KEY]
  if (!mark || typeof mark !== "object") return null
  const { token, depth } = mark as Partial<Mark>
  return typeof token === "string" && typeof depth === "number" ? { token, depth } : null
}

function pathOf(href: string): string {
  try {
    return new URL(href, location.href).pathname
  } catch {
    return href
  }
}

function own<T>(run: () => T): T {
  s.internal = true
  try {
    return run()
  } finally {
    s.internal = false
  }
}

function silentGo(delta: number) {
  if (delta === 0) return
  s.silent++
  mute()
  own(() => history.go(delta))
}

/* Pushes wait for a pop the kit started: a push between `go` and its arrival would land on the wrong entry. */
function whenSettled(run: () => void) {
  if (s.silent > 0) s.waiting.push(run)
  else run()
}

function flushWaiting() {
  if (s.silent > 0) return
  const queued = s.waiting.splice(0)
  for (const run of queued) run()
}

function current(): Mark | null {
  return markOf(history.state)
}

function onTop(): boolean {
  const top = s.live[s.live.length - 1]
  return !!top && current()?.token === top.token
}

/** Everything live closes because the page went elsewhere. */
function leavePage() {
  const gone = s.live.splice(0)
  for (const item of gone.reverse()) {
    bury(item)
    item.entry.navigated?.()
  }
  s.closed.clear()
}

function handlePop(event: PopStateEvent) {
  const before = s.href
  s.href = location.href
  if (s.silent > 0) {
    s.silent--
    if (before === location.href) event.stopImmediatePropagation()
    flushWaiting()
    return
  }
  window.clearTimeout(s.settle)
  const sameAddress = before === location.href
  const mark = markOf(event.state)
  const at = mark ? s.live.findIndex((item) => item.token === mark.token) : -1

  if (at >= 0) {
    closeAbove(at)
    if (sameAddress) event.stopImmediatePropagation()
    return
  }

  const reopen = mark ? s.closed.get(mark.token) : undefined
  if (reopen && sameAddress) {
    event.stopImmediatePropagation()
    if (reopen.entry.alive && reopen.entry.forward?.()) {
      s.closed.delete(reopen.token)
      s.live.push(reopen)
      return
    }
    // Not something that can come back: undo the step so the entry is not left dead.
    silentGo(-1)
    return
  }

  if (mark && (s.dead.has(mark.token) || reopen)) {
    if (sameAddress) event.stopImmediatePropagation()
    if (!sameAddress) {
      // Back from a later page onto entries buried under it: step past them to the page itself.
      silentGo(-mark.depth)
      return
    }
    // Forward onto a buried entry: carry on to whatever comes after it, or return if nothing does.
    const depth = mark.depth
    own(() => history.forward())
    s.settle = window.setTimeout(() => {
      if (markOf(history.state)?.token === mark.token) silentGo(-depth)
      else mute()
    }, SETTLE_MS)
    return
  }

  if (s.live.length === 0) return
  if (sameAddress) {
    // The entry under the first overlay: close them all.
    closeAbove(-1)
    event.stopImmediatePropagation()
  } else if (pathOf(before) !== pathOf(location.href)) {
    leavePage()
  }
}

/* Buried entries are kept by token; the oldest go first, history this deep is never walked back. */
const DEAD_LIMIT = 200
function bury(item: Tracked) {
  s.dead.set(item.token, item)
  if (s.dead.size > DEAD_LIMIT) s.dead.delete(s.dead.keys().next().value as string)
}

function closeAbove(index: number) {
  const popped = s.live.splice(index + 1)
  for (const item of popped.reverse()) {
    s.closed.set(item.token, item)
    if (item.entry.alive) item.entry.back()
  }
}

function onPop(event: PopStateEvent) {
  if (s.replaying) return
  s.popping = { muted: !!s.router && !s.router.listening, before: s.href }
  handlePop(event)
  // A pop the kit stopped never reaches `afterPop`; it stayed on one address, so there is nothing to replay.
  if (event.cancelBubble) {
    s.popping = null
    mute()
  }
}

/*
 * Runs after every other listener of the same pop, whichever order the engine
 * calls capture and bubble listeners on `window` in (Chromium by registration,
 * WebKit capture first): the router has seen the pop by now, with the switch
 * as it stood before it, and only now is the switch set for the next one.
 */
function afterPop(event: PopStateEvent) {
  if (s.replaying || !s.popping) return
  const { muted, before } = s.popping
  s.popping = null
  if (muted && before !== location.href) replay(event.state)
  mute()
}

/*
 * The router was told to look away (the page sat on a kit entry) and the
 * step left the address after all, a jump of several entries from the Back
 * menu: hand it the same pop again, now listening, so it navigates.
 */
function replay(state: unknown) {
  if (!s.router) return
  s.router.listening = true
  s.replaying = true
  try {
    window.dispatchEvent(new PopStateEvent("popstate", { state }))
  } finally {
    s.replaying = false
  }
}

/*
 * A router registers its popstate listener when it is created, before the kit
 * is asked to do anything, so stopping the event cannot reach it. Its own
 * switch can: while the page sits on a kit entry, or a step the kit started is
 * on its way, the router does not listen.
 */
function mute() {
  if (s.popping) return
  if (s.router) s.router.listening = !(current() || s.silent > 0)
}

/** The app's router, told not to listen while a step only concerns the kit. */
export function setHistoryRouter(router: HistoryRouter | null): void {
  if (s.router && s.router !== router) s.router.listening = true
  s.router = router
  if (typeof window === "undefined") return
  // After the router's own listener, which it added when it was created.
  window.removeEventListener("popstate", afterPop)
  window.addEventListener("popstate", afterPop)
  mute()
}

function install() {
  if (s.installed || typeof window === "undefined") return
  s.installed = true
  s.href = location.href
  window.addEventListener("popstate", onPop, { capture: true })
  window.removeEventListener("popstate", afterPop)
  window.addEventListener("popstate", afterPop)

  const push = history.pushState.bind(history)
  const replace = history.replaceState.bind(history)
  history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
    const before = location.href
    push(data, unused, url)
    s.href = location.href
    if (s.internal) return
    s.closed.clear()
    if (pathOf(before) !== pathOf(location.href)) leavePage()
    mute()
  }
  history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
    const mark = s.internal ? null : current()
    const keep = mark && data && typeof data === "object" && !markOf(data) ? { ...(data as object), [KEY]: mark } : data
    replace(keep, unused, url)
    s.href = location.href
  }
}

/** Record an entry on top of the history, under the current address. */
export function pushEntry(entry: HistoryEntry): void {
  if (typeof window === "undefined") return
  install()
  whenSettled(() => {
    if (!entry.alive) return
    const token = `${Date.now().toString(36)}-${(s.serial++).toString(36)}`
    const depth = (current()?.depth ?? 0) + 1
    const base = history.state && typeof history.state === "object" ? history.state : {}
    own(() => history.pushState({ ...base, [KEY]: { token, depth } }, "", location.href))
    s.href = location.href
    s.closed.clear()
    s.live.push({ entry, token, depth })
    mute()
  })
}

/**
 * The thing behind an entry ended without Back (a close button, Escape, the
 * app setting `open` to false, an unmount): take the entry and everything
 * pushed above it out of history, so Back is never spent on a dead step.
 * When the page is not sitting on the kit's entries (another push came on top),
 * the entry stays in place and is skipped when Back or Forward lands on it.
 */
export function dropEntry(entry: HistoryEntry): void {
  const at = s.live.findIndex((item) => item.entry === entry)
  if (at === -1) return
  const positioned = onTop()
  const removed = s.live.splice(at)
  if (positioned) {
    silentGo(-removed.length)
    return
  }
  for (const item of removed) bury(item)
}

/** Whether the entry is live: pushed and not yet popped or dropped. */
export function isLive(entry: HistoryEntry): boolean {
  return s.live.some((item) => item.entry === entry)
}

/** Live entries, bottom first. For tests and devtools. */
export function liveEntries(): number {
  return s.live.length
}
