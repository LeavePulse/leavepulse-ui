import type { Component } from "vue"

/*
 * How a navigation target renders: an internal destination goes through the
 * configured link component (RouterLink, NuxtLink) so it navigates client-side,
 * anything else is a plain anchor. Shared by every kit piece that links.
 */
export type LinkTarget = string | Record<string, unknown>

export interface ResolvedLink {
  is: Component | string
  props: Record<string, unknown>
}

/** An app-relative path: "/x", not "//host" or "https://…". */
export function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//")
}

export function resolveLink(
  linkComponent: Component | string,
  target: { to?: LinkTarget; href?: string },
): ResolvedLink | null {
  const router = linkComponent !== "a"
  if (target.to != null) {
    if (router) return { is: linkComponent, props: { to: target.to } }
    return typeof target.to === "string" ? { is: "a", props: { href: target.to } } : null
  }
  if (target.href != null) {
    if (router && isInternalHref(target.href)) return { is: linkComponent, props: { to: target.href } }
    return { is: "a", props: { href: target.href } }
  }
  return null
}
