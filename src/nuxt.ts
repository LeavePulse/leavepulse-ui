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
 *   icons        which lucide icons render in the server pass and ship in the
 *                main bundle: "scan" (default) finds "lucide:*" literals in the
 *                app's source, "all" registers the whole set, "kit" only the
 *                kit's own, or a list of names. Anything else still renders,
 *                from a lazily loaded chunk of the bundled collection.
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { addComponent, addPlugin, addPluginTemplate, addTemplate, createResolver, defineNuxtModule } from "@nuxt/kit"
import { COMPONENT_NAMES } from "./component-names"
import { namesInDirs, subset } from "./iconSubset.mjs"

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
  /** Lucide icons registered up front (default "scan"). */
  icons?: "scan" | "all" | "kit" | string[]
}

function iconsPlugin(mode: LeavepulseUiOptions["icons"], srcDir: string): string {
  if (mode === "kit") return ""
  if (mode === "all") return 'import "@leavepulse/ui/icons-all"\n'
  const lucide = JSON.parse(readFileSync(createRequire(import.meta.url).resolve("@iconify-json/lucide/icons.json"), "utf8"))
  const names = Array.isArray(mode) ? mode.map((n) => n.replace(/^lucide:/, "")) : namesInDirs([srcDir])
  return `import { registerIconCollection } from "@leavepulse/ui"\nregisterIconCollection(${JSON.stringify(subset(lucide, names))})\n`
}

export default defineNuxtModule<LeavepulseUiOptions>({
  meta: { name: "@leavepulse/ui", configKey: "leavepulseUi" },
  defaults: { theme: true, link: true, icons: "scan" },
  setup(options, nuxt) {
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

    const icons = iconsPlugin(options.icons, nuxt.options.srcDir)
    if (icons) {
      addPluginTemplate({
        filename: "leavepulse-ui-icons.mjs",
        mode: "all",
        getContents: () => `${icons}import { defineNuxtPlugin } from "#app"\nexport default defineNuxtPlugin(() => {})\n`,
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
