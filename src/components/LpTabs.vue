<script setup lang="ts">
import { Motion, useReducedMotion } from "motion-v"
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui"
import { computed, ref, useId } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import LpIcon from "./LpIcon.vue"

export interface TabItem {
  value: string
  label: string
  /** Optional iconify name (e.g. "lucide:palette"), shown left of the label. */
  icon?: string
}

withDefaults(
  defineProps<{
    modelValue?: string
    items: TabItem[]
    /**
     * "contained" (default) wraps the triggers in a bordered, filled bar.
     * "plain" drops the container chrome — a flat row of tabs with only the
     * sliding pill marking the active one (for nav bars over a custom surface).
     */
    variant?: "contained" | "plain"
    /** Tint the active pill + label with the brand colour (nav-bar style). */
    accent?: boolean
    /** Stretch the bar to full width with equal-share triggers. */
    block?: boolean
  }>(),
  { variant: "contained", accent: false, block: false },
)
defineEmits<{ (e: "update:modelValue", value: string): void }>()

// The pill sits under the hovered tab, falling back to the active one
// (UAProject header behaviour). motion-v shared layoutId animates the move.
// The id must be unique per instance — a shared constant makes the pill fly
// between separate LpTabs on the same page.
const pillId = `lp-tab-indicator-${useId()}`
const hovered = ref<string | null>(null)

// Pill move spring (snaps to instant under reduced motion); shared with the
// other pill-indicator components.
const pillTransition = usePillTransition()

// Panel height spring: when the active #panel differs in height, the wrapper
// grows/shrinks smoothly instead of snapping. Same feel as the drag layout in
// LayoutNode; collapses to instant under reduced motion.
const reduceMotion = useReducedMotion()
const panelLayoutTransition = computed(() =>
  reduceMotion.value
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.9 },
)

function pillUnder(value: string, active?: string): boolean {
  return hovered.value ? hovered.value === value : active === value
}
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    @update:model-value="(v) => $emit('update:modelValue', v as string)"
  >
    <TabsList
      class="gap-1"
      :class="[
        block ? 'flex w-full' : 'inline-flex',
        variant === 'contained' ? 'rounded-control border border-line bg-surface-soft p-1' : '',
      ]"
      @pointerleave="hovered = null"
    >
      <TabsTrigger
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="relative inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring"
        :class="[
          block ? 'flex-1' : '',
          accent ? 'data-[state=active]:text-brand' : 'data-[state=active]:text-ink',
          hovered === item.value ? 'text-ink' : 'text-muted',
        ]"
        @pointerenter="hovered = item.value"
      >
        <Motion
          v-if="pillUnder(item.value, modelValue)"
          :layout-id="pillId"
          :transition="pillTransition"
          class="absolute inset-0 z-0 rounded-md shadow-sm"
          :class="accent
            ? 'border border-brand/35 bg-brand/12'
            : 'border border-line bg-surface-raised'"
        />
        <LpIcon v-if="item.icon" :name="item.icon" :size="14" class="relative z-10" />
        <span class="relative z-10">{{ item.label }}</span>
      </TabsTrigger>
    </TabsList>

    <!-- Animated panels: only rendered if a per-item #panel slot is provided.
         The Motion wrapper layout-animates its height so switching to a taller
         or shorter panel grows/shrinks smoothly instead of snapping. -->
    <Motion
      v-if="$slots.panel"
      :layout="true"
      :transition="panelLayoutTransition"
      class="mt-3 overflow-hidden"
    >
      <TabsContent
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="outline-none data-[state=active]:animate-[tab-in_200ms_var(--ease-emphasized)]"
      >
        <slot name="panel" :value="item.value" />
      </TabsContent>
    </Motion>

    <slot />
  </TabsRoot>
</template>
