/*
 * Colour conversion for LpColorPicker — kept out of the component so the maths
 * is testable on its own and reusable by anything that has to meet a colour
 * halfway (a swatch list, a theme editor, a chart legend).
 *
 * The picker works in HSV, not HSL: a saturation/value rectangle under a hue
 * rail is the shape everybody already knows from design tools, and it is the
 * one where dragging in a straight line does what the eye expects. HSL's
 * lightness axis collapses to white and black at both ends of the rectangle,
 * which wastes half the area on colours nobody is aiming for.
 *
 * Alpha travels alongside as 0..1 and is dropped from the output when it is
 * fully opaque — "#3b82f6" rather than "#3b82f6ff", since the short form is
 * what a person pastes into a stylesheet.
 */

/** Hue 0..360, saturation/value 0..1, alpha 0..1. */
export interface Hsv {
  h: number
  s: number
  v: number
  a: number
}

/** Channels 0..255, alpha 0..1. */
export interface Rgb {
  r: number
  g: number
  b: number
  a: number
}

/** The string shapes a caller can hand the picker, and ask back out of it. */
export type ColorFormat = "hex" | "rgb" | "hsl"

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Wraps rather than clamps: hue is a circle, and 370° is 10°, not 360°. */
export function normalizeHue(h: number): number {
  const wrapped = h % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export function clampHsv(c: Hsv): Hsv {
  return {
    h: normalizeHue(c.h),
    s: clamp(c.s, 0, 1),
    v: clamp(c.v, 0, 1),
    a: clamp(c.a, 0, 1),
  }
}

export function hsvToRgb({ h, s, v, a }: Hsv): Rgb {
  const hue = normalizeHue(h) / 60
  const c = v * s
  const x = c * (1 - Math.abs((hue % 2) - 1))
  const m = v - c
  // Sextant of the colour wheel; each one puts c/x/0 in a different order.
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[Math.floor(hue) % 6]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: clamp(a, 0, 1),
  }
}

export function rgbToHsv({ r, g, b, a }: Rgb): Hsv {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / d + 2)
    else h = 60 * ((rn - gn) / d + 4)
  }

  return {
    h: normalizeHue(h),
    s: max === 0 ? 0 : d / max,
    v: max,
    a: clamp(a, 0, 1),
  }
}

const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")

/** "#rrggbb", or "#rrggbbaa" when the colour is not fully opaque. */
export function rgbToHex({ r, g, b, a }: Rgb): string {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`
  return a >= 1 ? base : base + hex2(a * 255)
}

/**
 * Parses #rgb / #rgba / #rrggbb / #rrggbbaa, with or without the leading `#`.
 * Returns null for anything it doesn't recognise, so a half-typed value in the
 * hex field can be left alone instead of snapping the picker to black.
 */
export function parseHex(input: string): Rgb | null {
  const s = input.trim().replace(/^#/, "")
  if (!/^[0-9a-f]+$/i.test(s)) return null

  // The 3/4-digit forms double each digit: "f80" is "ff8800".
  const expand = (hex: string) =>
    hex.length <= 4 ? hex.split("").map((ch) => ch + ch) : (hex.match(/.{2}/g) ?? [])

  const parts = expand(s)
  if (s.length !== 3 && s.length !== 4 && s.length !== 6 && s.length !== 8) return null

  const [r, g, b, alpha] = parts.map((p) => parseInt(p, 16))
  return { r, g, b, a: alpha === undefined ? 1 : alpha / 255 }
}

/**
 * Parses a colour a person might paste: hex (3/4/6/8 digits, `#` optional),
 * rgb()/rgba() and hsl()/hsla() in both the comma and the space/slash forms,
 * percentages, hue in deg/turn/rad/grad, brackets optional, and a bare triple
 * of numbers read as rgb. A round-trip through a caller's storage therefore
 * comes back the colour it went in as, whatever shape it was stored in.
 *
 * Named colours ("rebeccapurple") and the newer spaces (lab, oklch, color())
 * are out of scope: resolving those needs the browser's own parser, and a
 * component that silently handled some and not others would be worse than one
 * that is clear about what it takes.
 */
export function parseColor(input: string): Rgb | null {
  const s = input.trim()
  if (!s) return null
  if (s.startsWith("#") || /^[0-9a-f]{3,8}$/i.test(s)) return parseHex(s)

  // Brackets optional, and a bare triple of numbers is taken as rgb. What gets
  // pasted into a colour field is rarely canonical CSS: it comes off a design
  // tool as "rgb 59 130 246", out of a spreadsheet as "59, 130, 246", or with
  // the closing bracket lost to a sloppy selection. All of them name a colour
  // unambiguously, and refusing them would be pedantry at the user's expense.
  const fn = s.match(/^(rgba?|hsla?)\s*\(?([^)]*)\)?$/i) ?? (
    /^[\d.,\s/%]+$/.test(s) ? ([null, "rgb", s] as unknown as RegExpMatchArray) : null
  )
  if (!fn) return null

  // Both the legacy comma form and the modern space form, with an optional
  // "/ alpha" — the two shapes browsers themselves accept.
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null

  // `deg` is the default unit and `turn`/`rad`/`grad` are the others CSS allows
  // for a hue; parseFloat drops the suffix, so only turn/rad/grad need scaling.
  const num = (t: string) => parseFloat(t)
  const angle = (t: string) => {
    const n = parseFloat(t)
    if (/turn$/i.test(t)) return n * 360
    if (/rad$/i.test(t)) return (n * 180) / Math.PI
    if (/grad$/i.test(t)) return n * 0.9
    return n
  }
  const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? num(parts[3]) / 100 : num(parts[3])
  if (Number.isNaN(alpha)) return null

  if (fn[1].toLowerCase().startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map((t) => (t.endsWith("%") ? (num(t) / 100) * 255 : num(t)))
    if ([r, g, b].some(Number.isNaN)) return null
    return { r: Math.round(clamp(r, 0, 255)), g: Math.round(clamp(g, 0, 255)), b: Math.round(clamp(b, 0, 255)), a: clamp(alpha, 0, 1) }
  }

  const h = angle(parts[0])
  const sl = num(parts[1]) / 100
  const l = num(parts[2]) / 100
  if ([h, sl, l].some(Number.isNaN)) return null
  return hslToRgb(h, clamp(sl, 0, 1), clamp(l, 0, 1), clamp(alpha, 0, 1))
}

function hslToRgb(h: number, s: number, l: number, a: number): Rgb {
  // HSL→HSV, then reuse the one conversion that already exists.
  const v = l + s * Math.min(l, 1 - l)
  return hsvToRgb({ h, s: v === 0 ? 0 : 2 * (1 - l / v), v, a })
}

/** HSV→HSL, for the hsl() output format. Saturation/lightness come back 0..1. */
export function hsvToHsl({ h, s, v }: Hsv): { h: number; s: number; l: number } {
  const l = v * (1 - s / 2)
  const denom = Math.min(l, 1 - l)
  return { h: normalizeHue(h), s: denom === 0 ? 0 : (v - l) / denom, l }
}

/** The colour as a CSS string in the requested format. */
export function formatColor(c: Hsv, format: ColorFormat): string {
  const rgb = hsvToRgb(c)
  const a = Math.round(clamp(c.a, 0, 1) * 100) / 100

  if (format === "hex") return rgbToHex(rgb)
  if (format === "rgb") {
    return a >= 1
      ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
      : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
  }

  const { h, s, l } = hsvToHsl(c)
  const hh = Math.round(h)
  const ss = Math.round(s * 100)
  const ll = Math.round(l * 100)
  return a >= 1 ? `hsl(${hh}, ${ss}%, ${ll}%)` : `hsla(${hh}, ${ss}%, ${ll}%, ${a})`
}

/** Always opaque — for the swatch behind an alpha checkerboard, and for rails. */
export function opaqueCss(c: Hsv): string {
  const { r, g, b } = hsvToRgb({ ...c, a: 1 })
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Whether dark ink reads better than light on this colour, by WCAG relative
 * luminance. The picker uses it for the check mark on a selected swatch, which
 * otherwise disappears into a pale preset.
 */
export function isLight(c: Hsv): boolean {
  const { r, g, b } = hsvToRgb(c)
  const lin = (n: number) => {
    const x = n / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.35
}

/**
 * A neutral starting palette. Kit tokens are deliberately NOT used here: these
 * are values a user picks *for their own data* (a tag, a calendar category),
 * which must stay put when the app's theme changes — a preset that shifted with
 * the theme would silently restyle everything already saved with it.
 */
export const DEFAULT_SWATCHES = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
  "#111827",
] as const
