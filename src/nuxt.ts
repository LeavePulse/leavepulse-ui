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
 *   defaultTheme preset name used when the visitor has no saved theme
 */
import { addComponent, addPlugin, createResolver, defineNuxtModule } from "@nuxt/kit"
import { COMPONENT_NAMES } from "./component-names"

export interface LeavepulseUiOptions {
  /** Register the SSR theme plugin. Disable to wire theming yourself. */
  theme?: boolean
  /** Preset name to fall back to when nothing is saved (default "LeavePulse"). */
  defaultTheme?: string
}

export default defineNuxtModule<LeavepulseUiOptions>({
  meta: { name: "@leavepulse/ui", configKey: "leavepulseUi" },
  defaults: { theme: true },
  setup(options: LeavepulseUiOptions, nuxt: { options: { runtimeConfig: { public: Record<string, unknown> } } }) {
    for (const name of COMPONENT_NAMES) {
      // Point each component at its own dist chunk rather than the barrel
      // ("@leavepulse/ui"). Importing through the barrel makes the bundler pull
      // the whole kit; a per-component path lets it ship only the components an
      // app actually uses (plus their real deps — e.g. @vue-flow only when a
      // canvas component is used).
      addComponent({
        name,
        export: "default",
        filePath: `@leavepulse/ui/dist/components/${name}.vue.js`,
      })
    }

    if (options.theme === false) return

    // The plugin reads its options from runtimeConfig rather than closing over
    // them, so they survive the build into the server bundle.
    nuxt.options.runtimeConfig.public.leavepulseUi = {
      ...(nuxt.options.runtimeConfig.public.leavepulseUi ?? {}),
      defaultTheme: options.defaultTheme,
    }

    addPlugin({
      src: createResolver(import.meta.url).resolve("./runtime/theme.plugin"),
      mode: "all",
    })
  },
})
