/*
 * Nuxt runtime plugin — paints the user's theme during SSR, so a reload shows
 * the right colours in the first frame instead of flashing the default.
 *
 * Registered automatically by the kit's Nuxt module; a consuming app needs no
 * plugin of its own. Opt out (or point it at custom themes) via nuxt.config:
 *
 *   leavepulseUi: { theme: false }              // no theme handling at all
 *   leavepulseUi: { defaultTheme: "Nord" }      // different fallback preset
 *
 * How it avoids the flash: the kit mirrors the chosen theme's NAME into the
 * `lp-theme` cookie (see cacheTheme), which unlike localStorage travels with the
 * request. Here the server reads it, resolves it against the built-in presets,
 * and inlines that theme's CSS variables into <head>. On the client
 * bootstrapTheme() still runs before mount, so a localStorage choice — which
 * holds the full token values, including themes the server cannot name — keeps
 * winning.
 */
// Imported through the package barrel on purpose. This file is shipped as
// source and compiled by the CONSUMING app, where "@leavepulse/ui" resolves to
// dist — the same module instance the kit's components use. A relative "../theme/…"
// would load a second copy of the theme singleton from src/, leaving components
// subscribed to a different reactive state than the one this plugin drives.
import {
  bootstrapTheme,
  leavepulse,
  presets,
  THEME_COOKIE,
  themeFromCookie,
  themeToCssRule,
  type TokenSet,
} from "@leavepulse/ui"
// @ts-expect-error — resolved by Nuxt in the consuming app, not by the kit build
import { defineNuxtPlugin, useCookie, useHead, useRuntimeConfig } from "#imports"

export default defineNuxtPlugin(() => {
  const options = (useRuntimeConfig().public.leavepulseUi ?? {}) as {
    defaultTheme?: string
  }

  const themes = Object.values(presets) as TokenSet[]
  const fallback =
    themes.find((theme) => theme.name === options.defaultTheme) ?? leavepulse

  // Read-only here: the cookie is written by cacheTheme() in the browser, which
  // is the one place a theme choice is recorded.
  const cookie = useCookie<string | null>(THEME_COOKIE, { readonly: true })
  const initial = themeFromCookie(cookie.value, themes) ?? fallback

  useHead({
    style: [{ id: "lp-ui-theme", innerHTML: themeToCssRule(initial) }],
  })

  // `initial` as the fallback (not the preset default) so a visitor who only
  // has the cookie keeps the theme the server just painted.
  if (import.meta.client) {
    bootstrapTheme(initial)
  }
})
