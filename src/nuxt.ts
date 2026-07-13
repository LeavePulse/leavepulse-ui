/*
 * Nuxt module — auto-registers every kit component globally so consuming apps
 * use <LpButton> / <LpThemeSwitcher> / … with no per-app component list to
 * maintain. Add it to a Nuxt app's `modules`:
 *
 *   export default defineNuxtConfig({ modules: ["@leavepulse/ui/nuxt"] })
 *
 * The list comes from the generated component-names file (kept in sync with the
 * actual components at build), so a NEW component is available everywhere with
 * no consumer change.
 */
import { addComponent, defineNuxtModule } from "@nuxt/kit"
import { COMPONENT_NAMES } from "./component-names"

export default defineNuxtModule({
  meta: { name: "@leavepulse/ui", configKey: "leavepulseUi" },
  setup() {
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
  },
})
