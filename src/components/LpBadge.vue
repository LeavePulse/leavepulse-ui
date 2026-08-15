<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed } from "vue"

const badge = tv({
  base: "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium",
  variants: {
    tone: {
      neutral: "bg-surface-soft text-muted-strong",
      brand: "bg-brand-soft text-brand",
      action: "bg-action/15 text-action",
      success: "bg-action/15 text-action",
      // Partial trouble, which every status surface eventually needs: without
      // it a half-failed thing has to render as either fine or broken.
      warning: "bg-accent/15 text-accent",
      danger: "bg-danger-soft text-danger",
      outline: "border border-line text-ink",
    },
  },
  defaultVariants: { tone: "neutral" },
})

type BadgeVariants = VariantProps<typeof badge>

const props = defineProps<{ tone?: BadgeVariants["tone"]; dot?: boolean }>()

const classes = computed(() => badge({ tone: props.tone }))
</script>

<template>
  <span :class="classes">
    <span v-if="dot" class="size-1.5 rounded-full bg-current" />
    <slot />
  </span>
</template>
