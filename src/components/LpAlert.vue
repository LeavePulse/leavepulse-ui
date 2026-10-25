<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed, ref, watch } from "vue"
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
    /**
     * Announce the alert to screen readers when it appears. "assertive"
     * (role=alert) interrupts and is for something that needs action now,
     * "polite" (role=status) waits its turn, false reads it in place. By
     * default only `danger` interrupts: an info or success banner that is part
     * of the page from the start should not be shouted on load.
     */
    live?: "assertive" | "polite" | false
    /**
     * Work is under way: the icon becomes a spinning loader (unless `icon` is
     * given, which then spins instead) and the alert is announced politely.
     * A loader drawn as a still icon read as a frozen page.
     */
    busy?: boolean
  }>(),
  { variant: "info", live: undefined, busy: false },
)

// A region that was busy stays a polite region after the work ends: dropping
// the role exactly when the result replaces "Saving…" would leave the result
// unannounced, and a live region that comes and goes is read unreliably.
const wasBusy = ref(props.busy)
watch(() => props.busy, (busy) => {
  if (busy) wasBusy.value = true
})

const role = computed(() => {
  const live = props.live ?? (props.variant === "danger" ? "assertive" : wasBusy.value ? "polite" : false)
  return live === "assertive" ? "alert" : live === "polite" ? "status" : undefined
})

const classes = computed(() => alert({ variant: props.variant }))
const resolvedIcon = computed(() => props.icon ?? (props.busy ? "lucide:loader-circle" : ICONS[props.variant ?? "info"]))
const iconTone = computed(() => ICON_TONE[props.variant ?? "info"])
</script>

<template>
  <div :class="classes" :role="role" :aria-busy="busy || undefined">
    <LpIcon
      :name="resolvedIcon"
      :size="18"
      :class="['mt-0.5 shrink-0', iconTone, busy ? 'animate-spin motion-reduce:animate-none' : '']"
      aria-hidden="true"
    />
    <div class="min-w-0">
      <p v-if="title" class="font-semibold text-ink">{{ title }}</p>
      <div :class="['text-muted-strong', title ? 'mt-0.5' : '']">
        <slot />
      </div>
    </div>
  </div>
</template>
