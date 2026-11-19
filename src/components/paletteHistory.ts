import { computed, type ComputedRef, type Ref } from "vue"
import { usePersisted } from "../composables/usePersisted"
import { parseCommandQuery } from "./commandSearch"
import {
  commandKey,
  pushRecent,
  readRecent,
  recentKey,
  recentVisible,
  resolveRecentItems,
  toRecentItem,
  type RecentEntry,
  type RecentItem,
} from "./commandPalette"
import type { Command } from "./commandPaletteTypes"

/*
 * LpCommandPalette's memory of what was picked: the recent history and the
 * pinned rows, kept by the app (`recent`, `pinned`) or by the palette in the
 * kit's storage (`recentKey`, `pinnedKey`), and where each of those rows was
 * found, so a row out of a mode runs and is remembered under its own path.
 */
export interface PaletteHistoryOptions {
  recent: () => RecentItem[] | undefined
  recentKey: () => string | undefined
  pinned: () => RecentItem[] | undefined
  pinnedKey: () => string | undefined
  resolveRecent: () => ((entry: RecentEntry) => Command | null | undefined) | undefined
  recentLimit: () => number
  recentLabel: () => string
  pinnedHeading: () => string
  rootCommands: ComputedRef<Command[]>
  mode: ComputedRef<Command | null>
  query: Ref<string>
  trail: Ref<Command[]>
  /** The "Show N more" row of a folded group, which is not a command. */
  isMore: (command: Command) => boolean
  onRemember: (item: RecentItem, command: Command) => void
  onPinned: (items: RecentItem[]) => void
}

const RECENT_KEEP = 20

function fromEntry(entry: RecentEntry): Command {
  return { id: entry.id, label: entry.label, description: entry.description, icon: entry.icon, image: entry.image, href: entry.href }
}

export function usePaletteHistory(options: PaletteHistoryOptions) {
  const { rootCommands, mode, query, trail } = options

  // Kept in the kit's storage (the app's own, or the browser's made safe), and
  // re-checked on the way in: a list written by an older version or by hand
  // passes through readRecent before the palette shows any of it.
  const storedRecent = usePersisted<unknown>(options.recentKey, [])
  const ownRecent = computed<RecentItem[]>({
    get: () => readRecent(storedRecent.value),
    set: (list) => (storedRecent.value = list),
  })

  /*
   * Where each recent row was found, so running it again remembers it under
   * the same path rather than as a root pick. Modes the palette makes up
   * itself (Tab's actions) are not destinations, and nothing picked in them
   * is remembered.
   */
  const recentPath = new WeakMap<Command, string[]>()
  const syntheticModes = new WeakSet<Command>()
  const inSyntheticMode = () => trail.value.some((step) => syntheticModes.has(step))

  function pathOf(c: Command): string[] {
    return recentPath.get(c) ?? trail.value.map((step) => step.id)
  }

  /* A root pick that is not a root command is something a search found. */
  function historyItem(c: Command): RecentItem {
    const path = pathOf(c)
    return toRecentItem(c, path, !path.length && !rootCommands.value.some((root) => root.id === c.id))
  }

  function remember(c: Command) {
    if (c.remember === false || inSyntheticMode()) return
    const item = historyItem(c)
    options.onRemember(item, c)
    const key = options.recentKey()
    if (!key || options.recent()) return
    ownRecent.value = pushRecent(ownRecent.value, item, RECENT_KEEP)
  }
  const recentList = computed(() => options.recent() ?? (options.recentKey() ? ownRecent.value : []))

  /*
   * Shown while no words are typed: at an empty box, and under operators
   * alone, which filter them like any row ("-theme", "in:recent").
   */
  const recentItems = computed<Command[]>(() => {
    if (mode.value || !recentList.value.length) return []
    const terms = parseCommandQuery(query.value)
    if (terms.include.length) return []
    const found = resolveRecentItems(recentList.value, rootCommands.value, {
      limit: Number.POSITIVE_INFINITY,
      resolve: options.resolveRecent(),
      fromEntry,
    })
    const out: Command[] = []
    for (const { command, path } of found) {
      if (out.length >= options.recentLimit()) break
      if (out.includes(command) || !recentVisible(command, terms, options.recentLabel())) continue
      recentPath.set(command, path)
      out.push(command)
    }
    return out
  })

  const storedPinned = usePersisted<unknown>(() => {
    const key = options.recentKey()
    return options.pinnedKey() ?? (key ? `${key}:pinned` : undefined)
  }, [])
  const pinList = computed(() => options.pinned() ?? readRecent(storedPinned.value))
  const pinResolved = computed(() => resolveRecentItems(pinList.value, rootCommands.value, { limit: Infinity, resolve: options.resolveRecent(), fromEntry }))
  const pinnedItems = computed(() => {
    if (mode.value || parseCommandQuery(query.value).include.length) return []
    return pinResolved.value.filter(({ command }) => recentVisible(command, parseCommandQuery(query.value), options.pinnedHeading())).map(({ command, path }) => { recentPath.set(command, path); return command })
  })
  function isPinned(command: Command) {
    const key = commandKey(command.id, pathOf(command))
    return pinList.value.some(item => recentKey(item) === key)
  }
  function togglePin(command: Command | undefined) {
    if (!command || options.isMore(command) || command.children || inSyntheticMode()) return
    const key = commandKey(command.id, pathOf(command))
    const next = isPinned(command) ? pinList.value.filter(item => recentKey(item) !== key)
      : pushRecent(pinList.value, historyItem(command), Infinity)
    if (options.pinned() === undefined) storedPinned.value = next
    options.onPinned(next)
  }

  /*
   * A row's identity on screen. The same id can sit in one list twice, a root
   * command beside a recent pick from a mode, and they are different rows.
   */
  function rowId(c: Command): string {
    return commandKey(c.id, recentPath.get(c))
  }

  return { recentItems, pinnedItems, syntheticModes, inSyntheticMode, remember, isPinned, togglePin, rowId }
}
