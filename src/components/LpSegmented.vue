<script lang="ts">
// The consumer's `class` is merged into the root's own rather than appended to
// it, so opt out of the automatic pass-through that would add it a second
// time, unmerged.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
import { usePaletteControl, type PaletteControlOptions } from "../composables/usePaletteCommands"
/*
 * Segmented control — a compact bar of mutually-exclusive options with a sliding
 * pill marking the selection (iOS-style). Built on reka ToggleGroup for the
 * roving-focus/keyboard wiring; the pill rides motion-v's shared layoutId, the
 * same trick as LpTabs/LpPagination. Use it for short option sets (2–5) where a
 * full Tabs bar is too heavy — view switches, density toggles, on/off-ish picks.
 */
import { Motion } from "motion-v"
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui"
import { ref, useId } from "vue"
import { useFieldControl } from "../composables/useField"
import { useMergedAttrs } from "../composables/useMergedClass"
import { usePillTransition } from "../composables/usePillTransition"
import AttentionDot from "./AttentionDot.vue"
import LpIcon from "./LpIcon.vue"
import type { LpOptionBase } from "./options"

/** `icon` shows before the label, or alone for an icon-only segment. */
export interface SegmentedOption extends LpOptionBase<string> {
  /**
   * Accessible name for an icon-only segment. Without it the raw `value` is
   * announced, which is an identifier rather than words.
   */
  ariaLabel?: string
  /** A small dot on the segment: something behind it wants a look (as LpTabs' `dot`). */
  dot?: boolean
}

const props = withDefaults(
  defineProps<{
    /** Contextual palette metadata; false excludes this control. */
    palette?: PaletteControlOptions
    modelValue?: string
    options: SegmentedOption[]
    size?: "sm" | "md" | "lg"
    /** Stretch to fill the container with equal-width segments. */
    block?: boolean
    disabled?: boolean
    /**
     * The pill glides under the hovered segment and springs back on leave (the
     * default, as in LpTabs). False pins it to the selected segment and hover
     * only tints the label.
     */
    hoverFollow?: boolean
  }>(),
  { palette: undefined, size: "md", block: false, hoverFollow: true },
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
  lg: "h-(--size-control-lg) text-sm",
}

// The bar sizes itself from `size` and `block`, which is right until a consumer
// needs it flush against something — `class="p-0"` and `class="rounded-none"`
// have to reach the root rather than losing a coin toss with stylesheet order.
const { class: rootClass, attrs: rest } = useMergedAttrs(() =>
  [
    "inline-flex items-center gap-1 rounded-control border border-line bg-surface-soft p-1",
    sizeCls[props.size],
    props.block ? "flex w-full" : "",
  ].join(" "),
)

const field = useFieldControl(() => ({ wrapped: false, disabled: props.disabled }))

const pillId = `lp-segmented-${useId()}`
const pillTransition = usePillTransition()

// The pill sits under the hovered segment, falling back to the selected one;
// a disabled segment never draws it.
const hovered = ref<string | null>(null)
function onEnter(opt: SegmentedOption) {
  if (props.hoverFollow && !opt.disabled && !field.value.disabled) hovered.value = opt.value
}
function pillUnder(value: string): boolean {
  return hovered.value ? hovered.value === value : value === props.modelValue
}

/*
 * Drop focus after a pointer pick, as LpTabs does: the bar is a roving-focus
 * group, so a click that leaves focus on a segment quietly hands the arrow
 * keys to it, and whatever the page does with arrows looks broken until the
 * user clicks elsewhere. Keyboard navigation never fires a pointer event, so
 * it keeps focus as before.
 */
function releaseFocusAfterPointer(event: PointerEvent) {
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.blur()
}

usePaletteControl({ disabled: () => field.value.disabled })
</script>

<template>
  <ToggleGroupRoot
    :model-value="modelValue"
    type="single"
    :disabled="field.disabled"
    :aria-labelledby="field.labelId"
    :aria-describedby="field.describedBy"
    :rovingFocus="true"
    :class="rootClass"
    v-bind="rest"
    @update:model-value="onChange"
    @pointerleave="hovered = null"
  >
    <ToggleGroupItem
      v-for="opt in options"
      :key="opt.value"
      :value="opt.value"
      :disabled="opt.disabled"
      :aria-label="opt.ariaLabel ?? (opt.label ? undefined : opt.value)"
      class="relative inline-flex h-full items-center justify-center gap-1.5 rounded-inner font-medium outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-emphasized)] focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:text-ink data-[state=off]:text-muted data-[state=off]:hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
      :class="[block ? 'flex-1' : '', size === 'lg' ? 'px-4' : 'px-3', hovered === opt.value ? 'text-ink' : '']"
      @pointerenter="onEnter(opt)"
      @pointerup="releaseFocusAfterPointer"
    >
      <!-- Sliding pill behind the active (or hovered) segment. -->
      <Motion
        v-if="pillUnder(opt.value)"
        :layout-id="pillId"
        :transition="pillTransition"
        class="absolute inset-0 z-0 rounded-inner border border-line bg-surface-raised shadow-sm"
      />
      <span v-if="opt.icon" class="relative z-10 inline-flex shrink-0">
        <LpIcon :name="opt.icon" :size="size === 'lg' ? 16 : 14" />
        <AttentionDot v-if="opt.dot && !opt.label" corner />
      </span>
      <span v-if="opt.label" class="relative z-10">{{ opt.label }}</span>
      <AttentionDot v-if="opt.dot && opt.label" class="mt-1.5" />
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
