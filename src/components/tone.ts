/*
 * The kit's semantic tones, once.
 *
 * Badges, alerts, toasts, loaders, meters, log levels and notification rows all
 * colour themselves by what something MEANS: fine, worrying, broken, brand,
 * nothing in particular. Each used to keep its own little map from a tone name
 * to classes, and the maps drifted: a warning badge was tinted `bg-accent/15`
 * while a warning row used `--color-accent-soft`, and a toaster called it
 * `error` where an alert called it `danger`. Here every component looks the
 * tone up, so the same meaning paints the same colour everywhere, and a theme
 * that recolours `accent` recolours every warning at once.
 *
 * Class strings are spelled out whole on purpose. Tailwind finds classes by
 * scanning source text, so a class assembled at runtime (`bg-${name}`) would
 * never be emitted and the tone would silently paint nothing.
 */

/** The canonical tones. Everything else is an alias of one of these. */
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger"

/**
 * Every name a component's `tone` prop accepts. The aliases are the names the
 * kit's components grew up with (a meter says `ok`, a button palette says
 * `action`, a toast says `error`), kept so no caller has to rename anything.
 */
export type ToneName = Tone | "info" | "ok" | "action" | "accent" | "error" | "muted"

/** Which canonical tone each name stands for. */
export const TONE_ALIASES: Readonly<Record<ToneName, Tone>> = {
  neutral: "neutral",
  muted: "neutral",
  brand: "brand",
  info: "brand",
  success: "success",
  ok: "success",
  action: "success",
  warning: "warning",
  accent: "warning",
  danger: "danger",
  error: "danger",
}

/** What a component needs to paint one tone. */
export interface ToneLook {
  /** The solid colour, as a CSS value for a style or an SVG stroke. */
  color: string
  /** The tinted background colour, as a CSS value. */
  soft: string
  /** The solid colour as text: an icon, a label, a spinner. */
  text: string
  /** The solid colour as a fill: a bar, a dot, a rail. */
  bg: string
  /** The tinted background alone. */
  softBg: string
  /**
   * A chip: the tinted background with text that reads on it. Not always
   * `softBg + text`: neutral text on its soft surface steps up to
   * muted-strong, because plain muted on surface-soft is too faint to read.
   */
  //
  // The text is the tone mixed 60/40 with ink, not the tone itself: a light
  // theme's green or amber on its own soft tint read at 2.8 to 3.4:1, under
  // the 4.5 small text needs. Mixed toward ink it darkens on light themes and
  // lightens on dark ones, and stays recognisably the tone (5.6 to 6.4:1 on
  // light, higher on dark).
  chip: string
  /** The solid colour as a border. */
  border: string
  /** A quiet panel in the tone: a faint tint with a faint edge (an alert, a callout). */
  panel: string
  /** Selected text highlighted in the tone. */
  selection: string
}

export const TONES: Readonly<Record<Tone, ToneLook>> = {
  neutral: {
    color: "var(--color-muted)",
    soft: "var(--color-surface-soft)",
    text: "text-muted",
    bg: "bg-muted",
    softBg: "bg-surface-soft",
    chip: "bg-surface-soft text-muted-strong",
    border: "border-line-strong",
    panel: "border-line bg-surface-soft",
    selection: "selection:bg-muted/40",
  },
  brand: {
    color: "var(--color-brand)",
    soft: "var(--color-brand-soft)",
    text: "text-brand",
    bg: "bg-brand",
    softBg: "bg-brand-soft",
    chip: "bg-brand-soft text-[color-mix(in_oklab,var(--color-brand)_60%,var(--color-ink))]",
    border: "border-brand",
    panel: "border-brand/30 bg-brand/10",
    selection: "selection:bg-brand/40",
  },
  success: {
    color: "var(--color-action)",
    soft: "var(--color-action-soft)",
    text: "text-action",
    bg: "bg-action",
    softBg: "bg-action-soft",
    chip: "bg-action-soft text-[color-mix(in_oklab,var(--color-action)_60%,var(--color-ink))]",
    border: "border-action",
    panel: "border-action/30 bg-action/10",
    selection: "selection:bg-action/40",
  },
  warning: {
    color: "var(--color-accent)",
    soft: "var(--color-accent-soft)",
    text: "text-accent",
    bg: "bg-accent",
    softBg: "bg-accent-soft",
    chip: "bg-accent-soft text-[color-mix(in_oklab,var(--color-accent)_60%,var(--color-ink))]",
    border: "border-accent",
    panel: "border-accent/30 bg-accent/10",
    selection: "selection:bg-accent/40",
  },
  danger: {
    color: "var(--color-danger)",
    soft: "var(--color-danger-soft)",
    text: "text-danger",
    bg: "bg-danger",
    softBg: "bg-danger-soft",
    chip: "bg-danger-soft text-[color-mix(in_oklab,var(--color-danger)_60%,var(--color-ink))]",
    border: "border-danger",
    panel: "border-danger/30 bg-danger/10",
    selection: "selection:bg-danger/40",
  },
}

/**
 * The canonical tone a name stands for. An unknown name (a typo, a tone from a
 * newer kit read by an older one) falls back rather than painting nothing.
 */
export function toneOf(name: string | null | undefined, fallback: Tone = "neutral"): Tone {
  return (name && TONE_ALIASES[name as ToneName]) || fallback
}

/** How a tone is painted, by any of its names. */
export function toneLook(name: string | null | undefined, fallback: Tone = "neutral"): ToneLook {
  return TONES[toneOf(name, fallback)]
}
