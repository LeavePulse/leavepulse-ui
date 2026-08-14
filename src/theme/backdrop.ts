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
