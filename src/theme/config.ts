/*
 * UiConfig — the canonical, complete UI-state snapshot for a LeavePulse app.
 *
 * Deliberately broader than the launcher's old theme config: it carries the
 * THEME *and* the LAYOUT (block placement) in one serializable object, plus a
 * schema version for forward migration. This is the source of truth apps load
 * from / save to disk.
 */
import type { Split } from "../layout/tree"
import { serializeLayout, deserializeLayout } from "../layout/tree"
import type { TokenSet } from "./tokens"
import { parseTheme, serializeTheme } from "./useTheme"

export const UI_CONFIG_VERSION = 1

export interface UiConfig {
  version: number
  theme: TokenSet
  /** Optional — apps without a composable layout omit it. */
  layout?: Split
}

export interface SerializedUiConfig {
  version: number
  theme: TokenSet
  layout?: unknown
}

export function serializeConfig(config: UiConfig): string {
  const out: SerializedUiConfig = {
    version: UI_CONFIG_VERSION,
    theme: JSON.parse(serializeTheme(config.theme)),
    layout: config.layout ? serializeLayout(config.layout) : undefined,
  }
  return JSON.stringify(out)
}

export function parseConfig(json: string): UiConfig {
  const raw = JSON.parse(json) as SerializedUiConfig
  if (!raw || typeof raw !== "object") throw new Error("Invalid UiConfig")
  return {
    version: raw.version ?? UI_CONFIG_VERSION,
    theme: parseTheme(JSON.stringify(raw.theme)),
    layout: raw.layout
      ? deserializeLayout(raw.layout as Parameters<typeof deserializeLayout>[0])
      : undefined,
  }
}
