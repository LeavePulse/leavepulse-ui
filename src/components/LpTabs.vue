<script setup lang="ts">
import { Motion, useReducedMotion } from "motion-v"
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui"
import { computed, nextTick, ref, useId, watch } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import LpIcon from "./LpIcon.vue"

export interface TabItem {
  value: string
  label: string
  /** Optional iconify name (e.g. "lucide:palette"), shown left of the label. */
  icon?: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** Initially active tab when `v-model` is not bound (default: the first). */
    defaultValue?: string
    items: TabItem[]
    /**
     * "contained" (default) wraps the triggers in a bordered, filled bar.
     * "plain" drops the container chrome — a flat row of tabs with only the
     * sliding pill marking the active one (for nav bars over a custom surface).
     * "underline" is a flat row over a hairline baseline, marking the active
     * tab with a sliding bottom bar instead of a pill (page-section nav style).
     */
    variant?: "contained" | "plain" | "underline"
    /** Tint the active pill + label with the brand colour (nav-bar style). */
    accent?: boolean
    /** Stretch the bar to full width with equal-share triggers. */
    block?: boolean
  }>(),
  { variant: "contained", accent: false, block: false },
)
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>()

// Held here rather than left to reka, so the active marker follows the active
// tab in uncontrolled use too: reading the prop alone left it unmarked.
const current = ref(props.modelValue ?? props.defaultValue ?? props.items[0]?.value)
watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined) current.value = value
  },
)

// A row wider than its container scrolls sideways (a phone, a narrow card)
// instead of wrapping each label onto two lines; the active tab is brought
// into view whenever it changes, including from outside.
const list = ref<{ $el: HTMLElement } | null>(null)
watch(current, () => {
  void nextTick(() => {
    const row = list.value?.$el
    const active = row?.querySelector<HTMLElement>('[data-state="active"]')
    if (!row || !active || row.scrollWidth <= row.clientWidth) return
    const start = active.offsetLeft - row.offsetLeft
    const end = start + active.offsetWidth
    if (start >= row.scrollLeft && end <= row.scrollLeft + row.clientWidth) return
    const left = start < row.scrollLeft ? start : end - row.clientWidth
    row.scrollTo({ left, behavior: reduceMotion.value ? "auto" : "smooth" })
  })
})

function select(value: string) {
  if (props.modelValue === undefined) current.value = value
  emit("update:modelValue", value)
}

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

/*
 * Drop focus after a mouse pick.
 *
 * Tabs implement the ARIA roving-focus pattern: while a trigger holds focus,
 * ←/→ move between tabs. That is correct for keyboard users, but a *click*
 * also leaves focus on the trigger — so afterwards the arrow keys silently
 * belong to the tab strip, and any arrow-key handling the surrounding app has
 * (walking a grid, moving a selection) appears to be broken until the user
 * clicks somewhere else.
 *
 * Blurring on pointerup restores the arrows to the page without touching the
 * keyboard path: Tab/←/→ navigation still focuses triggers and still works,
 * because those never fire a pointer event.
 */
function releaseFocusAfterPointer(event: PointerEvent) {
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.blur()
}
</script>

<template>
  <TabsRoot
    :model-value="current"
    @update:model-value="(v) => select(v as string)"
  >
    <TabsList
      ref="list"
      class="max-w-full gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      :class="[
        block ? 'flex w-full' : 'inline-flex',
        variant === 'contained' ? 'rounded-control border border-line bg-surface-soft p-1' : '',
        variant === 'underline' ? 'border-b border-line' : '',
      ]"
      @pointerleave="hovered = null"
    >
      <TabsTrigger
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm outline-none transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring"
        :class="[
          block ? 'flex-1' : '',
          variant === 'underline' ? 'rounded-t-md px-3 pt-1.5 pb-2' : 'rounded-md px-3 py-1.5',
          accent ? 'data-[state=active]:text-brand' : 'data-[state=active]:text-ink',
          hovered === item.value ? 'text-ink' : 'text-muted',
        ]"
        @pointerenter="hovered = item.value"
        @pointerup="releaseFocusAfterPointer"
      >
        <!-- Active marker: a bottom bar in "underline", a filled pill otherwise.
             Both slide between tabs via the shared motion layoutId. -->
        <Motion
          v-if="pillUnder(item.value, current)"
          :layout-id="pillId"
          :transition="pillTransition"
          :class="variant === 'underline'
            ? [
                'absolute inset-x-0 -bottom-px z-0 h-0.5 rounded-full',
                accent ? 'bg-brand' : 'bg-ink',
              ]
            : [
                'absolute inset-0 z-0 rounded-md shadow-sm',
                accent
                  ? 'border border-brand/35 bg-brand/12'
                  : 'border border-line bg-surface-raised',
              ]"
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
