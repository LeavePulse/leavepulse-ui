import { describe, expect, test } from "bun:test"
import { graphemes, planScramble, randomGlyph, scrambleFrame, seededRandom, settledCells } from "../src/components/scramble"

const text = (cells: { char: string }[]) => cells.map((c) => c.char).join("")

describe("scramble", () => {
  test("seeded random is reproducible", () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    const xs = Array.from({ length: 5 }, a)
    expect(Array.from({ length: 5 }, b)).toEqual(xs)
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })

  test("frames are deterministic with an injected random source", () => {
    const plan = planScramble("", "AB12-CD", { duration: 1000 }, seededRandom(1))
    const one = scrambleFrame(plan, 100, seededRandom(42))
    const two = scrambleFrame(plan, 100, seededRandom(42))
    expect(text(one)).toBe(text(two))
  })

  test("sequential settles left to right and lands on the value", () => {
    const plan = planScramble("", "ABCDEF", { duration: 1000 })
    const times = plan.map((c) => c.settleAt)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
    expect(times.at(-1)).toBe(1000)
    const mid = scrambleFrame(plan, 650, () => 0)
    expect(mid.slice(0, 3).every((c) => c.settled)).toBe(true)
    expect(mid.at(-1)!.settled).toBe(false)
    expect(text(scrambleFrame(plan, 1000, () => 0))).toBe("ABCDEF")
  })

  test("together settles every position in the last stretch", () => {
    const plan = planScramble("", "ABCDEF", { duration: 1000, order: "together" }, seededRandom(3))
    expect(plan.every((c) => c.settleAt >= 850 && c.settleAt <= 1000)).toBe(true)
    expect(scrambleFrame(plan, 800, seededRandom(1)).some((c) => c.settled)).toBe(false)
  })

  test("kept characters never churn and churning cells keep their final width", () => {
    const plan = planScramble("ab cd", "AB CD", { duration: 1000 })
    const frame = scrambleFrame(plan, 0, seededRandom(9))
    expect(frame[2]).toEqual({ char: " ", sizer: " ", settled: true })
    expect(frame.map((c) => c.sizer).join("")).toBe("AB CD")
  })

  test("a shrinking value sizes leaving positions by the old character, then drops them", () => {
    const plan = planScramble("ABCDEF", "XY", { duration: 500 })
    expect(plan).toHaveLength(6)
    expect(scrambleFrame(plan, 0, () => 0)[5]!.sizer).toBe("F")
    expect(text(scrambleFrame(plan, 500))).toBe("XY")
  })

  test("graphemes keep emoji whole and glyphs come from the pool", () => {
    expect(graphemes("a👍🏽b")).toEqual(["a", "👍🏽", "b"])
    expect(randomGlyph(() => 0.999, "XYZ")).toBe("Z")
    expect(randomGlyph(() => 0, "XYZ")).toBe("X")
    expect(settledCells("hi").every((c) => c.settled)).toBe(true)
  })
})
