<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed } from "vue"

const badge = tv({
  // HUD: mono, uppercase, tracked — reads as a technical status tag, not a pill.
  base: "inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
  variants: {
    tone: {
      neutral: "bg-surface-soft text-muted-strong",
      brand: "bg-brand-soft text-brand",
      action: "bg-action/15 text-action",
      success: "bg-action/15 text-action",
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
