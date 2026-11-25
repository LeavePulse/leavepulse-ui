/*
 * The public types of LpLogViewer, kept apart from the SFC so the viewer's
 * helpers can share them. LpLogViewer.vue re-exports every one.
 */

import type { LogColorRun } from "./ansi"

export interface LogViewerLabels {
  [key: string]: string
  empty: string
  frozen: string
  noMatch: string
  loadingOlder: string
  copyMessage: string
  copyLine: string
  copyTimestamp: string
  copied: string
  /** `{source}` is replaced by the line's source. */
  filterSource: string
  /** `{level}` is replaced by the line's level. */
  filterLevel: string
  /** `{n}` is replaced by the count. */
  identical: string
  jump: string
  search: string
  clearSearch: string
  previousMatch: string
  nextMatch: string
  /** `{current}` and `{total}` are replaced. */
  matchCount: string
  noMatches: string
  levels: string
  /** Toggle for reading the search as a regular expression. */
  regex: string
  invalidPattern: string
  sources: string
  groupRepeats: string
  download: string
  copySelection: string
}

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "success"

export interface LogLine {
  /** Body of the line. */
  message: string
  level?: LogLevel
  /** Epoch ms, ISO string, or pre-formatted label — shown in the time column. */
  time?: number | string
  /** Short origin tag (service / module), rendered as a dim chip. */
  source?: string
  /**
   * Colours over `message`, by offset: what `parseAnsi` takes out of a
   * console's ANSI-coloured line. Search hits and links still show over them.
   */
  runs?: LogColorRun[]
}
