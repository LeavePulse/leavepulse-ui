/*
 * Easing curves for animations driven in JAVASCRIPT rather than by CSS.
 *
 * Most of the kit eases with a CSS custom property — `var(--ease-travel)` and
 * friends in tokens.css. A few animations cannot: they interpolate a NUMBER
 * that several elements then derive from (LpProgress drives an arc and its
 * counter off one value; LpPie sweeps a clip path; LpNumberFlow moves a figure
 * its digit columns are computed from). There is no property to transition, so
 * the curve has to be a function.
 *
 * These are the counterparts of the CSS tokens, kept together so a component
 * picks a named feel instead of open-coding a polynomial — which is how the
 * curve in LpProgress and the one in LpNumberFlow drifted apart while a comment
 * in each still claimed they matched.
 *
 * They are approximations of the cubic-beziers, not exact ports: a bezier needs
 * solving per frame, and for these the shape is what matters, not the decimals.
 * Change one and change its token in tokens.css.
 */

/**
 * Does the OS ask for less motion?
 *
 * Written out in eight places before this, in two different shapes — some
 * guarded against SSR, some not, which is a crash in a Nuxt app rather than a
 * style difference. Anything that animates asks here.
 *
 * A plain function, not a reactive composable: it is read at the moment an
 * animation starts, and a component that also needs to RE-RENDER when the
 * setting changes mid-session should use motion-v's `useReducedMotion`.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)

/**
 * A motion token's value, for an API that cannot take a `var()`.
 *
 * The Web Animations API and SVG's SMIL both want a literal easing string, so
 * three call sites had `cubic-bezier(0.2, 0, 0, 1)` typed out — the value of
 * `--ease-emphasized`, copied. A theme that retuned the token moved everything
 * except those, and nothing said they were meant to match.
 *
 * Reading the custom property keeps them themeable. The fallback covers SSR and
 * the frame before tokens are applied.
 */
export const easingToken = (
  name: "ease-emphasized" | "ease-travel" | "ease-settle",
  fallback = "cubic-bezier(0.2, 0, 0, 1)",
): string => {
  if (typeof window === "undefined" || !window.getComputedStyle) return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  return value || fallback
}

/**
 * Comes to rest — `--ease-settle`'s shape without the overshoot.
 *
 * Gently decelerating: the value keeps moving visibly for most of the travel
 * instead of arriving early and then creeping. Use it wherever a figure counts
 * up to something, so the digits keep turning across the whole duration.
 */
export const easeOut = (t: number): number => 1 - (1 - t) ** 2

/**
 * Travels a distance the eye follows — the JS form of `--ease-travel`.
 *
 * Nearly linear, and deliberately so: an ease-out spends about half its
 * duration covering the last tenth of the path, so a stroke or sweep animated
 * with one flashes past and then visibly creeps. Use this wherever the journey
 * is the content — a line drawing itself, a wipe crossing a plot, a circle
 * sweeping open.
 *
 * The ease is applied only near the ends, and the finish is NOT flattened onto
 * the target: the motion is still moving when it lands, which is what keeps
 * the tail short.
 */
export const easeTravel = (t: number): number => {
  // Smooth the first and last ~20% and run straight through the middle.
  const EDGE = 0.2
  if (t < EDGE) return (t * t) / (2 * EDGE) + t * 0.1
  if (t > 1 - EDGE) {
    const r = 1 - t
    return 1 - ((r * r) / (2 * EDGE) + r * 0.1)
  }
  const head = (EDGE * EDGE) / (2 * EDGE) + EDGE * 0.1
  return head + ((t - EDGE) / (1 - 2 * EDGE)) * (1 - 2 * head)
}
