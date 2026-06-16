<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed } from "vue"

const card = tv({
  base: "rounded-card border bg-surface-raised",
  variants: {
    variant: {
      raised: "border-line shadow-panel",
      flat: "border-line",
      ghost: "border-transparent bg-transparent",
    },
    padded: { true: "p-5", false: "" },
    interactive: {
      true: "transition-colors duration-[var(--duration-fast)] hover:border-line-strong",
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
