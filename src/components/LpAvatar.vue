<script setup lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from "reka-ui"
import { tv, type VariantProps } from "tailwind-variants"
import { computed } from "vue"

const avatar = tv({
  base: "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-pill bg-surface-soft font-medium text-muted-strong",
  variants: {
    size: {
      sm: "size-7 text-xs",
      md: "size-9 text-sm",
      lg: "size-12 text-base",
    },
  },
  defaultVariants: { size: "md" },
})

type AvatarVariants = VariantProps<typeof avatar>

const props = withDefaults(
  defineProps<{ src?: string; alt?: string; fallback?: string; size?: AvatarVariants["size"] }>(),
  { size: "md" },
)

const initials = computed(
  () => props.fallback ?? props.alt?.slice(0, 2).toUpperCase() ?? "?",
)
</script>

<template>
  <AvatarRoot :class="avatar({ size })">
    <AvatarImage v-if="src" :src="src" :alt="alt" class="size-full object-cover" />
    <AvatarFallback>{{ initials }}</AvatarFallback>
  </AvatarRoot>
</template>
