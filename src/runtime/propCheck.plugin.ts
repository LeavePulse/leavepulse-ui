/*
 * Nuxt runtime plugin: warns in `nuxt dev` about an unknown prop on a kit
 * component. Registered by the kit's Nuxt module, never in a build.
 */
import { lpPropCheck } from "@leavepulse/ui"
import { defineNuxtPlugin } from "#imports"

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(lpPropCheck)
})
