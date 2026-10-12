/*
 * Nuxt runtime plugin: provides the kit configuration app-wide, with NuxtLink
 * as the link component, so navigation pieces (LpLink, LpButton with `to`,
 * LpBreadcrumbs, LpSidebar items) navigate client-side without an `as` on
 * every call site. Registered by the kit's Nuxt module.
 */
import { LP_CONFIG, type LpConfig } from "@leavepulse/ui"
import { NuxtLink } from "#components"
import { defineNuxtPlugin } from "#imports"

export default defineNuxtPlugin((nuxtApp) => {
  const config: LpConfig = { linkComponent: NuxtLink }
  nuxtApp.vueApp.provide(LP_CONFIG, config)
})
