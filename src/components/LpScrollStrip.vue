<script setup lang="ts">
/*
 * A row that scrolls sideways and can be reached with any input: tabs, chips,
 * branch pills, a filmstrip. The scrollbar is hidden, so useScrollStrip gives
 * the mouse its way in (the wheel and drag-to-scroll), the edges with items
 * beyond them fade, and on a device with a fine pointer a hover shows a
 * previous and a next button on whichever side still has something to show.
 * Touch keeps its native scrolling and any scroll snap the row sets.
 *
 * The default slot is the row's content; `contentClass` styles the scrolling
 * row itself (gap, padding, snap), the class on the component its frame. The
 * buttons are a pointer's shortcut and stay out of the tab order: the
 * keyboard reaches the items, and the focused one is scrolled into view.
 * Class and style go on the frame; any other attribute (an aria-label, a
 * role, listeners) lands on the row, which is the element the items sit in.
 */
import { computed, ref, useAttrs } from "vue"
import { useMediaQuery } from "../composables/useMediaQuery"
import { useScrollStrip } from "../composables/useScrollStrip"
import LpIcon from "./LpIcon.vue"

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const rowAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const props = withDefaults(
  defineProps<{
    /** Classes for the scrolling row (layout, gap, padding, snap). */
    contentClass?: unknown
    /** Fade the edges that have items beyond them. */
    fade?: boolean
    /** Previous/next buttons: `auto` shows them on hover where the pointer is fine (a mouse), true on any device, false never. */
    buttons?: boolean | "auto"
    /** Map a vertical wheel to sideways scrolling while the row can move. */
    wheel?: boolean
    /** Drag to scroll with a mouse or pen. */
    drag?: boolean
    /** The row element's tag. */
    as?: string
    /** Size to the content up to the parent's width (inline-flex), rather than fill the line. */
    inline?: boolean
  }>(),
  { fade: true, buttons: "auto", wheel: true, drag: true, as: "div", inline: false },
)

const scroller = ref<HTMLElement | null>(null)
const strip = useScrollStrip(scroller, { wheel: () => props.wheel, drag: () => props.drag })
const fine = useMediaQuery("(hover: hover) and (pointer: fine)")
const withButtons = computed(() => props.buttons === true || (props.buttons === "auto" && fine.value))

defineExpose({ scroller, page: strip.page, scrollBy: strip.scrollBy, reveal: strip.reveal, measure: strip.measure, overflowing: strip.overflowing, atStart: strip.atStart, atEnd: strip.atEnd })

const BUTTON =
  "absolute top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface-raised text-muted shadow-sm outline-none transition-[opacity,color] duration-(--duration-fast) ease-(--ease-emphasized) hover:text-ink motion-reduce:transition-none"
</script>

<template>
  <div class="group/strip relative min-w-0" :class="[inline ? 'inline-flex max-w-full' : 'flex', attrs.class]" :style="attrs.style as never" data-lp-strip>
    <component
      :is="as"
      v-bind="rowAttrs"
      ref="scroller"
      class="lp-scrollbar-none flex min-w-0 flex-1 overflow-x-auto"
      :class="[contentClass, fade ? 'lp-strip-fade' : '', strip.dragging.value ? 'cursor-grabbing select-none' : '']"
      :data-lp-more-start="strip.overflowing.value && !strip.atStart.value ? '' : undefined"
      :data-lp-more-end="strip.overflowing.value && !strip.atEnd.value ? '' : undefined"
      data-lp-strip-row
    >
      <slot />
    </component>
    <template v-if="withButtons">
      <button
        v-for="side in ([-1, 1] as const)"
        :key="side"
        type="button"
        tabindex="-1"
        aria-hidden="true"
        :class="[
          BUTTON,
          side < 0 ? 'left-0.5' : 'right-0.5',
          strip.overflowing.value && !(side < 0 ? strip.atStart.value : strip.atEnd.value)
            ? (buttons === true ? 'opacity-100' : 'opacity-0 group-hover/strip:opacity-100')
            : 'pointer-events-none opacity-0',
        ]"
        :data-lp-strip-button="side < 0 ? 'prev' : 'next'"
        @pointerdown.prevent
        @click="strip.page(side)"
      >
        <LpIcon :name="side < 0 ? 'lucide:chevron-left' : 'lucide:chevron-right'" :size="16" />
      </button>
    </template>
  </div>
</template>
