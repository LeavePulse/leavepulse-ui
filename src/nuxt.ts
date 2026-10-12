/*
 * Nuxt module — auto-registers every kit component globally so consuming apps
 * use <LpButton> / <LpThemeSwitcher> / … with no per-app component list to
 * maintain, and wires the SSR theme handoff. Add it to a Nuxt app's `modules`:
 *
 *   export default defineNuxtConfig({ modules: ["@leavepulse/ui/nuxt"] })
 *
 * The component list comes from the generated component-names file (kept in sync
 * with the actual components at build), so a NEW component is available
 * everywhere with no consumer change.
 *
 * Options (nuxt.config `leavepulseUi`):
 *   theme        false to skip the theme plugin entirely (default: true)
 *   defaultTheme theme name used when the visitor has no saved theme
 *   themes       path of a module whose default export is the app's own
 *                TokenSet[] (e.g. "~/themes"), so SSR can paint and fall back
 *                to custom themes, not only the built-in presets
 *   link         false to skip providing NuxtLink as the kit's link component
 *   exclude      component names not to auto-register (e.g. ["LayoutCanvas"]
 *                when the app has its own component of that name)
 */
import { addComponent, addPlugin, addTemplate, createResolver, defineNuxtModule } from "@nuxt/kit"
import { COMPONENT_NAMES } from "./component-names"

export interface LeavepulseUiOptions {
  /** Register the SSR theme plugin. Disable to wire theming yourself. */
  theme?: boolean
  /** Theme name to fall back to when nothing is saved (default "Dark"). */
  defaultTheme?: string
  /** Module path whose default export is the app's TokenSet[]. */
  themes?: string
  /** Provide NuxtLink as the link component for kit navigation (default true). */
  link?: boolean
  /** Component names to leave unregistered. */
  exclude?: string[]
}

export default defineNuxtModule<LeavepulseUiOptions>({
  meta: { name: "@leavepulse/ui", configKey: "leavepulseUi" },
  defaults: { theme: true, link: true },
  setup(
    options: LeavepulseUiOptions,
    nuxt: {
      options: {
        runtimeConfig: { public: Record<string, unknown> }
        alias: Record<string, string>
      }
      hook: (
        name: "prepare:types",
        fn: (options: { references: { path: string }[] }) => void,
      ) => void
    },
  ) {
    const resolver = createResolver(import.meta.url)
    const skip = new Set(options.exclude ?? [])
    for (const name of COMPONENT_NAMES) {
      if (skip.has(name)) continue
      // Each component's own dist chunk rather than the barrel, so the app
      // ships only the components it uses (and their real deps).
      addComponent({
        name,
        export: "default",
        filePath: `@leavepulse/ui/dist/components/${name}.vue.js`,
      })
    }

    if (options.link !== false) {
      addPlugin({ src: resolver.resolve("./runtime/config.plugin"), mode: "all" })
    }

    if (options.theme === false) return

    const themes = addTemplate({
      filename: "leavepulse-ui-themes.mjs",
      getContents: () =>
        options.themes
          ? `export { default } from ${JSON.stringify(options.themes)}\n`
          : "export default []\n",
    })
    nuxt.options.alias["#lp-ui-themes"] = themes.dst
    const themeTypes = addTemplate({
      filename: "types/leavepulse-ui-themes.d.ts",
      getContents: () =>
        'declare module "#lp-ui-themes" {\n  const themes: import("@leavepulse/ui").TokenSet[]\n  export default themes\n}\n',
    })
    nuxt.hook("prepare:types", ({ references }) => {
      references.push({ path: themeTypes.dst })
    })

    // Read from runtimeConfig rather than closed over, so the options survive
    // the build into the server bundle.
    nuxt.options.runtimeConfig.public.leavepulseUi = {
      ...((nuxt.options.runtimeConfig.public.leavepulseUi as Record<string, unknown> | undefined) ?? {}),
      defaultTheme: options.defaultTheme,
    }

    addPlugin({ src: resolver.resolve("./runtime/theme.plugin"), mode: "all" })
  },
})
