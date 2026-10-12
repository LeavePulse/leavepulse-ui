/*
 * Nuxt runtime plugin: paints the user's theme during SSR, so a reload shows
 * the right colours in the first frame instead of flashing the default.
 *
 * Registered automatically by the kit's Nuxt module. Options (nuxt.config):
 *
 *   leavepulseUi: { theme: false }              // no theme handling at all
 *   leavepulseUi: { defaultTheme: "Nord" }      // different fallback theme
 *   leavepulseUi: { themes: "~/themes" }        // module exporting the app's own themes
 *
 * The kit mirrors the chosen theme's NAME into the `lp-theme` cookie, which
 * unlike localStorage travels with the request. The server resolves it against
 * the built-in presets plus the app's themes and inlines that theme's variables
 * into <head>. On the client useTheme().init() still restores localStorage,
 * which holds the full token values and keeps winning.
 */
// Through the barrel, not "../theme/…": this file is compiled by the consuming
// app, where the barrel resolves to the same dist instance the components use.
import {
  dark,
  presets,
  THEME_COOKIE,
  themeFromCookie,
  themeToCssRule,
  useTheme,
  type TokenSet,
} from "@leavepulse/ui"
import appThemes from "#lp-ui-themes"
import {
  defineNuxtPlugin,
  useCookie,
  useHead,
  useRequestEvent,
  useRequestHeaders,
  useRuntimeConfig,
} from "#imports"

const HINT = "sec-ch-prefers-color-scheme"

export default defineNuxtPlugin(() => {
  const options = (useRuntimeConfig().public.leavepulseUi ?? {}) as {
    defaultTheme?: string
  }

  const themes = [...(appThemes as TokenSet[]), ...(Object.values(presets) as TokenSet[])]
  const fallback = themes.find((theme) => theme.name === options.defaultTheme) ?? dark

  // Raw value: themeFromCookie decodes safely itself, a throwing decode here
  // would turn a malformed cookie into a 500 on every request.
  const cookie = useCookie<string | null>(THEME_COOKIE, {
    readonly: true,
    decode: (value: string) => value,
  })
  let prefersDark: boolean | undefined
  if (import.meta.server) {
    const hint = useRequestHeaders([HINT])[HINT]
    if (hint) prefersDark = hint.includes("dark")
    // Ask the browser for the OS colour scheme from the next request on, so a
    // visitor following the OS gets the right theme server-side as well.
    useRequestEvent()?.node.res.setHeader("Accept-CH", "Sec-CH-Prefers-Color-Scheme")
  }
  const initial = themeFromCookie(cookie.value, themes, { prefersDark }) ?? fallback

  useHead({
    htmlAttrs: { "data-theme-mode": initial.mode },
    style: [{ id: "lp-ui-theme", innerHTML: themeToCssRule(initial) }],
  })

  // `initial` as the fallback, so a visitor who only has the cookie keeps the
  // theme the server just painted and the shared state starts from it.
  if (import.meta.client) {
    useTheme().init(initial)
  }
})
