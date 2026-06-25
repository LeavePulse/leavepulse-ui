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
      addComponent({ name, export: name, filePath: "@leavepulse/ui" })
    }
  },
})
