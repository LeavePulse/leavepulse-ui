import { computed, inject, onBeforeUnmount, provide, reactive, shallowRef, watch, type ComputedRef, type InjectionKey, type WatchStopHandle } from "vue"
import type { HintNote } from "../components/LpHintLayer.vue"
import type { TourContext, TourStep } from "../components/LpTour.vue"
import { anyModalOpen } from "../components/modalDepth"
import { hints } from "./useHints"

/*
 * Onboarding that does not nag: a first-visit tour offer, quiet "new" dots,
 * "what changed" after an update, and nudges toward unused features — all
 * spending one shared attention budget.
 *
 * The app describes its features once (each tied to the `v-hint` element that
 * represents it) and says which page is current; the system decides what to
 * show and when, remembers what each person has seen, and renders through
 * <LpHints>. Everything below is policy the app would otherwise re-derive:
 *
 *   budget  — at most one interruption (offer, changes, nudge) per session,
 *             never over a dialog, while typing, right after navigation, or
 *             when the user arrived with intent (palette, notification);
 *   memory  — per key, a state that only climbs (seen → explained → used),
 *             so what was used is never explained again;
 *   fresh   — a feature becomes "new" only after the page is known: when a
 *             page is first met, everything on it is quietly baselined, so a
 *             rollout does not light every control for existing users;
 *   news    — "what changed" is for people who knew the page before: a
 *             newcomer's first visit marks the page's news as read, while a
 *             returning user (recognised by `known`) still gets it;
 *   retries — a declined tour is offered again at most `offersMax` times,
 *             `offerAgain` apart; a nudge waits `nudgeAgain` between showings.
 */

export interface HintFeature {
  page: string
  title: string
  text: string
  order?: number
  keys?: string
  try?: boolean
  side?: TourStep["side"]
  /** Bump to announce a changed feature again: it reads as new to everyone. */
  rev?: number
  /** Keeps its dot until explained, even after "not now". */
  required?: boolean
  /**
   * Rendered only in some states (data-dependent, behind a filter). Its first
   * appearance is not news, so it is never marked new for merely showing up;
   * a `rev` bump still announces it.
   */
  conditional?: boolean
  /** When the `v-hint` id is not the element to light (a column header, an opened menu). */
  target?: () => Element | null
  enter?: (context: TourContext) => void | Promise<void>
}

export interface HintPage {
  title: string
  /**
   * A localStorage key prefix that proves the user worked on this page before
   * the system existed (a remembered table layout). Such a page is treated as
   * known on first sight: no tour offer, no dots for what was always there.
   */
  known?: string
}

export interface HintNews {
  id: string
  date: string
  page: string
  text: string
  feature?: string
}

export interface HintNudge {
  id: string
  feature: string
  text: string
}

/**
 * A better way to do something the user keeps doing the slow way: shown now
 * and then (at most `max` times, `nudgeAgain` apart) and never again once the
 * better way is used. `when` reads usage counters — kit components report
 * their own (see HINT_SIGNALS), and `hints.use(name)` adds any of the app's.
 */
export interface HintTip {
  id: string
  title: string
  text: string
  keys?: string
  max?: number
  when: (count: (signal: string) => number) => boolean
  /** What "show me" lights up on the current screen; without it the tip only informs. */
  step?: () => TourStep | null
}

/** Usage the kit reports by itself. */
export const HINT_SIGNALS = {
  /** A context menu was opened (right click or long press). */
  contextMenu: "lp.context-menu",
  /** A "…" menu marked `rightClickToo` was opened: its items were one right click away. */
  menuButton: "lp.menu-button",
  /** A left click on something that also has a context menu. */
  contextTarget: "lp.context-target",
  /** The command palette was opened. */
  palette: "lp.palette",
  /** The current hint page changed: a navigation. */
  navigate: "lp.navigate",
  /** An item's actions were opened in the palette (Tab). */
  paletteActions: "lp.palette-actions",
  /** A button's `hotkey` was pressed instead of clicking it. */
  hotkey: "lp.hotkey",
  /** A button that has a `hotkey` was clicked with the pointer. */
  hotkeyTarget: "lp.hotkey-target",
  /** A dropzone's file dialog was used to pick a file. */
  dropzoneBrowse: "lp.dropzone-browse",
  /** Something was dropped or pasted onto a dropzone. */
  dropzoneDirect: "lp.dropzone-direct",
} as const

let lastContextTarget: WeakRef<Element> | null = null

/** The element a left click just landed on that also has a right-click menu (a table row rather than the table). */
export function noteContextTarget(el: Element): void {
  lastContextTarget = new WeakRef(el)
}

let lastHotkeyTarget: { el: WeakRef<Element>; combo: string } | null = null

/** A button with a hotkey was just clicked with the pointer: what `hotkeyTip` shows. */
export function noteHotkeyTarget(el: Element, combo: string): void {
  lastHotkeyTarget = { el: new WeakRef(el), combo }
}

let lastDropzone: WeakRef<Element> | null = null

/** A dropzone's file dialog was just used: what `dropzoneTip` shows. */
export function noteDropzone(el: Element): void {
  lastDropzone = new WeakRef(el)
}

const onScreen = (el: Element) => {
  const box = el.getBoundingClientRect()
  return el.isConnected && box.width > 0 && box.bottom > 0 && box.top < window.innerHeight
}

/*
 * What the tip lights up: the thing the user keeps clicking, while it is still
 * on screen; otherwise a row with a menu, then any menu target. Rows first,
 * because a page's first target in document order is usually chrome (a
 * sidebar account card), not the content the habit is about.
 */
function rightClickTarget(): Element | null {
  const last = lastContextTarget?.deref()
  if (last && onScreen(last)) return last
  const visible = (selector: string) => [...document.querySelectorAll(selector)].find(onScreen) ?? null
  return visible("[data-lp-context-row]") ?? visible("main [data-lp-context-menu]") ?? visible("[data-lp-context-menu]")
}

/** Right click instead of the "…" button. */
export function contextMenuTip(text: Partial<Pick<HintTip, "title" | "text"> & { stepText: string }> = {}): HintTip {
  return {
    id: "lp.tip.context-menu",
    title: text.title ?? "Right-click works here",
    text: text.text ?? "Rows and cards open their actions on right-click, even where no … button shows it.",
    when: (count) =>
      count(HINT_SIGNALS.contextMenu) === 0
      && (count(HINT_SIGNALS.menuButton) >= 5 || count(HINT_SIGNALS.contextTarget) >= 25),
    step: () => {
      const target = rightClickTarget()
      return target ? { target, title: text.title ?? "Right-click works here", text: text.stepText ?? "Right-click this to see what it can do.", try: true } : null
    },
  }
}

/** The palette instead of walking the menu. */
export function paletteTip(keys = "Ctrl+K", text: Partial<Pick<HintTip, "title" | "text">> = {}): HintTip {
  return {
    id: "lp.tip.palette",
    title: text.title ?? "Jump anywhere",
    text: text.text ?? "Search pages, people and settings from anywhere instead of the menu.",
    keys,
    when: (count) => count(HINT_SIGNALS.navigate) >= 15 && count(HINT_SIGNALS.palette) === 0,
  }
}

/** The button's key instead of the pointer. */
export function hotkeyTip(text: Partial<Pick<HintTip, "title" | "text"> & { stepText: string }> = {}): HintTip {
  const title = text.title ?? "There is a key for this"
  return {
    id: "lp.tip.hotkey",
    title,
    text: text.text ?? "Buttons you keep clicking have a keyboard shortcut; it is in the button's tooltip and in the key reference (F1).",
    when: (count) => count(HINT_SIGNALS.hotkey) === 0 && count(HINT_SIGNALS.hotkeyTarget) >= 10,
    step: () => {
      const last = lastHotkeyTarget
      const target = last?.el.deref()
      return last && target && onScreen(target)
        ? { target, title, text: text.stepText ?? "Next time, press this instead of clicking:", keys: last.combo }
        : null
    },
  }
}

/** Dropping or pasting instead of the file dialog. */
export function dropzoneTip(text: Partial<Pick<HintTip, "title" | "text"> & { stepText: string }> = {}): HintTip {
  const title = text.title ?? "Drop or paste here"
  return {
    id: "lp.tip.dropzone",
    title,
    text: text.text ?? "Files can be dragged straight onto the upload area, and a screenshot pasted with Ctrl+V, without the file dialog.",
    when: (count) => count(HINT_SIGNALS.dropzoneDirect) === 0 && count(HINT_SIGNALS.dropzoneBrowse) >= 4,
    step: () => {
      const target = lastDropzone?.deref()
      return target && onScreen(target)
        ? { target, title, text: text.stepText ?? "Drag a file onto this, or copy a picture and paste it while this is focused.", keys: "Ctrl+V" }
        : null
    },
  }
}

export type HintLevel = "seen" | "explained" | "used"

export interface HintRecord {
  state: HintLevel
  dismissed: boolean
  count: number
  assigned?: boolean
  updatedAt: string
}

export interface HintDelta {
  key: string
  state?: HintLevel
  dismissed?: boolean
  add?: number
}

export interface HintStorage {
  load(): Promise<Record<string, HintRecord>> | Record<string, HintRecord>
  save(deltas: HintDelta[]): Promise<void> | void
  /** Last chance on page hide (sendBeacon); falls back to `save`. */
  saveOnLeave?(deltas: HintDelta[]): void
}

export interface HintTiming {
  settle: number
  offerAgain: number
  offersMax: number
  freshLimit: number
  nudgeAgain: number
  flush: number
}

export interface HintSystemOptions {
  features: Record<string, HintFeature>
  pages?: Record<string, HintPage>
  news?: HintNews[]
  tips?: HintTip[]
  storage?: HintStorage
  /** The current page id, read reactively (map your route to it). */
  page: () => string
  sessionKey?: string
  timing?: Partial<HintTiming>
}

export type HintOffer =
  | { kind: "tour" | "assigned"; page: string }
  | { kind: "news"; page: string; items: HintNews[] }
  | { kind: "nudge"; page: string; nudge: HintNudge }
  | { kind: "tip"; page: string; tip: HintTip; step: TourStep | null }

const RANK: Record<HintLevel, number> = { seen: 0, explained: 1, used: 2 }
const DAY = 24 * 3600 * 1000
const DEFAULT_TIMING: HintTiming = {
  settle: 2500,
  offerAgain: 3 * DAY,
  offersMax: 2,
  freshLimit: 3,
  nudgeAgain: 7 * DAY,
  flush: 2000,
}

/** Records in localStorage: for anonymous sessions and apps without a server. */
export function localHintStorage(key = "lp-hints"): HintStorage {
  const read = (): Record<string, HintRecord> => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}") as Record<string, HintRecord>
    } catch {
      return {}
    }
  }
  return {
    load: read,
    save(deltas) {
      const all = read()
      for (const d of deltas) all[d.key] = merge(all[d.key], d)
      try {
        localStorage.setItem(key, JSON.stringify(all))
      } catch {
        return
      }
    },
  }
}

function merge(record: HintRecord | undefined, delta: Omit<HintDelta, "key">): HintRecord {
  const base = record ?? { state: "seen" as HintLevel, dismissed: false, count: 0, updatedAt: "" }
  return {
    ...base,
    state: delta.state && RANK[delta.state] > RANK[base.state] ? delta.state : base.state,
    dismissed: delta.dismissed ?? base.dismissed,
    count: base.count + (delta.add ?? 0),
    updatedAt: new Date().toISOString(),
  }
}

/** Record keys, for apps that read or assign records directly (a "who knows what" view). */
export const hintKey = {
  feature: (id: string, rev = 1) => `f:${id}:${rev}`,
  page: (page: string) => `t:${page}`,
  news: (id: string) => `c:${id}`,
  nudge: (id: string) => `n:${id}`,
}

export interface HintSummary {
  tour: "done" | "assigned" | "declined" | "offered" | "never"
  offers: number
  known: number
  total: number
  /** Titles of `required` features this person has not been shown. */
  missing: string[]
}

/** What one person knows of a page, from their records: for a manager's view. */
export function hintSummary(
  records: Map<string, Pick<HintRecord, "state" | "dismissed" | "count" | "assigned">>,
  features: Record<string, HintFeature>,
  page: string,
): HintSummary {
  const own = Object.entries(features).filter(([, f]) => f.page === page)
  const knows = (id: string, f: HintFeature) => RANK[records.get(hintKey.feature(id, f.rev))?.state ?? "seen"] >= RANK.explained
  const tour = records.get(hintKey.page(page))
  return {
    tour: tour && RANK[tour.state] >= RANK.explained
      ? "done"
      : tour?.assigned ? "assigned" : tour?.dismissed ? "declined" : tour ? "offered" : "never",
    offers: tour?.count ?? 0,
    known: own.filter(([id, f]) => knows(id, f)).length,
    total: own.length,
    missing: own.filter(([id, f]) => f.required && !knows(id, f)).map(([, f]) => f.title),
  }
}

function typing(): boolean {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
}

export function createHintSystem(options: HintSystemOptions) {
  const timing = { ...DEFAULT_TIMING, ...options.timing }
  const features = options.features
  const pages = options.pages ?? {}
  const news = options.news ?? []
  const tips = options.tips ?? []
  const TIP_MAX = 3
  const storage = options.storage ?? localHintStorage()
  const sessionKey = options.sessionKey ?? "lp-hints:interrupted"

  const state = reactive({
    records: new Map<string, HintRecord>(),
    loaded: false,
    page: "",
    overlay: null as string | null,
    tour: { open: false, step: 0, steps: [] as TourStep[], ids: [] as string[], page: "" },
    offer: null as HintOffer | null,
    candidate: null as (HintNudge & { page: string }) | null,
    settledAt: 0,
    intent: false,
  })

  const pending = new Map<string, HintDelta>()
  let flushTimer: ReturnType<typeof setTimeout> | undefined

  const featureKey = (id: string) => hintKey.feature(id, features[id]?.rev)
  const pageKey = hintKey.page
  const newsKey = hintKey.news
  const nudgeKey = hintKey.nudge
  const signalKey = (name: string) => `u:${name}`
  const tipKey = (id: string) => `p:${id}`
  const count = (name: string) => state.records.get(signalKey(name))?.count ?? 0

  function interrupted(): boolean {
    try {
      return sessionStorage.getItem(sessionKey) === "1"
    } catch {
      return false
    }
  }

  function spend(): void {
    try {
      sessionStorage.setItem(sessionKey, "1")
    } catch {
      return
    }
  }

  async function flush(): Promise<void> {
    clearTimeout(flushTimer)
    flushTimer = undefined
    if (!pending.size) return
    const deltas = [...pending.values()]
    pending.clear()
    try {
      await storage.save(deltas)
    } catch {
      for (const d of deltas) if (!pending.has(d.key)) pending.set(d.key, d)
    }
  }

  function flushOnLeave(): void {
    if (!pending.size) return
    const deltas = [...pending.values()]
    pending.clear()
    if (storage.saveOnLeave) storage.saveOnLeave(deltas)
    else void storage.save(deltas)
  }

  function record(key: string, delta: Omit<HintDelta, "key">): void {
    state.records.set(key, merge(state.records.get(key), delta))
    const queued = pending.get(key)
    pending.set(key, {
      key,
      state: delta.state ?? queued?.state,
      dismissed: delta.dismissed ?? queued?.dismissed,
      add: (queued?.add ?? 0) + (delta.add ?? 0),
    })
    flushTimer ??= setTimeout(() => void flush(), timing.flush)
  }

  const present = (page: string) => Object.keys(features).filter((id) => features[id]!.page === page && hints.present(id))

  function knownBefore(page: string): boolean {
    const marker = pages[page]?.known
    if (!marker) return false
    try {
      return Object.keys(localStorage).some((key) => key.startsWith(marker))
    } catch {
      return false
    }
  }

  function baseline(page: string): void {
    for (const id of present(page)) if (!state.records.has(featureKey(id))) record(featureKey(id), { state: "seen" })
  }

  const fresh: ComputedRef<string[]> = computed(() => {
    const page = state.page
    if (!page || !state.loaded || state.tour.open || !state.records.has(pageKey(page))) return []
    return present(page)
      .filter((id) => {
        const f = features[id]!
        const rec = state.records.get(featureKey(id))
        if (!rec) return !f.conditional || (f.rev ?? 1) > 1
        return !!f.required && RANK[rec.state] < RANK.explained && !rec.dismissed
      })
      .sort((a, b) => Number(!!features[b]!.required) - Number(!!features[a]!.required) || (features[a]!.order ?? 0) - (features[b]!.order ?? 0))
      .slice(0, timing.freshLimit)
  })

  const notes: ComputedRef<Record<string, HintNote>> = computed(() =>
    Object.fromEntries(Object.entries(features).map(([id, f]) => [id, { title: f.title, text: f.text }])),
  )

  const showable = (id: string) => hints.present(id) || hints.hasExample(id)
  const lit = (id: string, f: HintFeature) => !!f.target || !!f.enter || showable(id)
  const tourable = (page: string, only?: string[]) =>
    Object.entries(features)
      .filter(([id, f]) => f.page === page && (!only || only.includes(id)) && lit(id, f))
      .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
  const hasTour = (page = state.page) => tourable(page).length > 0

  function startTour(page = state.page, only?: string[]): void {
    const entries = tourable(page, only)
    if (!entries.length) return
    state.offer = null
    Object.assign(state.tour, {
      open: true,
      step: 0,
      page,
      ids: entries.map(([id]) => id),
      steps: entries.map(([id, f]) => ({
        target: f.target ?? id,
        hint: id,
        title: f.title,
        text: f.text,
        keys: f.keys,
        try: f.try,
        side: f.side,
        enter: f.enter,
      })),
    })
  }

  const unread = (page?: string) =>
    news.filter((n) => (!page || n.page === page) && !state.records.has(newsKey(n.id)) && (!page || !n.feature || showable(n.feature)))

  function readNews(page: string): void {
    for (const n of unread(page)) record(newsKey(n.id), { state: "explained" })
  }

  function considerOffer(): void {
    const page = state.page
    const ready = state.loaded && !state.tour.open && !state.offer && !anyModalOpen() && !typing()
      && Date.now() - state.settledAt > timing.settle
    if (!page || !ready) return
    const rec = state.records.get(pageKey(page))
    if (rec?.assigned && RANK[rec.state] < RANK.explained && hasTour(page)) {
      state.offer = { kind: "assigned", page }
      return
    }
    if (state.intent || interrupted()) return
    if (!rec && knownBefore(page)) {
      record(pageKey(page), { state: "seen" })
      baseline(page)
    } else if (
      !rec
      || (!rec.dismissed && RANK[rec.state] < RANK.explained && rec.count < timing.offersMax
        && Date.now() - Date.parse(rec.updatedAt || "0") > timing.offerAgain)
    ) {
      if (!hasTour(page)) return
      spend()
      if (!rec) {
        record(pageKey(page), { state: "seen" })
        baseline(page)
        readNews(page)
      }
      state.offer = { kind: "tour", page }
      return
    }
    const items = unread(page)
    if (items.length) {
      spend()
      state.offer = { kind: "news", page, items: items.slice(0, 3) }
      return
    }
    const n = state.candidate
    if (n && n.page === page) {
      const seen = state.records.get(nudgeKey(n.id))
      const f = features[n.feature]
      const visible = !!f && lit(n.feature, f)
      if (!seen?.dismissed && state.records.get(featureKey(n.feature))?.state !== "used" && visible
        && !(seen && Date.now() - Date.parse(seen.updatedAt) < timing.nudgeAgain)) {
        state.candidate = null
        spend()
        record(nudgeKey(n.id), { add: 1 })
        state.offer = { kind: "nudge", page, nudge: n }
        return
      }
    }
    for (const tip of tips) {
      const seen = state.records.get(tipKey(tip.id))
      if (seen?.dismissed || (seen?.count ?? 0) >= (tip.max ?? TIP_MAX)) continue
      if (seen && Date.now() - Date.parse(seen.updatedAt) < timing.nudgeAgain) continue
      if (!tip.when(count)) continue
      spend()
      record(tipKey(tip.id), { add: 1 })
      state.offer = { kind: "tip", page, tip, step: tip.step?.() ?? null }
      return
    }
  }

  let stops: (() => void)[] = []

  function start(): void {
    if (stops.length) return
    const stopPage: WatchStopHandle = watch(
      () => state.overlay ?? options.page(),
      (page) => {
        state.page = page
        state.settledAt = Date.now()
        if (state.offer && state.offer.page !== page) state.offer = null
        if (state.candidate && state.candidate.page !== page) state.candidate = null
        setTimeout(() => (state.intent = false), timing.settle * 2)
      },
      { immediate: true },
    )
    const stopNavigate = watch(options.page, (page, previous) => {
      if (previous !== undefined && page !== previous) record(signalKey(HINT_SIGNALS.navigate), { add: 1 })
    })
    const poll = setInterval(() => {
      try {
        considerOffer()
      } catch (error) {
        console.warn("[hints] disabled after an error:", error)
        stop()
      }
    }, 1000)
    window.addEventListener("pagehide", flushOnLeave)
    stops = [
      stopPage,
      stopNavigate,
      hints.on("used", (id) => {
        if (features[id]) record(featureKey(id), { state: "used", add: 1 })
        if (id.startsWith("lp.") || !features[id]) record(signalKey(id), { add: 1 })
      }),
      () => clearInterval(poll),
      () => window.removeEventListener("pagehide", flushOnLeave),
    ]
  }

  function stop(): void {
    for (const s of stops.splice(0)) s()
    flushOnLeave()
  }

  return {
    state,
    fresh,
    notes,
    start,
    stop,
    hasTour,
    startTour,
    async load(): Promise<void> {
      state.records.clear()
      try {
        for (const [key, rec] of Object.entries(await storage.load())) state.records.set(key, rec)
        state.loaded = true
      } catch {
        state.loaded = false
      }
    },
    /** Ask for a nudge; it shows when the budget and the page allow. */
    nudge(n: HintNudge): void {
      state.candidate = { ...n, page: state.page }
    },
    /**
     * A dialog acts as its own page while open (its dots and tour), then hands
     * back. Pass null on close, and on unmount: a dialog left open by a route
     * change would otherwise keep the page.
     */
    overlay(page: string | null): void {
      state.overlay = page
    },
    /** How many times a signal was reported (for an app's own tips or reports). */
    count,
    /** The user navigated on purpose (palette, notification): do not interrupt this arrival. */
    markIntent(): void {
      state.intent = true
    },
    unreadNews: (page?: string) => unread(page),
    readNews,
    pageTitle: (page: string) => pages[page]?.title ?? page,
    readFresh(id: string): void {
      record(featureKey(id), { state: "explained" })
    },
    tourShown(index: number): void {
      const id = state.tour.ids[index]
      if (id) record(featureKey(id), { state: "explained" })
    },
    tourEnded(finished: boolean): void {
      if (!state.tour.ids.length) return
      record(pageKey(state.tour.page), finished ? { state: "explained" } : { add: 1 })
      baseline(state.tour.page)
    },
    answer(choice: "show" | "later" | "never"): void {
      const offer = state.offer
      state.offer = null
      if (!offer) return
      if (offer.kind === "news") {
        const ids = offer.items.map((n) => n.feature).filter((id): id is string => !!id)
        readNews(offer.page)
        if (choice === "show" && ids.length) startTour(offer.page, ids)
      } else if (offer.kind === "tip") {
        if (choice === "never") record(tipKey(offer.tip.id), { dismissed: true })
        if (choice === "show" && offer.step) {
          Object.assign(state.tour, { open: true, step: 0, page: offer.page, ids: [], steps: [offer.step] })
        }
      } else if (offer.kind === "nudge") {
        if (choice === "show") startTour(features[offer.nudge.feature]!.page, [offer.nudge.feature])
        else record(nudgeKey(offer.nudge.id), { dismissed: true })
      } else if (choice === "show") {
        startTour(offer.page)
      } else {
        record(pageKey(offer.page), { add: 1, dismissed: choice === "never" })
        baseline(offer.page)
      }
    },
  }
}

export type HintSystem = ReturnType<typeof createHintSystem>

const HINT_SYSTEM: InjectionKey<HintSystem> = Symbol.for("lp-hint-system")

/*
 * Overlays (the palette, menus) are portalled siblings of the host, not its
 * descendants, so injection alone would never reach them: the mounted host is
 * also kept here.
 */
const running = shallowRef<HintSystem | null>(null)

export function provideHintSystem(system: HintSystem): void {
  provide(HINT_SYSTEM, system)
  running.value = system
  onBeforeUnmount(() => {
    if (running.value === system) running.value = null
  })
}

export function useHintSystem(): HintSystem | null {
  return inject(HINT_SYSTEM, null) ?? running.value
}

/** The mounted host's system, read reactively from anywhere. */
export function runningHintSystem(): HintSystem | null {
  return running.value
}
