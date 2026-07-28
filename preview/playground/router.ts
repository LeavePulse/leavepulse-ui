/*
 * Tiny History-API router for the preview app. The playground used to hold the
 * route in a plain ref, so every card opened at the same URL — the browser Back
 * button left the site instead of returning to the index, and a reload always
 * landed on Home. This gives each entry a real URL you can bookmark, reload and
 * navigate with Back/Forward, without pulling vue-router into the kit for a
 * demo-only concern.
 *
 * Routes:
 *   /                     → home
 *   /component/<id>       → a registry entry's live example
 *   /page/<id>            → a showcase page (layout, infra, showcase, appshell)
 */
import { ref, type Ref } from "vue"

export type Route =
  | { kind: "home" }
  | { kind: "component"; id: string }
  | { kind: "page"; id: string }

/** Vite serves the app under BASE_URL; strip it so routes work on subpaths. */
const base = import.meta.env.BASE_URL.replace(/\/$/, "")

export function parse(pathname: string): Route {
  const path = (pathname.startsWith(base) ? pathname.slice(base.length) : pathname).replace(
    /^\/+|\/+$/g,
    "",
  )
  const [section, id] = path.split("/")
  if (section === "component" && id) return { kind: "component", id: decodeURIComponent(id) }
  if (section === "page" && id) return { kind: "page", id: decodeURIComponent(id) }
  return { kind: "home" }
}

export function href(route: Route): string {
  if (route.kind === "home") return `${base}/`
  return `${base}/${route.kind}/${encodeURIComponent(route.id)}`
}

const current = ref<Route>(parse(window.location.pathname))

// Back/Forward: the URL is already updated, so just re-read it.
window.addEventListener("popstate", () => {
  current.value = parse(window.location.pathname)
})

export function navigate(route: Route) {
  const url = href(route)
  if (url !== window.location.pathname) history.pushState(null, "", url)
  current.value = route
  // A fresh page starts at the top, like a real navigation.
  window.scrollTo({ top: 0 })
}

/** The live route. Read it; call `navigate()` to change it. */
export function useRoute(): Ref<Route> {
  return current
}
