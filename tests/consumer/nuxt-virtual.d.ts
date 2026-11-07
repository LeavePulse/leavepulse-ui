// What a Nuxt app generates for itself: just enough for the kit's plugins to
// type-check outside one.
declare module "#imports" {
  import type { App } from "vue"
  export const defineNuxtPlugin: (setup: (nuxtApp: { vueApp: App; [key: string]: any }) => unknown) => unknown
  export const useCookie: <T = any>(...args: any[]) => any
  export const useHead: (...args: any[]) => any
  export const useRequestHeaders: (...args: any[]) => any
  export const useRequestEvent: (...args: any[]) => any
  export const useRuntimeConfig: () => any
}

interface ImportMeta {
  readonly client: boolean
  readonly server: boolean
}

declare module "#components" {
  import type { Component } from "vue"
  export const NuxtLink: Component
}

declare module "#app" {
  export const defineNuxtPlugin: (setup: () => unknown) => unknown
}

declare module "#lp-ui-themes" {
  const themes: import("@leavepulse/ui").TokenSet[]
  export default themes
}
