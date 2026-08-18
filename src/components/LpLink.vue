<script setup lang="ts">
import { computed, type Component } from "vue"

const props = withDefaults(
  defineProps<{
    href?: string
    external?: boolean
    /** Shorthand for `tone="muted"`. */
    muted?: boolean
    /**
     * "brand" — the accent link colour (default).
     * "ink"   — inherits body text colour; for links that sit inside prose or
     *   chrome where an accent would shout (breadcrumbs, footers, nav).
     * "muted" / "soft" — progressively quieter, both resolving to ink on hover.
     */
    tone?: "brand" | "ink" | "muted" | "soft"
    /**
     * Root element/component. Defaults to a native <a>. Pass a router link
     * component (e.g. NuxtLink or RouterLink) to keep client-side navigation;
     * the kit stays DOM-agnostic, the consumer supplies the link component.
     * Router links take their destination through their own prop (`to`), which
     * falls through as a plain attribute.
     */
    as?: string | Component
    /**
     * "default" — plain hover underline.
     * "reveal"  — an underline bar that grows in from the left on hover
     *   (origin-left scale-x 0→1). The LeavePulse landing "monitoring" link feel;
     *   good for inline prose links and nav items that want a bit of motion.
     */
    variant?: "default" | "reveal"
  }>(),
  { variant: "default", as: "a" },
)

// A router link component owns its destination through its own prop (`to`),
// so `href` is only bound when this really renders an anchor. `target`/`rel`
// stay in play either way — router links honour them for external targets.
const isAnchor = computed(() => props.as === "a")

const rel = computed(() => (props.external ? "noopener noreferrer" : undefined))
const target = computed(() => (props.external ? "_blank" : undefined))

const colorClass = computed(() => {
  const tone = props.tone ?? (props.muted ? "muted" : "brand")
  switch (tone) {
    case "ink":
      return "text-ink"
    case "muted":
      return "text-muted-strong hover:text-ink"
    case "soft":
      return "text-muted hover:text-ink"
    default:
      return "text-brand hover:text-brand-hover"
  }
})

// The reveal bar: an ::after pseudo-element pinned to the baseline, full-width
// but scaled to 0 on the x-axis from the left, growing to 1 on hover/focus. The
// bar colour follows the link colour (brand, or ink when muted) so it re-skins
// with the theme.
const revealClass =
  "relative after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-[var(--duration-medium)] hover:after:scale-x-100 focus-visible:after:scale-x-100"
</script>

<template>
  <component
    :is="as"
    :href="isAnchor ? href : undefined"
    :target="target"
    :rel="rel"
    class="inline-flex items-center gap-1 underline-offset-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    :class="[
      colorClass,
      variant === 'reveal' ? revealClass : 'hover:underline',
    ]"
  >
    <slot />
  </component>
</template>
