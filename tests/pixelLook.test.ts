import { describe, expect, test } from "bun:test"
import { pixelLook, pixelTheme } from "../src/look-pixel"
import { PIXEL_ICON_MAP, PIXEL_ICONS } from "../src/looks/pixel-icons"

describe("pixel look", () => {
  test("every mapped name points at an icon the look ships", () => {
    for (const target of Object.values(PIXEL_ICON_MAP)) {
      expect(Boolean(PIXEL_ICONS.icons[target] || PIXEL_ICONS.aliases?.[target])).toBe(true)
    }
  })

  test("same names pair up and the synonyms cover the ones that differ", () => {
    expect(PIXEL_ICON_MAP.check).toBe("check")
    expect(PIXEL_ICON_MAP.x).toBe("close")
    expect(PIXEL_ICON_MAP["trash-2"]).toBe("trash")
    expect(PIXEL_ICON_MAP.settings).toBe("settings-cog")
    expect(PIXEL_ICON_MAP.accessibility).toBeUndefined()
  })

  test("the look names its defaults and the theme stays a full token set", () => {
    expect(pixelLook).toMatchObject({ motion: "stepped", loader: "grid", progress: "ascii", backdrop: "dither" })
    expect(pixelLook.icons?.prefix).toBe("pixelarticons")
    expect(pixelTheme.colors.surface).toBe("#0a0a0a")
    expect(pixelTheme.colors.action).toBeTruthy()
  })
})
