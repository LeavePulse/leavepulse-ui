<script lang="ts">
// The root class is merged with the consumer's (useMergedAttrs).
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/*
 * Accent text with light moving through it.
 *
 * Two looks, for two jobs:
 *
 *   "shine"    — the text keeps its tone and a soft band sweeps across it now
 *     and then. Draws the eye to one word without changing what it says: a
 *     "New" next to a menu item, the plan name on an upgrade card, a status
 *     that is still working ("Deploying…").
 *   "gradient" — the text is painted with the theme's brand, accent and action
 *     colours drifting across it. A display headline, a logo word.
 *
 *   <LpShinyText>Pro</LpShinyText>
 *   <LpShinyText variant="gradient" as="h1" class="text-4xl font-bold">Leave Pulse</LpShinyText>
 *
 * Pure CSS: the text is clipped to an animated background. The sheen moves
 * toward the theme's ink, not toward white, so it lightens the text on a dark
 * theme and darkens it on a light one and the word never washes out into the
 * page. The loop pauses while the text is off screen or the tab is hidden;
 * under reduced motion it stands still (the gradient stays, the sheen goes).
 */
import { computed } from "vue"
import { useInView } from "../composables/useInView"
import { useMergedAttrs } from "../composables/useMergedClass"

const props = withDefaults(
  defineProps<{
    /** `shine` sweeps a band over toned text; `gradient` paints it with drifting theme colours. */
    variant?: "shine" | "gradient"
    /** Base colour for `shine`. `ink` sweeps the brand colour over plain text. */
    tone?: "brand" | "accent" | "action" | "ink"
    /** Seconds per sweep. Slower reads as ambient; under ~1.5 s it starts to nag. */
    speed?: number
    /** Stop the motion (keeps the look). For a word that should only shine while something is happening. */
    paused?: boolean
    /** Element to render. */
    as?: string
  }>(),
  { variant: "shine", tone: "brand", speed: 3, paused: false, as: "span" },
)

const { el, inView } = useInView()
const { class: rootClass, attrs: rest } = useMergedAttrs(() => `lp-shiny lp-shiny--${props.variant}`)

const TONES = {
  brand: "var(--color-brand)",
  accent: "var(--color-accent)",
  action: "var(--color-action)",
  ink: "var(--color-ink)",
} as const

const style = computed(() => {
  const base = TONES[props.tone]
  return {
    "--lp-shiny-base": base,
    // Toward ink, so the band is the contrast direction in either theme; plain
    // ink text gets a brand band instead, since ink toward ink is no band.
    "--lp-shiny-sheen":
      props.tone === "ink" ? "var(--color-brand)" : `color-mix(in oklab, ${base}, var(--color-ink) 65%)`,
    "--lp-shiny-speed": `${Math.max(0.3, props.speed)}s`,
    animationPlayState: props.paused || !inView.value ? "paused" : "running",
  }
})
</script>

<template>
  <component :is="as" ref="el" :class="rootClass" :style="style" v-bind="rest">
    <slot />
  </component>
</template>

<style>
.lp-shiny {
  color: var(--lp-shiny-base);
  background-repeat: repeat-x;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  /* Descenders and italics poke out of the content box; the clip follows the
     background box, so give it room instead of cutting a tail off. */
  padding-block: 0.08em;
  animation: lp-shiny-move var(--lp-shiny-speed) linear infinite;
}

.lp-shiny--shine {
  /* The band is a third of a 300% wide image; the image moves by its own
     width, so the band crosses the text and then rests off to the side for
     a while, which is what makes it an occasional glint and not a strobe. */
  background-image: linear-gradient(
    105deg,
    var(--lp-shiny-base) 0%,
    var(--lp-shiny-base) 40%,
    var(--lp-shiny-sheen) 50%,
    var(--lp-shiny-base) 60%,
    var(--lp-shiny-base) 100%
  );
  background-size: 300% 100%;
}

.lp-shiny--gradient {
  /* First and last stops match, so the repeat has no seam as it drifts. */
  background-image: linear-gradient(
    90deg,
    var(--color-brand),
    var(--color-accent),
    var(--color-action),
    var(--color-brand)
  );
  background-size: 200% 100%;
}

@keyframes lp-shiny-move {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -200% 0;
  }
}

.lp-shiny--gradient {
  animation-name: lp-shiny-drift;
}

@keyframes lp-shiny-drift {
  from {
    background-position: 0% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lp-shiny {
    animation: none;
  }
}
</style>
