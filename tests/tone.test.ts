import { describe, expect, test } from "bun:test"
import { capacityThresholds, TONE_COLOR, TONE_SOFT, type MeterTone } from "../src/components/meter"
import { quotaState } from "../src/components/quota"
import { TONE_ALIASES, TONES, toneLook, toneOf, type Tone } from "../src/components/tone"

const CANONICAL: Tone[] = ["neutral", "brand", "success", "warning", "danger"]

describe("toneOf", () => {
  test("canonical names stand for themselves", () => {
    for (const t of CANONICAL) expect(toneOf(t)).toBe(t)
  })
  test("aliases resolve to their canonical tone", () => {
    expect(toneOf("info")).toBe("brand")
    expect(toneOf("ok")).toBe("success")
    expect(toneOf("action")).toBe("success")
    expect(toneOf("accent")).toBe("warning")
    expect(toneOf("error")).toBe("danger")
    expect(toneOf("muted")).toBe("neutral")
  })
  test("every alias points at a tone that exists", () => {
    for (const target of Object.values(TONE_ALIASES)) expect(TONES[target]).toBeDefined()
  })
  test("unknown or missing names fall back instead of painting nothing", () => {
    expect(toneOf("purple")).toBe("neutral")
    expect(toneOf(undefined)).toBe("neutral")
    expect(toneOf(null, "brand")).toBe("brand")
    expect(toneOf("", "danger")).toBe("danger")
  })
})

describe("toneLook", () => {
  test("an alias paints exactly like its tone", () => {
    expect(toneLook("error")).toBe(TONES.danger)
    expect(toneLook("accent")).toBe(TONES.warning)
    expect(toneLook("action")).toBe(TONES.success)
  })
  test("colours are the theme's variables", () => {
    expect(TONES.success.color).toBe("var(--color-action)")
    expect(TONES.warning.soft).toBe("var(--color-accent-soft)")
    expect(TONES.neutral.soft).toBe("var(--color-surface-soft)")
  })
  test("classes are whole literals Tailwind can find, not assembled names", () => {
    for (const t of CANONICAL) {
      const look = TONES[t]
      for (const cls of [look.text, look.bg, look.softBg, look.border]) expect(cls).toMatch(/^[a-z-]+(\/\d+)?$/)
    }
  })
  test("a chip's background is the soft token, so a badge and a tinted row agree", () => {
    for (const t of CANONICAL) expect(TONES[t].chip.startsWith(TONES[t].softBg)).toBe(true)
  })
})

describe("meter tones read the tone module", () => {
  test("TONE_COLOR and TONE_SOFT match their aliases", () => {
    const tones: MeterTone[] = ["ok", "warning", "danger", "brand", "neutral"]
    for (const t of tones) {
      expect(TONE_COLOR[t]).toBe(toneLook(t).color)
      expect(TONE_SOFT[t]).toBe(toneLook(t).soft)
    }
  })
})

describe("quota thresholds", () => {
  test("follow the capacity scale, danger from 90% like a gauge", () => {
    expect(quotaState(85, 100).tone).toBe("warning")
    expect(quotaState(92, 100).tone).toBe("danger")
    expect(capacityThresholds(0, 1).map((s) => s.at)).toEqual([0.8, 0.9])
  })
  test("custom thresholds still apply", () => {
    expect(quotaState(92, 100, 0.8, 0.95).tone).toBe("warning")
  })
})
