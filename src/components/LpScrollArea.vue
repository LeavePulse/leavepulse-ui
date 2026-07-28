<script setup lang="ts">
/*
 * Drawn overlay scrollbar (reka ScrollArea). Floats over content — never
 * reserves layout width, so the viewport doesn't jump. Thin at rest, a touch
 * thicker on hover; fades in/out (reka Presence keeps it mounted through the
 * exit animation). Rounded only on the OUTER edge — the side flush to the wall
 * stays square. Themed via tokens; native scroll/keyboard/touch preserved.
 */
import { computed, ref } from "vue"
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "reka-ui"

// `fade` softens the top/bottom edges to hint more content.
// `contentClass` styles the scrollable CONTENT container (the viewport's inner
// wrapper) — put list layout here (display:grid / gap / padding), not on the
// component root, since items live inside reka's viewport.
// `barInsetTop` (any CSS length) pulls the vertical scrollbar down by that much,
// so it doesn't run under a sticky header pinned at the top of the viewport.
// Wheel and keyboard scrolling ease by default. `instant` opts back out, and
// any consumer that DRIVES the scroll itself needs it: CSS scroll-behaviour
// also governs programmatic scrolling, overriding `scrollTo({behavior:"auto"})`
// and animating even a plain `scrollTop = n`. A log tail pinning itself to the
// newest line, or restoring a position after prepending rows, has to land
// instantly — see LpLogViewer.
const props = withDefaults(
  defineProps<{
    fade?: boolean
    instant?: boolean
    contentClass?: string
    barInsetTop?: string
  }>(),
  { instant: false },
)

// Re-emit the native scroll event of the underlying viewport so consumers that
// drive scroll-following (e.g. log tails) can track position. The listener is
// bound on ScrollAreaViewport, whose `$attrs` reka forwards onto the scrollable
// element itself.
defineEmits<{ scroll: [event: Event] }>()

// Expose the scrollable viewport element so callers can read/write scrollTop
// (auto-scroll to bottom, "is at bottom" checks). reka's ScrollAreaViewport
// exposes it as `viewportElement`.
const viewportRef = ref<{ viewportElement?: HTMLElement } | null>(null)
const viewportEl = computed<HTMLElement | null>(
  () => viewportRef.value?.viewportElement ?? null,
)
defineExpose({ viewportEl })

// `opacity-0` + the hidden-state fade is what keeps the bar invisible at rest:
// with force-mount the element stays in the DOM, so a one-shot fade-out alone
// would snap back to visible once the animation finished.
const barFade =
  "opacity-0 data-[state=visible]:animate-[fade-in_180ms_ease] data-[state=visible]:opacity-100 data-[state=hidden]:animate-[fade-out_240ms_ease]"
</script>

<template>
  <ScrollAreaRoot class="relative overflow-hidden" type="hover" :scroll-hide-delay="500">
    <!-- The bar itself is a pointer target far wider than it looks: the visible
         rail is the thumb, sized below, while the track pads it out to a
         grabbable strip. A 4px-wide hit area is near-impossible to catch with a
         mouse. Padding (not width) carries the extra room so the thumb stays
         flush against the wall. -->
    <!-- force-mount: reka only sets the viewport's `overflow-y: scroll` while a
         vertical scrollbar is MOUNTED, and with type="hover" that happens on
         first hover — so before the pointer ever entered, the region silently
         refused to scroll (wheel included). Mounting it up front fixes that;
         the bar still only becomes visible on hover, via `barFade` below. -->
    <ScrollAreaScrollbar
      orientation="vertical"
      force-mount
      class="group flex w-3.5 touch-none select-none justify-end py-px pl-2.5 pr-px"
      :class="barFade"
      :style="barInsetTop ? { marginTop: barInsetTop } : undefined"
    >
      <ScrollAreaThumb
        class="w-1 rounded-l-pill bg-brand/40 transition-[width,background-color] duration-[var(--duration-fast)] group-hover:w-1.5 group-hover:bg-brand"
      />
    </ScrollAreaScrollbar>

    <ScrollAreaScrollbar
      orientation="horizontal"
      class="group flex h-3.5 flex-col touch-none select-none justify-end px-px pb-px pt-2.5"
      :class="barFade"
    >
      <ScrollAreaThumb
        class="h-1 rounded-t-pill bg-brand/40 transition-[height,background-color] duration-[var(--duration-fast)] group-hover:h-1.5 group-hover:bg-brand"
      />
    </ScrollAreaScrollbar>

    <ScrollAreaViewport
      ref="viewportRef"
      class="size-full min-w-0 [&>div]:!block [&>div]:!min-w-0"
      :class="[
        instant ? '' : 'scroll-smooth motion-reduce:scroll-auto',
        fade ? '[mask-image:linear-gradient(to_bottom,transparent_0,black_14px,black_calc(100%-14px),transparent_100%)]' : '',
      ]"
      @scroll.passive="$emit('scroll', $event)"
    >
      <div :class="contentClass">
        <slot />
      </div>
    </ScrollAreaViewport>
  </ScrollAreaRoot>
</template>
