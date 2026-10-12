/*
 * backdrop-filter capability detection.
 *
 * Every glass surface in the kit (dialog scrims, dropdown panels, the glass
 * skin) leans on backdrop-filter. WebKitGTK — the engine Tauri embeds on Linux,
 * and the one behind WebKit2GTK desktop shells — parses the property, reports
 * it as supported through BOTH CSS.supports() and @supports, resolves it to a
 * real computed value, and then composites it as a no-op. The layer tints; it
 * never blurs.
 *
 * That makes the usual feature query worthless: there is no CSS condition that
 * separates a working implementation from this one, because the engine answers
 * "yes" to all of them. Tailwind's own Safari workaround does not fire either
 * (WebKitGTK matches `margin-trim`, which the hack uses to rule Safari out).
 *
 * So the check is a runtime one, and deliberately conservative: it only flags
 * the engine fingerprint that is known to be broken, and treats anything it
 * cannot positively identify as working. A false negative costs a blur nobody
 * sees; a false positive would strip the blur from browsers that render it
 * correctly, which is the worse failure.
 */

/** Set on <html> when backdrop-filter resolves but does not composite. */
export const NO_BACKDROP_ATTR = "data-lp-no-backdrop"

/*
 * WebKit that is neither Chromium nor an Apple platform. Chromium keeps
 * "AppleWebKit" in its UA string, so it has to be excluded explicitly; real
 * Safari only ever runs on a Mac/iOS platform string. What survives both
 * filters is WebKitGTK/WPE — the broken case.
 */
export function isBrokenBackdropEngine(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent
  if (!/AppleWebKit/.test(ua)) return false
  if (/Chrome|Chromium|Edg\//.test(ua)) return false
  return !/Mac|iPhone|iPad|iPod/.test(nav.platform || "")
}

/**
 * Flag the document when backdrop-filter cannot be trusted, so the fallback
 * rules in tokens.css can trade blur for opacity. Safe to call more than once
 * and a no-op outside the browser.
 */
export function detectBackdropFilter(
  root: HTMLElement = document.documentElement,
): boolean {
  if (typeof navigator === "undefined") return true
  const usable = !isBrokenBackdropEngine()
  root.toggleAttribute(NO_BACKDROP_ATTR, !usable)
  return usable
}

/*
 * Glass without backdrop-filter. Where the engine cannot blur what lies under
 * a panel (the flag above), it can still blur an ordinary element, so a panel
 * can be frosted by painting a blurred copy of what is under it, as long as
 * that is known. In an app that paints its own wallpaper (a launcher, a shell)
 * it is: the consumer hands the wallpaper over as a CSS `background` value,
 * and every `.lp-glass-overlay` draws it, blurred and aligned to the viewport,
 * beneath its tint. Live content under the panel stays sharp; the wallpaper,
 * which is most of what glass shows, reads as frosted.
 *
 * The copy is placed by the panel's position on screen, which overlays animate
 * and drawers drag, so while any glass panel is mounted its offset is kept in
 * CSS variables (`--lp-gx`, `--lp-gy`) once a frame. Nothing runs where the
 * real blur works or no backdrop was given.
 */
export const GLASS_BACKDROP_ATTR = "data-lp-glass-backdrop"

let tracking = 0
let observer: MutationObserver | undefined

function trackPanels() {
  const panels = document.querySelectorAll<HTMLElement>(".lp-glass-overlay")
  for (const panel of panels) {
    const rect = panel.getBoundingClientRect()
    const x = `${Math.round(rect.left)}px`
    const y = `${Math.round(rect.top)}px`
    if (panel.style.getPropertyValue("--lp-gx") !== x) panel.style.setProperty("--lp-gx", x)
    if (panel.style.getPropertyValue("--lp-gy") !== y) panel.style.setProperty("--lp-gy", y)
  }
  tracking = panels.length ? requestAnimationFrame(trackPanels) : 0
}

function startTracking() {
  if (!tracking && document.querySelector(".lp-glass-overlay")) tracking = requestAnimationFrame(trackPanels)
}

/**
 * Give glass panels a wallpaper to frost where backdrop-filter does not work:
 * `setGlassBackdrop("url(/bg.jpg) center / cover no-repeat, #0b0f14")`, the
 * same value the app paints behind itself. `filter` replaces the default blur,
 * e.g. `"none"` for a wallpaper that was blurred ahead of time, which is
 * cheaper on an engine that blurs on the CPU. `null` turns it off.
 */
export function setGlassBackdrop(
  background: string | null,
  options: { filter?: string; root?: HTMLElement } = {},
): void {
  if (typeof document === "undefined") return
  const root = options.root ?? document.documentElement
  if (!background) {
    root.removeAttribute(GLASS_BACKDROP_ATTR)
    root.style.removeProperty("--lp-glass-backdrop")
    root.style.removeProperty("--lp-glass-backdrop-filter")
    observer?.disconnect()
    observer = undefined
    return
  }
  root.setAttribute(GLASS_BACKDROP_ATTR, "")
  root.style.setProperty("--lp-glass-backdrop", background)
  if (options.filter) root.style.setProperty("--lp-glass-backdrop-filter", options.filter)
  else root.style.removeProperty("--lp-glass-backdrop-filter")
  if (!root.hasAttribute(NO_BACKDROP_ATTR) || typeof MutationObserver === "undefined") return
  if (!observer) {
    observer = new MutationObserver(startTracking)
    observer.observe(document.body, { childList: true, subtree: true })
  }
  startTracking()
}
