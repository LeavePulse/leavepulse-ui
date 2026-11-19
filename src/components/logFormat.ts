/*
 * How LpLogViewer reads and writes a line, free of the component: the level
 * colours, the opt-in recognition of common formats (`parse`), the time
 * column and the line as one copyable string.
 */
import type { LogLevel, LogLine } from "./logViewerTypes"
import { TONES, toneLook, type ToneName } from "./tone"

/** The order the toolbar's level chips appear in. */
export const LOG_LEVEL_ORDER: LogLevel[] = ["trace", "debug", "info", "success", "warn", "error", "fatal"]

export interface LogLevelLook {
  rail: string
  text: string
  chip: string
  sel: string
}

// Level → gutter rail + text colour. Reads only semantic tokens so re-skinning
// just works. trace/debug stay muted; success is green; warn amber; error/fatal
// red (fatal gets a filled chip to stand apart from plain error).
// `sel` tints ::selection in the row's semantic colour (info→brand, warn→accent,
// error/fatal→danger) via Tailwind's `selection:` variant — the highlight then
// matches the level instead of the browser default. The toned levels read the
// kit's tones (tone.ts, where the classes are spelled out whole for Tailwind's
// scan); trace and debug are quieter than any tone, two steps of grey.
const toned = (tone: ToneName): LogLevelLook => {
  const look = toneLook(tone)
  return { rail: look.bg, text: "text-ink", chip: look.text, sel: look.selection }
}
const levelMeta: Record<LogLevel, LogLevelLook> = {
  trace: { rail: "bg-line-strong", text: "text-muted", chip: "text-muted", sel: TONES.neutral.selection },
  debug: { rail: "bg-line-strong", text: "text-muted-strong", chip: "text-muted-strong", sel: "selection:bg-muted-strong/40" },
  info: toned("info"),
  success: toned("success"),
  warn: toned("warning"),
  error: toned("error"),
  fatal: { ...toned("error"), chip: `rounded-xs px-1 text-ink-inverse ${TONES.danger.bg}` },
}

/** The classes a line of this level is drawn with; a line without one reads as info. */
export function logLevelLook(level?: LogLevel): LogLevelLook {
  return levelMeta[level ?? "info"]
}

// ── format recognition (opt-in via `parse`) ──────────────────────────────
// Map a recognised level word to a canonical LogLevel; unknown → undefined.
const LEVEL_WORDS: Record<string, LogLevel> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  notice: "info",
  warn: "warn",
  warning: "warn",
  error: "error",
  err: "error",
  fatal: "fatal",
  crit: "fatal",
  critical: "fatal",
  panic: "fatal",
  success: "success",
  ok: "success",
}
// Leading ISO-8601 / "YYYY-MM-DD HH:MM:SS" timestamp, optionally bracketed.
const TS_RE =
  /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)\]?\s+/
// A leading LEVEL token, optionally followed by ':' .
const LEVEL_RE = /^([A-Za-z]{2,8})\s*:?\s+/
// A leading "[source]" tag.
const SOURCE_RE = /^\[([^\]]{1,40})\]\s+/

// Pull level/time/source out of a raw message; only fields not already set on
// the line are filled, and only the recognised prefixes are stripped from the
// body — so an unrecognised line is returned unchanged.
export function parseLogLine(line: LogLine): LogLine {
  let msg = line.message
  let time = line.time
  let level = line.level
  let source = line.source

  // 1) timestamp prefix
  if (time == null) {
    const m = TS_RE.exec(msg)
    if (m) {
      time = m[1]
      msg = msg.slice(m[0].length)
    }
  } else {
    // strip a duplicate leading timestamp even if time is already set
    const m = TS_RE.exec(msg)
    if (m) msg = msg.slice(m[0].length)
  }

  // 2) level word
  const lm = LEVEL_RE.exec(msg)
  if (lm) {
    const canon = LEVEL_WORDS[lm[1].toLowerCase()]
    if (canon) {
      if (level == null) level = canon
      msg = msg.slice(lm[0].length) // drop the duplicate word from the body
    }
  }

  // 3) [source] tag
  if (source == null) {
    const sm = SOURCE_RE.exec(msg)
    if (sm) {
      source = sm[1]
      msg = msg.slice(sm[0].length)
    }
  }

  return msg === line.message && time === line.time && level === line.level && source === line.source
    ? line
    : { ...line, message: msg, time, level, source }
}

/** The time column: epoch ms as a local time with milliseconds, anything else as given. */
export function formatLogTime(time?: number | string): string {
  if (time == null) return ""
  if (typeof time === "number" || /^\d+$/.test(time)) {
    const d = new Date(Number(time))
    if (Number.isNaN(d.getTime())) return String(time)
    return d.toLocaleTimeString(undefined, { hour12: false }) + "." +
      String(d.getMilliseconds()).padStart(3, "0")
  }
  return time
}

/** The whole line as one copyable string: "time LEVEL [source] message". */
export function logLineText(line: LogLine): string {
  return [formatLogTime(line.time), line.level?.toUpperCase(), line.source && `[${line.source}]`, line.message]
    .filter(Boolean)
    .join(" ")
}
