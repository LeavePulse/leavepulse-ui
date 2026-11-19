/*
 * What the hint system remembers per person: one record per key whose state
 * only climbs (seen → explained → used), where the records are kept, and the
 * summary of a page a manager's view reads from them.
 */
import type { HintFeature } from "./useHintSystem"

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

/** How far each state has climbed. */
export const RANK: Record<HintLevel, number> = { seen: 0, explained: 1, used: 2 }

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
      for (const d of deltas) all[d.key] = mergeHintRecord(all[d.key], d)
      try {
        localStorage.setItem(key, JSON.stringify(all))
      } catch {
        return
      }
    },
  }
}

/** A record with a delta applied: the state only climbs, counts add up. */
export function mergeHintRecord(record: HintRecord | undefined, delta: Omit<HintDelta, "key">): HintRecord {
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
