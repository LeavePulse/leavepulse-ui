import { computed, inject, onBeforeUnmount, provide, reactive, shallowRef, watch, type ComputedRef, type InjectionKey, type WatchStopHandle } from "vue"
import type { HintNote } from "../components/LpHintLayer.vue"
import type { TourContext, TourStep } from "../components/LpTour.vue"
import { anyModalOpen } from "../components/modalDepth"
import { HINT_SIGNALS } from "./hintSignals"
import { RANK, hintKey, localHintStorage, mergeHintRecord, type HintDelta, type HintRecord, type HintStorage } from "./hintRecords"
import type { HintTip } from "./hintTips"
import { isTextEntry } from "./textEntry"
import { hints } from "./useHints"

// The system's parts live beside it; re-exported so this stays the one import.
export { HINT_SIGNALS, noteContextTarget, noteDropzone, noteHotkeyTarget } from "./hintSignals"
export { hintKey, hintSummary, localHintStorage } from "./hintRecords"
export type { HintDelta, HintLevel, HintRecord, HintStorage, HintSummary } from "./hintRecords"
export { contextMenuTip, dropzoneTip, hotkeyTip, paletteTip } from "./hintTips"
export type { HintTip } from "./hintTips"

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

export interface HintTiming {
  settle: number
  offerAgain: number
  offersMax: number
  freshLimit: number
  nudgeAgain: number
  flush: number
  /** How long a news item opened from a feed waits for its page and feature, ms. */
  newsWait: number
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

const DAY = 24 * 3600 * 1000
const DEFAULT_TIMING: HintTiming = {
  settle: 2500,
  offerAgain: 3 * DAY,
  offersMax: 2,
  freshLimit: 3,
  nudgeAgain: 7 * DAY,
  flush: 2000,
  newsWait: 8000,
}

function typing(): boolean {
  return isTextEntry(document.activeElement, { inputType: () => true })
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
    state.records.set(key, mergeHintRecord(state.records.get(key), delta))
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

  // A news item opened from a feed elsewhere (a notification bell): the app
  // navigates, and the change is shown as soon as its page is up and the thing
  // (or its sample) is there to point at. Waiting is bounded: an item whose
  // feature never appears is only marked read.
  let pendingNews: (() => void) | null = null

  function showNews(id: string): void {
    const item = news.find((n) => n.id === id)
    if (!item) return
    record(newsKey(item.id), { state: "explained" })
    const feature = item.feature
    if (!feature) return
    pendingNews?.()
    let done = false
    let stopWatch: WatchStopHandle | undefined
    const finish = () => {
      done = true
      clearTimeout(timer)
      stopWatch?.()
      if (pendingNews === finish) pendingNews = null
    }
    const timer = setTimeout(finish, timing.newsWait)
    pendingNews = finish
    stopWatch = watch(
      () => state.page === item.page && showable(feature) && !state.tour.open,
      (ready) => {
        if (!ready || done) return
        finish()
        startTour(item.page, [feature])
      },
      { immediate: true },
    )
    if (done) stopWatch()
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
    /** Open one news item from a feed: mark it read and show its feature once the app is on its page. */
    showNews,
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
