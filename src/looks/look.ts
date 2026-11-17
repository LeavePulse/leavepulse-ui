import { computed, type ComputedRef } from "vue"
import type { IconifyJSON } from "@iconify/vue"
import { useLpConfig } from "../composables/useLpConfig"
import type { LoaderVariant } from "../components/LpLoader.vue"
import type { ShaderPreset } from "../components/shaderBackdrop"

/*
 * A look is the part of a style the theme's tokens cannot carry: which icons
 * draw a name, how motion moves, and which variant a component takes when the
 * app did not name one. A theme says what colour and shape things are; a look
 * says what they are drawn with. They are separate so either can change alone
 * (the pixel look over a light theme, the default look over the pixel theme).
 *
 * An app sets one with the kit config, app-wide or for a subtree:
 *
 *   app.use(lpConfig({ look: pixelLook }))
 *
 * Nothing in the app changes: it keeps writing "lucide:check" and
 * <LpLoader />; the look decides that they render as a pixel check and a grid.
 * An explicit prop always wins over the look.
 */
export interface LookIcons {
  /** iconify prefix of the set the look draws with. */
  prefix: string
  /** lucide name → name in that set. A lucide name without a pair stays lucide. */
  map: Readonly<Record<string, string>>
  /** The icons the map points at, registered on first use so they render offline. */
  collection: IconifyJSON
}

export interface Look {
  name: string
  icons?: LookIcons
  /**
   * `stepped` swaps the kit's easing curves for steps, so every transition
   * moves in a few discrete frames (the pixel look). Applied through the
   * `data-lp-motion` attribute, which `lpConfig` sets on the document; a
   * subtree that wants it on its own puts the attribute on its wrapper.
   */
  motion?: "smooth" | "stepped"
  /** LpLoader's variant when none is given. */
  loader?: LoaderVariant
  /** LpProgress's variant when none is given. */
  progress?: "bar" | "ring" | "ascii"
  /** LpShaderBackdrop's preset when none is given. */
  backdrop?: ShaderPreset
}

/** The look in effect for the caller, from the kit config; the empty look when none is set. */
export function useLook(): ComputedRef<Look> {
  const config = useLpConfig()
  return computed(() => config.value.look ?? { name: "default" })
}
