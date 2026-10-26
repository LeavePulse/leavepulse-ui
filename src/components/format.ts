/*
 * Numbers as the kit prints them: byte sizes (a file tree's size column, a
 * quota's "4.2 GB of 5 GB") and compact figures (a chart's axis ticks, a
 * counter's "1.2k"). One module so the size column and the quota bar agree on
 * units and rounding, and so the axis and the counter cross a million the same
 * way. Pure, so the edge cases are tested without a DOM.
 */

/*
 * Building an Intl formatter costs far more than using one, and a file tree
 * formats a size on every row, so each distinct setup is built once.
 */
const numberFormats = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale ?? ""}|${JSON.stringify(options)}`
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, format)
  }
  return format
}

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"] as const

export interface FormatBytesOptions {
  /**
   * Keep the decimal place a value under 10 gets even when it is zero
   * ("1.0 MB" rather than "1 MB"), so a column of sizes keeps one shape.
   */
  fixed?: boolean
}

/**
 * A byte count in the largest unit that keeps it readable: 1 536 → "1.5 kB".
 * Binary steps, the way file managers and storage limits show sizes. Unit
 * names come from Intl, so a French app reads "1,5 Mo" without a table of
 * its own. One decimal under 10 (2.4 MB), none above (240 MB). Negative or
 * non-finite input is "—": there is no size to show.
 */
export function formatBytes(bytes: number, locale?: string, options: FormatBytesOptions = {}): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  let scaled = bytes
  let step = 0
  // Compared as it will print, so 1 048 575 B is "1.0 MB", not "1024 kB".
  while (Math.round(scaled) >= 1024 && step < BYTE_UNITS.length - 1) {
    scaled /= 1024
    step += 1
  }
  // Decided on the rounded value: 9.96 kB prints as "10 kB", not "10.0 kB".
  const places = step > 0 && Number(scaled.toFixed(1)) < 10 ? 1 : 0
  // The number and the unit symbol are assembled here rather than taken whole:
  // Intl's "short" form spells the smallest unit out ("1023 byte", "1023 Byte")
  // while every other unit is a symbol, and its "narrow" form glues English
  // symbols to the figure ("1023B"). Narrow symbols with one no-break space
  // read the same in every locale: "1023 B", "1.5 kB", "1,5 Mo".
  const parts = numberFormat(locale, {
    style: "unit",
    unit: BYTE_UNITS[step],
    unitDisplay: "narrow",
    // A figure here never passes 1023 below petabytes, and "1,023 kB" reads as
    // a decimal in half the world.
    useGrouping: false,
    minimumFractionDigits: options.fixed ? places : 0,
    maximumFractionDigits: places,
  }).formatToParts(scaled)
  const unit = parts.filter((p) => p.type === "unit").map((p) => p.value).join("")
  const figure = parts.filter((p) => p.type !== "unit" && p.type !== "literal").map((p) => p.value).join("")
  return unit ? `${figure}\u00a0${unit}` : figure
}

const COMPACT_UNITS: readonly (readonly [number, string])[] = [
  [1, ""],
  [1e3, "k"],
  [1e6, "M"],
  [1e9, "B"],
  [1e12, "T"],
]

/*
 * The unit word and the gap before it as the locale writes them: "Md" with a
 * no-break space in French, "K" glued on in English. Taken from Intl's compact
 * notation rather than a table, so any locale reads its own.
 */
const compactSuffixes = new Map<string, string>()

function compactSuffix(locale: string, step: number): string {
  const key = `${locale}|${step}`
  let found = compactSuffixes.get(key)
  if (found === undefined) {
    const parts = numberFormat(locale, { notation: "compact", compactDisplay: "short" }).formatToParts(COMPACT_UNITS[step][0])
    const at = parts.findIndex((p) => p.type === "compact")
    found = at < 0 ? COMPACT_UNITS[step][1] : (parts[at - 1]?.type === "literal" ? parts[at - 1].value : "") + parts[at].value
    compactSuffixes.set(key, found)
  }
  return found
}

export interface CompactNumberOptions {
  /**
   * Writes the decimal separator the locale's way ("1,2k" in French). The
   * k/M/B/T suffixes stay: Intl's own compact notation changes the shape of
   * the figure per locale ("1,2 k" in French), which a tick label cannot absorb.
   * Unset keeps a plain "." whatever the browser says.
   */
  locale?: string
  /**
   * With a locale, write the unit as that locale does: "13,1 Md" in French.
   * For a figure read on its own (a stat tile, a counter), where "11,9k" looks
   * foreign; not for axis ticks, where the longer word crowds the axis.
   */
  words?: boolean
  /** Places for a figure below a thousand (12.25). Default 2. */
  plainDecimals?: number
  /** Places once a unit is in play (1.2k). Default 1. */
  decimals?: number
  /**
   * Keep trailing zeros ("5.0M", "1.0k") so the figure's shape only changes
   * at a rollover. Off, they are dropped ("5M"), the way a label is written.
   */
  fixed?: boolean
}

/**
 * A figure shortened with k/M/B/T: 1 200 → "1.2k", 3 400 000 → "3.4M"; with
 * `words` and a locale in that locale's own words, "13,1 Md" in French.
 *
 * The unit is picked by what will PRINT, not by the raw size: 999 950 at one
 * place rounds to "1000k", which reads as the next unit up, so it becomes
 * "1M"; 999.999 with two places would be "1000", so it becomes "1k".
 */
export function compactNumber(value: number, options: CompactNumberOptions = {}): string {
  if (!Number.isFinite(value)) return String(value)
  const { locale, plainDecimals = 2, decimals = 1, fixed = false, words = false } = options
  const abs = Math.abs(value)
  let i = COMPACT_UNITS.length - 1
  while (i > 0 && abs < COMPACT_UNITS[i][0]) i--

  const placesAt = (at: number) => (at === 0 ? plainDecimals : decimals)
  const roundAt = (at: number) => Number((value / COMPACT_UNITS[at][0]).toFixed(placesAt(at)))
  let scaled = roundAt(i)
  if (Math.abs(scaled) >= 1000 && i < COMPACT_UNITS.length - 1) {
    i++
    scaled = roundAt(i)
  }

  const places = placesAt(i)
  // -0.001 rounds to -0, which would print as "-0".
  if (scaled === 0) scaled = 0
  const number =
    locale === undefined
      ? fixed
        ? scaled.toFixed(places)
        : String(scaled)
      : numberFormat(locale, {
          minimumFractionDigits: fixed ? places : 0,
          maximumFractionDigits: places,
          useGrouping: false,
        }).format(scaled)
  return `${number}${words && locale !== undefined && i > 0 ? compactSuffix(locale, i) : COMPACT_UNITS[i][1]}`
}

/**
 * The character a locale writes between the whole and the fractional part:
 * "." in English, "," in French and German. A counter that splits a grouped
 * figure into columns has to find the fraction by this mark, not by ".",
 * because in German "." is the thousands separator.
 */
export function decimalMark(locale?: string): string {
  return numberFormat(locale, {}).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? "."
}
