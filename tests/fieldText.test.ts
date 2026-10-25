import { describe, expect, test } from "bun:test"
import { formatRemaining, groupCode, middleTruncate, normalizeCode } from "../src/components/fieldText"

describe("groupCode", () => {
  test("reads short codes in threes and longer ones in fours", () => {
    expect(groupCode("123456")).toEqual(["123", "456"])
    expect(groupCode("ABCDEFGH")).toEqual(["ABCD", "EFGH"])
    expect(groupCode("ABCDEFGHIJKL")).toEqual(["ABCD", "EFGH", "IJKL"])
    expect(groupCode("ABCD")).toEqual(["ABCD"])
  })

  test("takes one size or exact sizes, and never drops characters", () => {
    expect(groupCode("ABCDEFGHIJ", 4)).toEqual(["ABCD", "EFGH", "IJ"])
    expect(groupCode("ABCDEFGHIJ", [2, 3])).toEqual(["AB", "CDE", "FGHIJ"])
    expect(groupCode("", 4)).toEqual([])
  })

  test("normalizeCode drops separators people type", () => {
    expect(normalizeCode("ab-cd ef.gh")).toBe("abcdefgh")
  })
})

describe("formatRemaining", () => {
  test("rounds up so 0:00 means time is out", () => {
    expect(formatRemaining(42_000)).toBe("0:42")
    expect(formatRemaining(41_100)).toBe("0:42")
    expect(formatRemaining(0)).toBe("0:00")
    expect(formatRemaining(-5)).toBe("0:00")
    expect(formatRemaining(245_000)).toBe("4:05")
    expect(formatRemaining(3_723_000)).toBe("1:02:03")
  })
})

describe("middleTruncate", () => {
  const fitsIn = (n: number) => (s: string) => Array.from(s).length <= n

  test("returns the text untouched when it fits", () => {
    expect(middleTruncate("short", fitsIn(10))).toBe("short")
  })

  test("keeps both ends, evenly by default", () => {
    const out = middleTruncate("abcdefghijklmnop", fitsIn(9))
    expect(out).toBe("abcd…mnop")
  })

  test("pins the tail when asked", () => {
    const out = middleTruncate("/home/user/projects/report.pdf", fitsIn(14), { tail: 10 })
    expect(out).toBe("/ho…report.pdf")
    expect(Array.from(out).length).toBeLessThanOrEqual(14)
  })

  test("falls back to the ellipsis alone when nothing fits", () => {
    expect(middleTruncate("abcdef", () => false)).toBe("…")
  })
})
