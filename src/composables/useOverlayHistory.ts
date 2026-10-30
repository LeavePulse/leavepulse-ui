import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  provide,
  toValue,
  watch,
  type InjectionKey,
  type MaybeRefOrGetter,
} from "vue"
import { dropEntry, isLive, pushEntry, setHistoryRouter, type HistoryEntry, type HistoryRouter } from "./overlayHistory"

/*
 * Browser Back and Forward for overlays. With it on, opening a modal or a
 * drawer adds a history entry and Back closes the topmost one instead of
 * leaving the page; nested overlays close one per press, top first. Switching
 * tabs inside an open overlay adds an entry too, so Back returns to the
 * previous tab before it closes the overlay. Closing through the UI (the close
 * button, Escape, the scrim, the app setting `open` to false) takes the entry
 * back out, so Back is never spent on a step that no longer shows anything.
 *
 * Off unless the app turns it on, like `provideGlass`: an app that already
 * keeps some overlay in its route query would otherwise get two entries for
 * one dialog. `history` on a single overlay (or tab bar) still wins.
 *
 * - `true`: Back closes; Forward after it does nothing (the step is undone at
 *   once, so the Forward button does not leave a dead entry). The kit only
 *   sees a boolean `open`, and whatever the app put into the overlay may be
 *   gone by then: a record deleted, a selection changed.
 * - `"reopen"`: Forward also opens it again, by emitting `update:open` true,
 *   while the overlay is still mounted. For overlays whose content does not
 *   depend on a moment that passed (settings, help, a fixed form).
 * - `false`: the overlay never touches history.
 */
export type OverlayHistoryMode = boolean | "reopen"

const MODE: InjectionKey<MaybeRefOrGetter<OverlayHistoryMode>> = Symbol("lp-overlay-history")

interface OverlayScope {
  /** Whether a step recorded now would sit on the overlay's own entry. */
  active: () => boolean
}
const SCOPE: InjectionKey<OverlayScope> = Symbol("lp-overlay-history-scope")

export interface ProvideOverlayHistoryOptions {
  /**
   * The app's router, so a Back or Forward that only closes an overlay does
   * not reach it as a navigation (vue-router: the router instance). Its
   * popstate listener runs before the kit's, so without this it sees each of
   * those steps as a visit to the page it is already on: guards and
   * `afterEach` run again and the route object is replaced, though nothing
   * remounts. One router per page; the latest one given is used.
   */
  router?: HistoryRouter
}

/** Turn browser history on for every overlay below the calling component. */
export function provideOverlayHistory(
  mode: MaybeRefOrGetter<OverlayHistoryMode> = true,
  options: ProvideOverlayHistoryOptions = {},
): void {
  provide(MODE, mode)
  if (options.router) setHistoryRouter(options.router)
}

export interface OverlayHistoryOptions {
  /** The overlay's own `history` prop; `undefined` follows `provideOverlayHistory`. */
  mode: () => OverlayHistoryMode | undefined
  open: () => boolean
  /** Back left the entry: close the way the overlay's own ways out do. */
  close: () => Promise<unknown>
  /** Forward under `"reopen"`: ask the app to open it again (`update:open` true). */
  reopen: () => void
  /** The page went to another path: close without asking, the place it belonged to is gone. */
  navigated: () => void
}

/** Wire an overlay's `open` to a history entry. */
export function useOverlayHistory(options: OverlayHistoryOptions): void {
  const inherited = inject(MODE, false)
  const mode = computed<OverlayHistoryMode>(() => options.mode() ?? toValue(inherited))

  const entry: HistoryEntry = {
    alive: true,
    back: () => {
      // A guard, or an app that ignored `update:open`, kept it open: it still owns a step of history.
      void options.close().then(() =>
        nextTick(() => {
          if (entry.alive && options.open() && !isLive(entry)) pushEntry(entry)
        }),
      )
    },
    forward: () => {
      if (mode.value !== "reopen") return false
      options.reopen()
      void nextTick(() => {
        if (!options.open() && isLive(entry)) dropEntry(entry)
      })
      return true
    },
    navigated: () => {
      if (options.open()) options.navigated()
    },
  }

  watch(
    () => [options.open(), mode.value !== false] as const,
    ([open, enabled]) => {
      if (open && enabled) {
        if (!isLive(entry)) pushEntry(entry)
      } else if (isLive(entry)) {
        dropEntry(entry)
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    entry.alive = false
    if (isLive(entry)) dropEntry(entry)
  })

  provide(SCOPE, { active: () => mode.value !== false && options.open() && isLive(entry) })
}

export interface StepHistoryOptions {
  /** The component's own `history` prop; `undefined` follows the overlay it sits in. */
  mode: () => boolean | undefined
  /** Show this value without recording it. */
  set: (value: string) => void
  /** Whether the value can still be shown (the tab exists and is enabled). */
  has: (value: string) => boolean
}

/**
 * Steps inside an overlay (a tab switch) as history entries. Outside an overlay
 * it is off unless asked for: a page's own tabs belong in its URL, where the
 * app's router already keeps them.
 */
export function useStepHistory(options: StepHistoryOptions): { record: (from: string, to: string) => void } {
  const scope = inject(SCOPE, null)
  const enabled = () => {
    const own = options.mode()
    if (own === false) return false
    if (scope) return scope.active()
    return own === true
  }
  const entries: HistoryEntry[] = []

  function record(from: string, to: string) {
    if (from === to || !enabled()) return
    const entry: HistoryEntry = {
      alive: true,
      back: () => options.set(from),
      forward: () => {
        if (!enabled() || !options.has(to)) return false
        options.set(to)
        return true
      },
    }
    entries.splice(0, entries.length, ...entries.filter(isLive), entry)
    pushEntry(entry)
  }

  onBeforeUnmount(() => {
    for (const entry of entries) entry.alive = false
    const first = entries.find(isLive)
    if (first) dropEntry(first)
  })

  return { record }
}
