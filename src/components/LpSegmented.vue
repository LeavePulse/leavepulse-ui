<script setup lang="ts">
/*
 * Segmented control — a compact bar of mutually-exclusive options with a sliding
 * pill marking the selection (iOS-style). Built on reka ToggleGroup for the
 * roving-focus/keyboard wiring; the pill rides motion-v's shared layoutId, the
 * same trick as LpTabs/LpPagination. Use it for short option sets (2–5) where a
 * full Tabs bar is too heavy — view switches, density toggles, on/off-ish picks.
 */
import { Motion } from "motion-v"
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui"
import { useId } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import LpIcon from "./LpIcon.vue"

export interface SegmentedOption {
  value: string
  label?: string
  /** Optional iconify name shown before the label (or alone, icon-only). */
  icon?: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    options: SegmentedOption[]
    size?: "sm" | "md"
    /** Stretch to fill the container with equal-width segments. */
    block?: boolean
    disabled?: boolean
  }>(),
  { size: "md", block: false },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
}>()

// reka types the payload as AcceptableValue|AcceptableValue[]; in single mode it's
// the chosen string (or "" on deselect). We keep a value selected — clicking the
// active segment again shouldn't clear it — so ignore the deselect-to-empty.
function onChange(v: unknown) {
  if (typeof v === "string" && v) emit("update:modelValue", v)
}

const sizeCls = {
  sm: "h-(--size-control-sm) text-xs",
  md: "h-(--size-control-md) text-sm",
}

const pillId = `lp-segmented-${useId()}`
const pillTransition = usePillTransition()
</script>

<template>
  <ToggleGroupRoot
    :model-value="modelValue"
    type="single"
    :disabled="disabled"
    :rovingFocus="true"
    class="inline-flex items-center gap-1 rounded-control border border-line bg-surface-soft p-1"
    :class="[sizeCls[size], block ? 'flex w-full' : '']"
    @update:model-value="onChange"
  >
    <ToggleGroupItem
      v-for="opt in options"
      :key="opt.value"
      :value="opt.value"
      :aria-label="opt.label ? undefined : opt.value"
      class="relative inline-flex h-full items-center justify-center gap-1.5 rounded-md px-3 font-medium outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:text-ink data-[state=off]:text-muted data-[state=off]:hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
      :class="block ? 'flex-1' : ''"
    >
      <!-- Sliding pill behind the active segment. -->
      <Motion
        v-if="opt.value === modelValue"
        :layout-id="pillId"
        :transition="pillTransition"
        class="absolute inset-0 z-0 rounded-md border border-line bg-surface-raised shadow-sm"
      />
      <LpIcon v-if="opt.icon" :name="opt.icon" :size="14" class="relative z-10 shrink-0" />
      <span v-if="opt.label" class="relative z-10">{{ opt.label }}</span>
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
