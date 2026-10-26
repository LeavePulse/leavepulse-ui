import { describe, expect, test } from "bun:test"
import { compactNumber, decimalMark, formatBytes } from "../src/components/format"
import { formatModified } from "../src/components/fileTree"
import { formatTick } from "../src/components/chart"
import { formatClipTime } from "../src/components/videoBackdrop"

describe("formatBytes", () => {
  test("scales in binary steps with Intl's unit names", () => {
    expect(formatBytes(0, "en")).toBe("0\u00a0B")
    expect(formatBytes(512, "en")).toBe("512\u00a0B")
    expect(formatBytes(1536, "en")).toBe("1.5\u00a0kB")
    expect(formatBytes(240 * 1024 ** 2, "en")).toBe("240\u00a0MB")
    expect(formatBytes(10 * 1024 ** 3, "en")).toBe("10\u00a0GB")
  })

  test("rolls over by what prints, not by the raw value", () => {
    // 1023.6 B prints as 1024 B, which is a kilobyte.
    expect(formatBytes(1023.6, "en")).toBe("1\u00a0kB")
    expect(formatBytes(1048000, "en")).toBe("1023\u00a0kB")
    expect(formatBytes(1048575, "en")).toBe("1\u00a0MB")
    expect(formatBytes(1048575, "en", { fixed: true })).toBe("1.0\u00a0MB")
    // 9.96 kB rounds to 10 at one place, so it is written without one.
    expect(formatBytes(9.96 * 1024, "en", { fixed: true })).toBe("10\u00a0kB")
    expect(formatBytes(1024 ** 6, "en")).toBe("1024\u00a0PB")
  })

  test("follows the locale", () => {
    // Every locale gets the same no-break space before the unit symbol.
    expect(formatBytes(1536, "fr")).toBe("1,5\u00a0ko")
    expect(formatBytes(1.5 * 1024 ** 3, "de")).toBe("1,5\u00a0GB")
  })

  test("has nothing to show for a missing or negative size", () => {
    expect(formatBytes(-1)).toBe("—")
    expect(formatBytes(Number.NaN)).toBe("—")
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("—")
  })
})

describe("compactNumber", () => {
  test("abbreviates with k/M/B/T and trims trailing zeros", () => {
    expect(compactNumber(0)).toBe("0")
    expect(compactNumber(12.345)).toBe("12.35")
    expect(compactNumber(999)).toBe("999")
    expect(compactNumber(1200)).toBe("1.2k")
    expect(compactNumber(5_000_000)).toBe("5M")
    expect(compactNumber(-3_400_000)).toBe("-3.4M")
    expect(compactNumber(2.5e12)).toBe("2.5T")
    expect(compactNumber(Number.NaN)).toBe("NaN")
    expect(compactNumber(-0.001)).toBe("0")
  })

  test("rolls over when the printed figure reaches 1000", () => {
    expect(compactNumber(999.999)).toBe("1k")
    expect(compactNumber(999_950)).toBe("1M")
    expect(compactNumber(-999_999)).toBe("-1M")
    expect(compactNumber(999_960_000)).toBe("1B")
    expect(compactNumber(999_950_000_000)).toBe("1T")
    // Nothing past T: the figure grows instead.
    expect(compactNumber(2.5e15)).toBe("2500T")
  })

  test("fixed keeps one shape, as a rolling counter needs", () => {
    expect(compactNumber(5_000_000, { fixed: true })).toBe("5.0M")
    expect(compactNumber(42.4, { fixed: true, plainDecimals: 0 })).toBe("42")
    expect(compactNumber(999.5, { fixed: true, plainDecimals: 0 })).toBe("1.0k")
    expect(compactNumber(999_949, { fixed: true, plainDecimals: 0 })).toBe("999.9k")
  })

  test("a locale changes the separator, never the suffix", () => {
    expect(compactNumber(1200, { locale: "fr" })).toBe("1,2k")
    expect(compactNumber(1200, { locale: "en" })).toBe("1.2k")
    expect(compactNumber(5_000_000, { locale: "de", fixed: true })).toBe("5,0M")
    expect(compactNumber(12_345_678_900_000_000, { locale: "en" })).toBe("12345.7T")
  })

  test("formatTick is the default compact number", () => {
    expect(formatTick(1200)).toBe(compactNumber(1200))
    expect(formatTick(999_999)).toBe("1M")
  })
})

describe("formatModified", () => {
  test("follows the locale and passes strings through", () => {
    const at = Date.UTC(2026, 9, 25, 12, 0)
    expect(formatModified(at, "fr")).toBe(
      new Intl.DateTimeFormat("fr", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(at),
    )
    expect(formatModified("yesterday")).toBe("yesterday")
    expect(formatModified(Number.NaN)).toBe("—")
  })
})

describe("formatClipTime", () => {
  test("folds hours into minutes and keeps tenths only when asked", () => {
    expect(formatClipTime(3600 + 15 * 60)).toBe("75:00")
    expect(formatClipTime(4.6, true)).toBe("0:04.6")
    expect(formatClipTime(-3)).toBe("0:00")
  })
})

describe("decimalMark", () => {
  test("is the locale's own mark, not always a point", () => {
    expect(decimalMark("en")).toBe(".")
    expect(decimalMark("fr-FR")).toBe(",")
    expect(decimalMark("de")).toBe(",")
  })
})

describe("compactNumber with words", () => {
  test("writes the unit in the locale's words", () => {
    expect(compactNumber(11900, { locale: "fr-FR", words: true })).toBe("11,9\u00a0k")
    expect(compactNumber(13_100_000_000, { locale: "fr-FR", words: true })).toBe("13,1\u00a0Md")
    expect(compactNumber(1200, { locale: "en", words: true })).toBe("1.2K")
  })

  test("keeps the kit's suffixes without a locale and below a thousand", () => {
    expect(compactNumber(1200, { words: true })).toBe("1.2k")
    expect(compactNumber(42, { locale: "fr-FR", words: true })).toBe("42")
  })
})
