<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed } from "vue"
import LpIcon from "./LpIcon.vue"

const alert = tv({
  base: "flex gap-3 rounded-card border p-4 text-sm",
  variants: {
    variant: {
      info: "border-line bg-surface-soft text-ink",
      success: "border-action/30 bg-action/10 text-ink",
      warning: "border-accent/30 bg-accent/10 text-ink",
      danger: "border-danger/30 bg-danger/10 text-ink",
    },
  },
  defaultVariants: { variant: "info" },
})

type AlertVariants = VariantProps<typeof alert>

const ICONS: Record<NonNullable<AlertVariants["variant"]>, string> = {
  info: "lucide:info",
  success: "lucide:circle-check",
  warning: "lucide:triangle-alert",
  danger: "lucide:octagon-alert",
}

const ICON_TONE: Record<NonNullable<AlertVariants["variant"]>, string> = {
  info: "text-brand",
  success: "text-action",
  warning: "text-accent",
  danger: "text-danger",
}

const props = withDefaults(
  defineProps<{
    variant?: AlertVariants["variant"]
    title?: string
    icon?: string
  }>(),
  { variant: "info" },
)

const classes = computed(() => alert({ variant: props.variant }))
const resolvedIcon = computed(() => props.icon ?? ICONS[props.variant ?? "info"])
const iconTone = computed(() => ICON_TONE[props.variant ?? "info"])
</script>

<template>
  <div :class="classes" role="alert">
    <LpIcon :name="resolvedIcon" :size="18" :class="['mt-0.5 shrink-0', iconTone]" />
    <div class="min-w-0">
      <p v-if="title" class="font-semibold text-ink">{{ title }}</p>
      <div :class="['text-muted-strong', title ? 'mt-0.5' : '']">
        <slot />
      </div>
    </div>
  </div>
</template>
