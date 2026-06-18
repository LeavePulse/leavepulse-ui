<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed, type Component } from "vue"

const button = tv({
  base: [
    "inline-flex select-none items-center justify-center gap-2 font-semibold",
    "rounded-control transition-colors duration-[var(--duration-fast)]",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
  ],
  variants: {
    variant: {
      solid: "bg-brand text-ink-inverse hover:bg-brand-hover",
      action:
        "bg-action text-ink-inverse shadow-[0_14px_28px_color-mix(in_srgb,var(--color-action)_24%,transparent)] hover:bg-action-hover",
      outline: "border border-line-strong text-ink hover:border-brand hover:bg-white/[0.04]",
      // raised surface tile with a border — a visible, neutral filled button
      soft: "border border-line bg-surface-raised/80 text-ink hover:border-line-strong hover:bg-surface-soft",
      ghost: "text-ink hover:bg-white/[0.06]",
      muted: "text-muted hover:bg-white/[0.04] hover:text-ink",
      // high-contrast light fill (e.g. a "download" CTA on a dark hero)
      light: "border border-white/20 bg-white text-ink-inverse hover:bg-white/90",
      danger: "bg-danger text-ink-inverse hover:bg-danger-hover",
    },
    size: {
      xs: "h-8 px-2.5 text-xs",
      sm: "h-(--size-control-sm) px-3 text-xs",
      md: "h-(--size-control-md) px-4 text-sm",
      lg: "h-(--size-control-lg) px-5 text-sm",
    },
    block: { true: "w-full" },
    // icon-only square button — equal sides, no horizontal padding
    square: { true: "aspect-square p-0" },
    // soft elevation glow keyed to the variant's colour
    glow: { true: "" },
  },
  compoundVariants: [
    { square: true, size: "xs", class: "size-8" },
    { square: true, size: "sm", class: "size-(--size-control-sm)" },
    { square: true, size: "md", class: "size-(--size-control-md)" },
    { square: true, size: "lg", class: "size-(--size-control-lg)" },
    {
      glow: true,
      variant: "solid",
      class:
        "shadow-[0_8px_22px_color-mix(in_srgb,var(--color-brand)_28%,transparent)] hover:shadow-[0_12px_28px_color-mix(in_srgb,var(--color-brand)_36%,transparent)]",
    },
    {
      glow: true,
      variant: "danger",
      class:
        "shadow-[0_8px_22px_color-mix(in_srgb,var(--color-danger)_28%,transparent)] hover:shadow-[0_12px_28px_color-mix(in_srgb,var(--color-danger)_36%,transparent)]",
    },
    {
      glow: true,
      variant: "light",
      class:
        "shadow-[0_8px_18px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_24px_rgba(255,255,255,0.3)]",
    },
  ],
  defaultVariants: { variant: "solid", size: "md" },
})

type ButtonVariants = VariantProps<typeof button>

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants["variant"]
    size?: ButtonVariants["size"]
    block?: boolean
    square?: boolean
    glow?: boolean
    /**
     * Root element/component. Defaults to a native <button>. Pass a router link
     * component (e.g. NuxtLink) or "a" to render a link-styled button; the kit
     * stays DOM-agnostic, the consumer supplies the link component.
     */
    as?: string | Component
    type?: "button" | "submit" | "reset"
    disabled?: boolean
  }>(),
  { as: "button", type: "button" },
)

const isNativeButton = computed(() => props.as === "button")

const classes = computed(() =>
  button({
    variant: props.variant,
    size: props.size,
    block: props.block,
    square: props.square,
    glow: props.glow,
  }),
)
</script>

<template>
  <component
    :is="as"
    :type="isNativeButton ? type : undefined"
    :disabled="isNativeButton ? disabled : undefined"
    :aria-disabled="!isNativeButton && disabled ? 'true' : undefined"
    :class="classes"
  >
    <slot />
  </component>
</template>
