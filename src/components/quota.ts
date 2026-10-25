import { CHART_PALETTE } from "./chart"
import { formatBytes } from "./format"
import { capacityThresholds, toneAt, type MeterTone } from "./meter"

/*
 * The arithmetic behind LpQuota, kept free of Vue so it can be tested and so an
 * app that only needs "how much is left, and how worried should I be" can ask
 * it directly.
 */

/** One part of what is used, for a stacked bar ("Images 12 GB, Backups 30 GB"). */
export interface QuotaPart {
  label: string
  value: number
  /** Any CSS colour. Unset parts take the chart palette in order, like LpChart's series (minus danger). */
  color?: string
}

/**
 * How amounts are written. `"bytes"` scales to the largest whole unit (1 536 →
 * 1.5 KB) in binary steps, the way storage limits are sold and shown; any
 * other string is a plain suffix ("seats", "req/min"); a function says it its
 * own way.
 */
export type QuotaUnit = "bytes" | string | ((value: number) => string)

export interface QuotaState {
  /** Share of the limit used, 0–1 and beyond: 1.25 is a quarter over. */
  ratio: number
  /** What is left; zero once over. */
  remaining: number
  /** By how much the limit is exceeded; zero within it. */
  over: number
  /** False when there is no limit to measure against (unset, zero, Infinity). */
  limited: boolean
  tone: MeterTone
}

/**
 * Where a quota stands. Thresholds are shares of the limit, read on the same
 * capacity scale (and with the same defaults) as LpProgress's `auto` tone and
 * LpGauge, so a quota and a gauge of one disk turn red together; anything past
 * the limit is danger whatever they say, because "over" is the one state a
 * quota must never paint as merely amber.
 */
export function quotaState(
  used: number,
  limit: number | null | undefined,
  warnAt = 0.8,
  dangerAt = 0.9,
): QuotaState {
  const safeUsed = Number.isFinite(used) ? Math.max(0, used) : 0
  const limited = limit != null && Number.isFinite(limit) && limit > 0
  if (!limited) return { ratio: 0, remaining: Infinity, over: 0, limited, tone: "ok" }
  const ratio = safeUsed / limit
  const tone = ratio > 1 ? "danger" : toneAt(ratio, capacityThresholds(0, 1, warnAt, dangerAt))
  return {
    ratio,
    remaining: Math.max(0, limit - safeUsed),
    over: Math.max(0, safeUsed - limit),
    limited,
    tone,
  }
}

/**
 * An amount in its unit, locale-aware. Bytes go through `formatBytes`, whose
 * unit names come from Intl, so a Russian app reads "1,5 ГБ" without a
 * translation table of its own.
 */
export function formatAmount(value: number, unit?: QuotaUnit, locale?: string): string {
  if (typeof unit === "function") return unit(value)
  if (unit === "bytes") return formatBytes(Math.max(0, value), locale)
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)
  return unit ? `${number} ${unit}` : number
}

/*
 * Parts are categories, not verdicts, so the palette leaves out danger: a red
 * "Backups" slice would read as an alarm about backups.
 */
const PART_PALETTE = CHART_PALETTE.filter((c) => !c.includes("danger"))

export interface QuotaSegment extends QuotaPart {
  color: string
  /** Share of the bar's width, 0–1. */
  share: number
}

/**
 * The parts laid out along the bar. Within the limit the bar's width IS the
 * limit, so a part's share is its value over the limit and the rest of the
 * track is what remains. Over it, the bar stretches to hold everything used and
 * the limit becomes a mark partway along (`limitAt`), so the overflow reads as
 * the part of the bar beyond the line rather than as a bar that simply stopped
 * at full.
 */
export function quotaSegments(
  parts: readonly QuotaPart[],
  limit: number | null | undefined,
): { segments: QuotaSegment[]; limitAt: number | null } {
  const total = parts.reduce((sum, p) => sum + Math.max(0, p.value), 0)
  const limited = limit != null && Number.isFinite(limit) && limit > 0
  const scale = limited ? Math.max(limit, total) : total
  const segments = parts.map((p, i) => ({
    ...p,
    color: p.color ?? PART_PALETTE[i % PART_PALETTE.length],
    share: scale > 0 ? Math.max(0, p.value) / scale : 0,
  }))
  return { segments, limitAt: limited && total > limit ? limit / total : null }
}
