<script setup lang="ts">
import { Motion, useReducedMotion } from "motion-v"
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "reka-ui"
import { computed, nextTick, ref, useId, watch } from "vue"
import { usePillTransition } from "../composables/usePillTransition"
import LpBadge from "./LpBadge.vue"
import LpContextMenu, { type ContextMenuItemDef } from "./LpContextMenu.vue"
import LpIcon from "./LpIcon.vue"
import LpRollingText from "./LpRollingText.vue"
import { pickTab } from "./tabs"

export interface TabItem {
  value: string
  label: string
  /** Optional iconify name (e.g. "lucide:palette"), shown left of the label. */
  icon?: string
  /** A small dot on the tab: something behind it wants a look (unread, a problem). */
  dot?: boolean
  /**
   * A count chip after the label (number or short string), as on sidebar
   * items: how much is behind the tab, not merely that something is.
   */
  badge?: number | string
  /** Shown but not selectable; skipped by the arrow keys and by hover. */
  disabled?: boolean
  /** Right-click menu for this tab, headed by its label. */
  menu?: ContextMenuItemDef[]
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
     * "bottom" is a phone's bottom navigation: full width, equal-share tabs
     * with the icon over the label, a sliding bar along the top edge marking
     * the active one, and padding for the gesture strip and side insets of an
     * edge-to-edge screen. Place it as the last row of the layout.
     */
    variant?: "contained" | "plain" | "underline" | "bottom"
    /** Tint the active pill + label with the brand colour (nav-bar style). */
    accent?: boolean
    /** Stretch the bar to full width with equal-share triggers. */
    block?: boolean
    /** Accessible name of the tab list, e.g. "Main" for an app's navigation. */
    label?: string
    /**
     * The marker glides under the hovered tab and springs back on leave (the
     * default). False pins it to the selected tab: calmer for a dense header
     * where the pointer crosses the bar on its way elsewhere.
     */
    hoverFollow?: boolean
  }>(),
  { variant: "contained", accent: false, block: false, hoverFollow: true },
)

const bottom = computed(() => props.variant === "bottom")
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>()

// Held here rather than left to reka, so the active marker follows the active
// tab in uncontrolled use too: reading the prop alone left it unmarked.
const current = ref(props.modelValue ?? pickTab(props.items, props.defaultValue))
watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined) current.value = value
  },
)

// Uncontrolled, the tabs re-pick when the list changes under them: items that
// arrive after the first render, or a removed or disabled current tab, would
// otherwise leave no tab active. Bound with v-model the choice is the app's.
watch(
  () => props.items.map((item) => [item.value, item.disabled]),
  () => {
    if (props.modelValue === undefined) current.value = pickTab(props.items, current.value)
  },
  { deep: true },
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

// A bottom bar marks only the active tab: on a phone a tap is the hover, and
// a bar that chased the mouse across a desktop window would point at a tab
// nobody chose.
function pillUnder(value: string, active?: string): boolean {
  if (bottom.value) return active === value
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
      :aria-label="label"
      :class="bottom
        ? 'grid w-full auto-cols-fr grid-flow-col border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]'
        : [
            'max-w-full gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            block ? 'flex w-full' : 'inline-flex',
            variant === 'contained' ? 'rounded-control border border-line bg-surface-soft p-1' : '',
            variant === 'underline' ? 'border-b border-line' : '',
          ]"
      @pointerleave="hovered = null"
    >
      <!-- Passthrough when the tab has no menu, so it keeps the native one. -->
      <LpContextMenu
        v-for="item in items"
        :key="item.value"
        :items="item.menu ?? []"
        :title="item.label"
        :title-icon="item.icon"
      >
      <TabsTrigger
        :value="item.value"
        :disabled="item.disabled"
        class="relative inline-flex items-center justify-center outline-none transition-[color,opacity] duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45"
        :class="[
          bottom
            ? 'min-h-14 min-w-0 flex-col gap-0.5 px-1 py-1.5 text-[11px] font-medium focus-visible:ring-inset'
            : 'shrink-0 gap-1.5 whitespace-nowrap text-sm',
          block && !bottom ? 'flex-1' : '',
          variant === 'underline' ? 'rounded-t-inner px-3 pt-1.5 pb-2' : '',
          variant === 'contained' || variant === 'plain' ? 'rounded-inner px-3 py-1.5' : '',
          accent ? 'data-[state=active]:text-brand' : 'data-[state=active]:text-ink',
          hovered === item.value && !bottom ? 'text-ink' : !hoverFollow && !bottom ? 'text-muted hover:text-ink' : 'text-muted',
        ]"
        @pointerenter="hoverFollow && !item.disabled && (hovered = item.value)"
        @pointerup="releaseFocusAfterPointer"
      >
        <!-- Active marker: a bar under the tab in "underline", over it in
             "bottom", a filled pill otherwise. All slide between tabs via the
             shared motion layoutId. -->
        <Motion
          v-if="pillUnder(item.value, current)"
          :layout-id="pillId"
          :transition="pillTransition"
          :class="variant === 'underline'
            ? [
                'absolute inset-x-0 -bottom-px z-0 h-0.5 rounded-full',
                accent ? 'bg-brand' : 'bg-ink',
              ]
            : bottom
              ? [
                  'absolute inset-x-[22%] top-0 z-0 h-0.5 rounded-b-full',
                  accent ? 'bg-brand' : 'bg-ink',
                ]
              : [
                  'absolute inset-0 z-0 rounded-inner shadow-sm',
                  accent
                    ? 'border border-brand/35 bg-brand/12'
                    : 'border border-line bg-surface-raised',
                ]"
        />
        <span v-if="item.icon" class="relative z-10 inline-flex">
          <LpIcon :name="item.icon" :size="bottom ? 22 : 14" />
          <span
            v-if="item.dot"
            aria-hidden="true"
            class="absolute -right-1 -top-0.5 size-2 rounded-full bg-accent"
          />
          <!-- On a bottom bar the count rides on the icon's corner, as phone
               navs draw it: the label under the icon has no room beside it. -->
          <Transition name="lp-tab-badge">
            <LpBadge
              v-if="bottom && item.badge != null"
              size="sm"
              :tone="current === item.value ? 'brand' : 'neutral'"
              class="absolute -right-3 -top-1.5 min-w-[18px] justify-center"
            >
              <LpRollingText :value="item.badge" />
            </LpBadge>
          </Transition>
        </span>
        <span class="relative z-10" :class="bottom ? 'max-w-full truncate' : ''">{{ item.label }}</span>
        <span
          v-if="item.dot && !item.icon"
          aria-hidden="true"
          class="relative z-10 size-1.5 self-start rounded-full bg-accent"
        />
        <!-- The count rolls when it changes, and the chip scales in and out
             rather than popping. -->
        <Transition name="lp-tab-badge">
          <LpBadge
            v-if="!(bottom && item.icon) && item.badge != null"
            size="sm"
            :tone="current === item.value ? 'brand' : 'neutral'"
            class="relative z-10 min-w-[18px] justify-center"
          >
            <LpRollingText :value="item.badge" />
          </LpBadge>
        </Transition>
      </TabsTrigger>
      </LpContextMenu>
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

<style scoped>
.lp-tab-badge-enter-active,
.lp-tab-badge-leave-active {
  transition:
    opacity var(--duration-fast) var(--ease-emphasized),
    transform var(--duration-fast) var(--ease-emphasized);
}
.lp-tab-badge-enter-from,
.lp-tab-badge-leave-to {
  opacity: 0;
  transform: scale(0.6);
}
@media (prefers-reduced-motion: reduce) {
  .lp-tab-badge-enter-active,
  .lp-tab-badge-leave-active {
    transition: none;
  }
}
</style>
