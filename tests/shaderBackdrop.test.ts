import { describe, expect, test } from "bun:test"
import { approach, frameDue, PRESET_NAMES, PRESETS, tooSlow } from "../src/components/shaderBackdrop"

describe("shader backdrop", () => {
  test("every look has a shader and a themed still", () => {
    expect(PRESET_NAMES).toEqual(["aurora", "silk", "grain", "dots"])
    for (const name of PRESET_NAMES) {
      const def = PRESETS[name]
      expect(def.fragment).toContain("void main()")
      expect(def.fragment).toContain("gl_FragColor")
      // Colours come from tokens only, so the still follows the theme.
      expect(def.fallback).toContain("var(--color-")
      expect(def.fallback).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(def.scale).toBeGreaterThan(0)
    }
  })

  test("frame cap", () => {
    expect(frameDue(1000, 1000 - 33, 30)).toBe(true)
    expect(frameDue(1000, 1000 - 16.7, 30)).toBe(false)
    expect(frameDue(1000, 1000 - 16, 60)).toBe(true)
  })

  test("slow engine is judged on the median, after enough frames", () => {
    expect(tooSlow(Array(10).fill(200), 30)).toBe(false)
    expect(tooSlow(Array(25).fill(34), 30)).toBe(false)
    expect(tooSlow([...Array(20).fill(34), ...Array(5).fill(400)], 30)).toBe(false)
    expect(tooSlow(Array(25).fill(120), 30)).toBe(true)
  })

  test("colours blend toward the new theme", () => {
    expect(approach([0, 0, 0], [1, 0.5, 0], 0.5)).toEqual([0.5, 0.25, 0])
    expect(approach([0.2, 0.2, 0.2], [1, 1, 1], 1)).toEqual([1, 1, 1])
  })
})
