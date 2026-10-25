import type { Ref } from "vue"
import { useMediaQuery } from "./useMediaQuery"

/*
 * `prefersReducedMotion()` as a ref, for a component that has to RE-RENDER
 * when the setting changes mid-session (a spring that becomes an instant move,
 * a tilt that goes flat), not just read it when an animation starts.
 *
 * The kit had two sources for this question: the plain function in easing.ts
 * and motion-v's `useReducedMotion`, picked per file. Both read the same media
 * query, so this is the one reactive answer and the function stays the one
 * point-in-time answer. motion-v's hook adds nothing the kit needs: motion-v
 * does not consult it for its own layout animations (every caller had to turn
 * a spring into `{ duration: 0 }` itself), and it reads the page's window, where
 * this asks the window the component renders in (an LpFrame's, say).
 *
 * False until mounted, like every media query here, so a server render and the
 * hydrating client agree; nothing animates before mount anyway.
 */
export function usePrefersReducedMotion(): Ref<boolean> {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}
