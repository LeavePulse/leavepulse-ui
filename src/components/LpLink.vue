<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    href?: string
    external?: boolean
    muted?: boolean
    /**
     * "default" — plain hover underline.
     * "reveal"  — an underline bar that grows in from the left on hover
     *   (origin-left scale-x 0→1). The LeavePulse landing "monitoring" link feel;
     *   good for inline prose links and nav items that want a bit of motion.
     */
    variant?: "default" | "reveal"
  }>(),
  { variant: "default" },
)

const rel = computed(() => (props.external ? "noopener noreferrer" : undefined))
const target = computed(() => (props.external ? "_blank" : undefined))

const colorClass = computed(() =>
  props.muted ? "text-muted hover:text-ink" : "text-brand hover:text-brand-hover",
)

// The reveal bar: an ::after pseudo-element pinned to the baseline, full-width
// but scaled to 0 on the x-axis from the left, growing to 1 on hover/focus. The
// bar colour follows the link colour (brand, or ink when muted) so it re-skins
// with the theme.
const revealClass =
  "relative after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-[var(--duration-medium)] hover:after:scale-x-100 focus-visible:after:scale-x-100"
</script>

<template>
  <a
    :href="href"
    :target="target"
    :rel="rel"
    class="inline-flex items-center gap-1 underline-offset-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
    :class="[
      colorClass,
      variant === 'reveal' ? revealClass : 'hover:underline',
    ]"
  >
    <slot />
  </a>
</template>
