/*
 * ANSI colour codes (SGR) in log text: a server console coloured its lines,
 * and the viewer showed them as plain text, or as `\x1b[33m` junk. The codes
 * are taken out of the text and kept as styled runs over it, so search,
 * copying and the level colouring all work on the plain text.
 *
 * The sixteen named colours map onto the theme's own tokens, so a console
 * reads right in the light and the dark theme alike; 256-colour and
 * true-colour codes keep their exact colour.
 */

export interface LogColorRun {
  /** Offsets into the plain text, end exclusive. */
  start: number
  end: number
  /** A CSS colour. */
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

/** The sixteen named colours, normal then bright, as theme tokens. */
const NAMED: readonly string[] = [
  "var(--color-muted)",
  "var(--color-danger)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-brand)",
  "color-mix(in srgb, var(--color-danger) 55%, var(--color-brand))",
  "color-mix(in srgb, var(--color-brand) 60%, var(--color-success))",
  "var(--color-ink)",
]

/** Every SGR sequence, and any other CSI sequence, which is dropped. */
const CSI = /\x1b\[([0-9;?]*)([ -/]*[@-~])/g

/** The xterm 256-colour palette's colour for `index` (16–255). */
function xterm(index: number): string {
  if (index < 16) return NAMED[index % 8]
  if (index >= 232) {
    const level = 8 + (index - 232) * 10
    return `rgb(${level}, ${level}, ${level})`
  }
  const cube = index - 16
  const step = (value: number) => (value === 0 ? 0 : 55 + value * 40)
  return `rgb(${step(Math.floor(cube / 36))}, ${step(Math.floor(cube / 6) % 6)}, ${step(cube % 6)})`
}

interface Style {
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

function apply(style: Style, codes: number[]): Style {
  const next = { ...style }
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]
    if (code === 0) {
      next.color = undefined
      next.bold = next.italic = next.underline = undefined
    } else if (code === 1) next.bold = true
    else if (code === 3) next.italic = true
    else if (code === 4) next.underline = true
    else if (code === 22) next.bold = undefined
    else if (code === 23) next.italic = undefined
    else if (code === 24) next.underline = undefined
    else if (code === 39) next.color = undefined
    else if (code >= 30 && code <= 37) next.color = NAMED[code - 30]
    else if (code >= 90 && code <= 97) next.color = NAMED[code - 90]
    else if (code === 38 && codes[i + 1] === 5) {
      next.color = xterm(codes[i + 2] ?? 7)
      i += 2
    } else if (code === 38 && codes[i + 1] === 2) {
      next.color = `rgb(${codes[i + 2] ?? 0}, ${codes[i + 3] ?? 0}, ${codes[i + 4] ?? 0})`
      i += 4
    } else if (code === 48 && (codes[i + 1] === 5 || codes[i + 1] === 2)) {
      // Backgrounds are left out: a console's black or white background
      // behind a word fights the viewer's own surface in either theme.
      i += codes[i + 1] === 5 ? 2 : 4
    }
  }
  return next
}

function styled(style: Style): boolean {
  return !!(style.color || style.bold || style.italic || style.underline)
}

/** `raw` without its escape codes, and the styled runs the codes described. */
export function parseAnsi(raw: string): { text: string; runs: LogColorRun[] } {
  if (!raw.includes("\x1b")) return { text: raw, runs: [] }
  let text = ""
  const runs: LogColorRun[] = []
  let style: Style = {}
  let from = 0
  const close = (end: number) => {
    if (end > from && styled(style)) runs.push({ start: from, end, ...style })
  }
  let last = 0
  for (const match of raw.matchAll(CSI)) {
    text += raw.slice(last, match.index)
    last = match.index + match[0].length
    if (match[2] !== "m") continue
    close(text.length)
    const codes = match[1] === "" ? [0] : match[1].split(";").map((part) => Number(part) || 0)
    style = apply(style, codes)
    from = text.length
  }
  text += raw.slice(last)
  close(text.length)
  return { text, runs }
}

/** A plain stretch of a message cut where its colour changes. */
export interface ColorPiece {
  text: string
  style?: Record<string, string>
}

/** `text`, found at `offset` in the message, cut along the runs over it. */
export function colorPieces(text: string, offset: number, runs: readonly LogColorRun[] | undefined): ColorPiece[] {
  if (!runs?.length) return [{ text }]
  const pieces: ColorPiece[] = []
  const end = offset + text.length
  let at = offset
  for (const run of runs) {
    if (run.end <= at || run.start >= end) continue
    if (run.start > at) pieces.push({ text: text.slice(at - offset, run.start - offset) })
    const stop = Math.min(run.end, end)
    const style: Record<string, string> = {}
    if (run.color) style.color = run.color
    if (run.bold) style.fontWeight = "600"
    if (run.italic) style.fontStyle = "italic"
    if (run.underline) style.textDecoration = "underline"
    pieces.push({ text: text.slice(Math.max(run.start, at) - offset, stop - offset), style })
    at = stop
  }
  if (at < end) pieces.push({ text: text.slice(at - offset) })
  return pieces
}
