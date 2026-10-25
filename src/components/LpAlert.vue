<script lang="ts">
// The consumer's `class` is merged into the root's own (below) rather than
// appended to it, so opt out of the automatic pass-through that would add it
// a second time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { tv, type VariantProps } from "tailwind-variants"
import { computed, ref, useSlots, watch } from "vue"
import { useMergedAttrs } from "../composables/useMergedClass"
import LpIcon from "./LpIcon.vue"
import LpSwap from "./LpSwap.vue"
import { slotText } from "./slotText"

const alert = tv({
  /*
   * An alert changes while it is read (saving → saved → failed), so the change
   * shows as one: the tint eases between variants, the icon turns over, and
   * the message is swapped by LpSwap, its box easing to the new height.
   */
  base: "flex gap-3 rounded-card border p-4 text-sm transition-[background-color,border-color,color] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none",
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

// `p-3` or a different border must beat the variant's own, not race it.
const { class: rootClass, attrs: rest } = useMergedAttrs(() => alert({ variant: props.variant }))
const resolvedIcon = computed(() => props.icon ?? (props.busy ? "lucide:loader-circle" : ICONS[props.variant ?? "info"]))
const iconTone = computed(() => ICON_TONE[props.variant ?? "info"])

// What counts as another message: the variant, the title and the slot's words
// when it is plain text. Rich content keeps its key and only eases its height.
const slots = useSlots()
const messageKey = () => [props.variant, props.title ?? "", slotText(slots.default) ?? ""].join("\u0000")
</script>

<template>
  <div :class="rootClass" :role="role" :aria-busy="busy || undefined" v-bind="rest">
    <span class="relative mt-0.5 grid size-[18px] shrink-0 place-items-center" aria-hidden="true">
      <Transition
        enter-from-class="scale-50 opacity-0"
        leave-to-class="scale-50 opacity-0"
        enter-active-class="transition-[scale,opacity] duration-(--duration-medium) ease-(--ease-emphasized) motion-reduce:transition-none"
        leave-active-class="absolute transition-[scale,opacity] duration-(--duration-fast) ease-out motion-reduce:transition-none"
      >
        <LpIcon
          :key="resolvedIcon"
          :name="resolvedIcon"
          :size="18"
          :class="[iconTone, 'transition-colors duration-(--duration-medium)', busy ? 'animate-spin motion-reduce:animate-none' : '']"
        />
      </Transition>
    </span>
    <LpSwap :swap-key="messageKey()" class="min-w-0 flex-1">
      <p v-if="title" class="font-semibold text-ink">{{ title }}</p>
      <div :class="['text-muted-strong', title ? 'mt-0.5' : '']">
        <slot />
      </div>
    </LpSwap>
  </div>
</template>
