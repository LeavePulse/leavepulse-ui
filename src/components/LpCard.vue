<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed } from "vue"

const card = tv({
  base: "rounded-card border bg-surface-raised",
  variants: {
    variant: {
      // raised opts into the skin painter (.lp-skin-panel) so it follows the
      // active surface tokens (flat → glass) instead of a fixed shadow.
      raised: "lp-skin-panel border-line",
      flat: "border-line",
      ghost: "border-transparent bg-transparent",
    },
    padded: { true: "p-5", false: "" },
    // Lift on hover with a BRAND-tinted glow + brand border (a black drop-shadow
    // was invisible on dark themes — it only showed on light). We write the glow
    // through `--surface-panel-shadow`, the very variable the skin-painter feeds
    // into .lp-skin-panel's box-shadow, AND set box-shadow directly — so the glow
    // lands on both the `raised` variant (skin panel, whose own box-shadow would
    // otherwise win, being declared outside @layer) and `flat`/`ghost`.
    // NOTE: in Tailwind v4 `translate-*` writes the native `translate` property
    // (not `transform`), so the transition list MUST name `translate` explicitly
    // or the lift snaps while the rest eases.
    interactive: {
      true: "cursor-pointer transition-[translate,box-shadow,border-color] duration-medium ease-[var(--ease-emphasized)] hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[var(--lp-card-glow)] hover:[--surface-panel-shadow:var(--lp-card-glow)] [--lp-card-glow:0_8px_24px_-6px_color-mix(in_srgb,var(--color-brand)_38%,transparent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    },
  },
})

type CardVariants = VariantProps<typeof card>

// Defaults live on the props, not on tv() — passing `undefined` into tv
// overrides its defaultVariants and silently drops the padding.
const props = withDefaults(
  defineProps<{
    variant?: CardVariants["variant"]
    padded?: boolean
    interactive?: boolean
  }>(),
  { variant: "raised", padded: true, interactive: false },
)

const classes = computed(() =>
  card({ variant: props.variant, padded: props.padded, interactive: props.interactive }),
)
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
